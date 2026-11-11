import { passkeyOptionsResponseSchema, passkeyVerifyRequestSchema, accountResponseSchema } from '@gamingalo/contracts';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type { FastifyInstance } from 'fastify';
import type { Config } from '../../config';
import type { Database, Queryable } from '../../db/database';
import { fail, parseBody } from '../../errors';
import { describeAccount, endSession, readSession, requireSession, startSession } from '../../auth/sessions';

const CHALLENGE_MINUTES = 5;

/** The same answer for every failure, so that a caller learns nothing about why. */
const notVerified = () => fail('UNAUTHENTICATED', 'The passkey could not be verified.');

async function saveChallenge(db: Queryable, challenge: string, purpose: 'register' | 'login', accountId: string | null) {
  await db.query('DELETE FROM webauthn_challenges WHERE expires_at < now()');
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO webauthn_challenges (challenge, purpose, account_id, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(mins => $4)) RETURNING id`,
    [challenge, purpose, accountId, CHALLENGE_MINUTES],
  );
  return (rows[0] as { id: string }).id;
}

/** Deletes the challenge as it's read, so each one can be used once only. */
async function takeChallenge(db: Queryable, id: string, purpose: 'register' | 'login') {
  const { rows } = await db.query<{ challenge: string; account_id: string | null; expired: boolean }>(
    `DELETE FROM webauthn_challenges WHERE id = $1 AND purpose = $2
     RETURNING challenge, account_id, expires_at < now() AS expired`,
    [id, purpose],
  );
  const row = rows[0];
  if (!row || row.expired) throw notVerified();
  return row;
}

export function registerPasskeyRoutes(app: FastifyInstance, database: Database, config: Config): void {
  const rateLimit = { rateLimit: { max: config.authRateLimit, timeWindow: '1 minute' } };

  app.post('/v1/passkeys/registration/options', { config: rateLimit }, async (request, reply) => {
    const session = await requireSession(database, request, reply, config);
    if (session.ageBand === 'under13') {
      throw fail('PARENTAL_CONSENT_REQUIRED', 'A parent or guardian needs to agree before you can add a passkey.');
    }
    const { rows } = await database.query<{ id: string; transports: string[] }>(
      'SELECT id, transports FROM passkeys WHERE account_id = $1',
      [session.accountId],
    );
    const options = await generateRegistrationOptions({
      rpName: config.rpName,
      rpID: config.rpId,
      userName: session.displayName,
      userID: new Uint8Array(Buffer.from(session.accountId.replaceAll('-', ''), 'hex')),
      attestationType: 'none',
      excludeCredentials: rows.map((row) => ({ id: row.id, transports: row.transports })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    });
    const challengeId = await saveChallenge(database, options.challenge, 'register', session.accountId);
    return passkeyOptionsResponseSchema.parse({ challengeId, options });
  });

  app.post('/v1/passkeys/registration/verify', { config: rateLimit }, async (request, reply) => {
    const session = await requireSession(database, request, reply, config);
    const { challengeId, credential } = parseBody(passkeyVerifyRequestSchema, request.body);
    const challenge = await takeChallenge(database, challengeId, 'register');
    if (challenge.account_id !== session.accountId) throw notVerified();

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: credential as unknown as RegistrationResponseJSON,
        expectedChallenge: challenge.challenge,
        expectedOrigin: config.webOrigin,
        expectedRPID: config.rpId,
        requireUserVerification: false,
      });
    } catch (error) {
      request.log.info({ err: error }, 'passkey registration rejected');
      throw notVerified();
    }
    if (!verification.verified) throw notVerified();

    const { credential: verified } = verification.registrationInfo;
    await database.transaction(async (tx) => {
      const inserted = await tx.query(
        `INSERT INTO passkeys (id, account_id, public_key, counter, transports)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING RETURNING id`,
        [verified.id, session.accountId, verified.publicKey, verified.counter, verified.transports ?? []],
      );
      if (inserted.rows.length === 0) throw fail('CONFLICT', 'This passkey is already registered.');
      await tx.query("UPDATE accounts SET kind = 'registered' WHERE id = $1", [session.accountId]);
      await tx.query('UPDATE sessions SET authenticated_at = now() WHERE id = $1', [session.sessionId]);
    });
    return accountResponseSchema.parse(await describeAccount(database, session.accountId));
  });

  app.post('/v1/passkeys/login/options', { config: rateLimit }, async () => {
    // No allow list, so the browser offers any passkey saved for this site.
    const options = await generateAuthenticationOptions({ rpID: config.rpId, userVerification: 'preferred' });
    const challengeId = await saveChallenge(database, options.challenge, 'login', null);
    return passkeyOptionsResponseSchema.parse({ challengeId, options });
  });

  app.post('/v1/passkeys/login/verify', { config: rateLimit }, async (request, reply) => {
    const { challengeId, credential } = parseBody(passkeyVerifyRequestSchema, request.body);
    const challenge = await takeChallenge(database, challengeId, 'login');

    const { rows } = await database.query<{ account_id: string; public_key: Uint8Array; counter: number; transports: string[] }>(
      'SELECT account_id, public_key, counter::float8 AS counter, transports FROM passkeys WHERE id = $1',
      [credential.id],
    );
    const stored = rows[0];
    if (!stored) throw notVerified();

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: credential as unknown as AuthenticationResponseJSON,
        expectedChallenge: challenge.challenge,
        expectedOrigin: config.webOrigin,
        expectedRPID: config.rpId,
        credential: {
          id: credential.id,
          publicKey: new Uint8Array(stored.public_key),
          counter: Number(stored.counter),
          transports: stored.transports,
        },
        requireUserVerification: false,
      });
    } catch (error) {
      request.log.info({ err: error }, 'passkey sign-in rejected');
      throw notVerified();
    }
    if (!verification.verified) throw notVerified();

    await database.query('UPDATE passkeys SET counter = $2, last_used_at = now() WHERE id = $1', [
      credential.id,
      verification.authenticationInfo.newCounter,
    ]);
    // A new session for the new sign-in, so an old session token can't be reused for this account.
    if (await readSession(database, request, reply, config)) await endSession(database, request, reply, config);
    await startSession(database, reply, config, stored.account_id);
    return accountResponseSchema.parse(await describeAccount(database, stored.account_id));
  });
}
