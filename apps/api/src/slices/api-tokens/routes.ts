import { randomBytes } from 'node:crypto';
import { apiTokenListSchema, createApiTokenRequestSchema, createdApiTokenSchema } from '@gamingalo/contracts';
import type { FastifyInstance } from 'fastify';
import type { Config } from '../../config';
import type { Database } from '../../db/database';
import { fail, parseBody } from '../../errors';
import { hashToken, requireSession } from '../../auth/sessions';

const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null);

/** API tokens let the CLI and CI publish games. They're managed from the web platform only. */
export function registerApiTokenRoutes(app: FastifyInstance, database: Database, config: Config): void {
  app.get('/v1/me/tokens', async (request, reply) => {
    const session = await requireSession(database, request, reply, config);
    const { rows } = await database.query<{ id: string; name: string; created_at: Date; last_used_at: Date | null }>(
      'SELECT id, name, created_at, last_used_at FROM api_tokens WHERE account_id = $1 ORDER BY created_at',
      [session.accountId],
    );
    return apiTokenListSchema.parse({
      tokens: rows.map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: iso(row.created_at),
        lastUsedAt: iso(row.last_used_at),
      })),
    });
  });

  app.post('/v1/me/tokens', async (request, reply) => {
    const session = await requireSession(database, request, reply, config);
    if (session.kind !== 'registered') throw fail('FORBIDDEN', 'Creators need an account with a passkey.');
    const { name } = parseBody(createApiTokenRequestSchema, request.body);
    // The prefix makes tokens easy to spot, for example by secret scanners.
    const token = `gmg_${randomBytes(32).toString('base64url')}`;
    const { rows } = await database.query<{ id: string; created_at: Date }>(
      'INSERT INTO api_tokens (account_id, name, token_hash) VALUES ($1, $2, $3) RETURNING id, created_at',
      [session.accountId, name, hashToken(token)],
    );
    const row = rows[0] as { id: string; created_at: Date };
    void reply.status(201);
    return createdApiTokenSchema.parse({ id: row.id, name, createdAt: iso(row.created_at), lastUsedAt: null, token });
  });

  app.delete<{ Params: { id: string } }>('/v1/me/tokens/:id', async (request, reply) => {
    const session = await requireSession(database, request, reply, config);
    const { rows } = await database.query(
      'DELETE FROM api_tokens WHERE id::text = $1 AND account_id = $2 RETURNING id',
      [request.params.id, session.accountId],
    );
    if (rows.length === 0) throw fail('NOT_FOUND', 'There is no such token.');
    void reply.status(204);
    return null;
  });
}
