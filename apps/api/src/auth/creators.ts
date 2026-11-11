import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '../config';
import type { Queryable } from '../db/database';
import { fail } from '../errors';
import { hashToken, readSession } from './sessions';

export interface Creator {
  accountId: string;
  /** `token` for the CLI, `session` for the web platform. */
  via: 'token' | 'session';
}

export function bearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length).trim() || undefined;
}

/**
 * A creator signs in with an API token or a web session, and must have a registered account.
 * When a token is sent, cookies are ignored, so a request can't mix the two.
 */
export async function requireCreator(
  db: Queryable,
  request: FastifyRequest,
  reply: FastifyReply,
  config: Config,
): Promise<Creator> {
  const token = bearerToken(request);
  if (token !== undefined) {
    const { rows } = await db.query<{ account_id: string; kind: string }>(
      `UPDATE api_tokens t SET last_used_at = now()
         FROM accounts a
        WHERE t.token_hash = $1 AND a.id = t.account_id
        RETURNING t.account_id, a.kind`,
      [hashToken(token)],
    );
    const row = rows[0];
    if (!row) throw fail('UNAUTHENTICATED', 'This API token is not valid.');
    if (row.kind !== 'registered') throw fail('FORBIDDEN', 'Creators need an account with a passkey.');
    return { accountId: row.account_id, via: 'token' };
  }

  const session = await readSession(db, request, reply, config);
  if (!session) throw fail('UNAUTHENTICATED', 'Sign in to continue.');
  if (session.kind !== 'registered') throw fail('FORBIDDEN', 'Creators need an account with a passkey.');
  return { accountId: session.accountId, via: 'session' };
}
