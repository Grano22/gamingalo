import { randomBytes } from 'node:crypto';
import {
  accountResponseSchema,
  consentsSchema,
  createGuestRequestSchema,
  deleteAccountRequestSchema,
  exportResponseSchema,
  updateProfileRequestSchema,
} from '@gamingalo/contracts';
import type { FastifyInstance } from 'fastify';
import type { Config } from '../../config';
import type { Database } from '../../db/database';
import { fail, parseBody } from '../../errors';
import {
  clearSessionCookie,
  describeAccount,
  readSession,
  requireSession,
  startSession,
} from '../../auth/sessions';

const REAUTHENTICATION_WINDOW_MS = 15 * 60 * 1000;

export function registerAccountRoutes(app: FastifyInstance, database: Database, config: Config): void {
  const rateLimit = { rateLimit: { max: config.authRateLimit, timeWindow: '1 minute' } };

  app.post('/v1/accounts/guest', { config: rateLimit }, async (request, reply) => {
    const { ageBand } = parseBody(createGuestRequestSchema, request.body);
    if (await readSession(database, request, reply, config)) {
      throw fail('CONFLICT', 'Sign out before starting a new guest account.');
    }
    const displayName = `Player-${randomBytes(2).toString('hex')}`;
    const accountId = await database.transaction(async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        "INSERT INTO accounts (kind, display_name, age_band) VALUES ('guest', $1, $2) RETURNING id",
        [displayName, ageBand],
      );
      const id = (rows[0] as { id: string }).id;
      await tx.query('INSERT INTO consents (account_id) VALUES ($1)', [id]);
      return id;
    });
    await startSession(database, reply, config, accountId);
    void reply.status(201);
    return accountResponseSchema.parse(await describeAccount(database, accountId));
  });

  app.get('/v1/me', async (request, reply) => {
    const session = await requireSession(database, request, reply, config);
    return accountResponseSchema.parse(await describeAccount(database, session.accountId));
  });

  app.patch('/v1/me', async (request, reply) => {
    const session = await requireSession(database, request, reply, config);
    const { displayName } = parseBody(updateProfileRequestSchema, request.body);
    await database.query('UPDATE accounts SET display_name = $2 WHERE id = $1', [session.accountId, displayName]);
    return accountResponseSchema.parse(await describeAccount(database, session.accountId));
  });

  app.get('/v1/me/consents', async (request, reply) => {
    const session = await requireSession(database, request, reply, config);
    const { rows } = await database.query<{ analytics: boolean }>(
      'SELECT analytics FROM consents WHERE account_id = $1',
      [session.accountId],
    );
    return consentsSchema.parse({ analytics: rows[0]?.analytics ?? false });
  });

  app.put('/v1/me/consents', async (request, reply) => {
    const session = await requireSession(database, request, reply, config);
    const consents = parseBody(consentsSchema, request.body);
    if (consents.analytics && session.ageBand === 'under13') {
      throw fail('PARENTAL_CONSENT_REQUIRED', 'A parent or guardian needs to agree to this first.');
    }
    await database.query(
      `INSERT INTO consents (account_id, analytics, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (account_id) DO UPDATE SET analytics = $2, updated_at = now()`,
      [session.accountId, consents.analytics],
    );
    return consentsSchema.parse(consents);
  });

  app.get('/v1/me/export', async (request, reply) => {
    const session = await requireSession(database, request, reply, config);
    const account = await describeAccount(database, session.accountId);
    const [consents, sessions, passkeys] = await Promise.all([
      database.query<{ analytics: boolean }>('SELECT analytics FROM consents WHERE account_id = $1', [account.id]),
      database.query<{ created_at: Date; expires_at: Date }>(
        'SELECT created_at, expires_at FROM sessions WHERE account_id = $1 ORDER BY created_at',
        [account.id],
      ),
      database.query<{ created_at: Date; last_used_at: Date | null }>(
        'SELECT created_at, last_used_at FROM passkeys WHERE account_id = $1 ORDER BY created_at',
        [account.id],
      ),
    ]);
    const iso = (value: Date) => new Date(value).toISOString();
    void reply.header('content-disposition', 'attachment; filename="gamingalo-data.json"');
    // Parsing with a strict schema guarantees that nothing outside the contract, such as token hashes, is exported.
    return exportResponseSchema.parse({
      exportedAt: new Date().toISOString(),
      account,
      consents: { analytics: consents.rows[0]?.analytics ?? false },
      sessions: sessions.rows.map((row) => ({ createdAt: iso(row.created_at), expiresAt: iso(row.expires_at) })),
      passkeys: passkeys.rows.map((row) => ({
        createdAt: iso(row.created_at),
        lastUsedAt: row.last_used_at ? iso(row.last_used_at) : null,
      })),
    });
  });

  app.delete('/v1/me', async (request, reply) => {
    const session = await requireSession(database, request, reply, config);
    parseBody(deleteAccountRequestSchema, request.body);
    const recent = Date.now() - session.authenticatedAt.getTime() < REAUTHENTICATION_WINDOW_MS;
    if (session.kind === 'registered' && !recent) {
      throw fail('REAUTHENTICATION_REQUIRED', 'Sign in with your passkey again to delete your account.');
    }
    // Every related row is removed by the foreign keys' ON DELETE CASCADE.
    await database.query('DELETE FROM accounts WHERE id = $1', [session.accountId]);
    clearSessionCookie(reply, config);
    void reply.status(204);
    return null;
  });
}
