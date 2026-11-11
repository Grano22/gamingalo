import { createHash, randomBytes } from 'node:crypto';
import type { AccountResponse, AgeBand } from '@gamingalo/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '../config';
import type { Queryable } from '../db/database';
import { fail } from '../errors';

export interface SessionAccount {
  sessionId: string;
  accountId: string;
  kind: 'guest' | 'registered';
  displayName: string;
  ageBand: AgeBand;
  createdAt: Date;
  /** When the player last proved who they are, as opposed to when the session was extended. */
  authenticatedAt: Date;
}

export function sessionCookieName(config: Config): string {
  // The `__Host-` prefix makes browsers refuse the cookie unless it's secure, for this host only, on path `/`.
  return config.cookieSecure ? '__Host-gamingalo_session' : 'gamingalo_session';
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function setCookie(reply: FastifyReply, config: Config, token: string): void {
  void reply.setCookie(sessionCookieName(config), token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: config.sessionDays * 24 * 60 * 60,
  });
}

export function clearSessionCookie(reply: FastifyReply, config: Config): void {
  void reply.clearCookie(sessionCookieName(config), { path: '/', secure: config.cookieSecure, sameSite: 'lax' });
}

/** Creates a session and sets its cookie. Only the token's hash is stored. */
export async function startSession(db: Queryable, reply: FastifyReply, config: Config, accountId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  await db.query(
    `INSERT INTO sessions (account_id, token_hash, expires_at)
     VALUES ($1, $2, now() + make_interval(days => $3))`,
    [accountId, hashToken(token), config.sessionDays],
  );
  setCookie(reply, config, token);
}

interface SessionRow {
  session_id: string;
  account_id: string;
  kind: 'guest' | 'registered';
  display_name: string;
  age_band: AgeBand;
  created_at: Date;
  authenticated_at: Date;
  needs_extension: boolean;
}

/** Returns the signed-in account, extending the session once half of its life has passed. */
export async function readSession(
  db: Queryable,
  request: FastifyRequest,
  reply: FastifyReply,
  config: Config,
): Promise<SessionAccount | undefined> {
  const token = request.cookies[sessionCookieName(config)];
  if (!token) return undefined;

  const { rows } = await db.query<SessionRow>(
    `SELECT s.id AS session_id, a.id AS account_id, a.kind, a.display_name, a.age_band, a.created_at,
            s.authenticated_at,
            s.expires_at < now() + make_interval(days => $2) / 2 AS needs_extension
       FROM sessions s JOIN accounts a ON a.id = s.account_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token), config.sessionDays],
  );
  const row = rows[0];
  if (!row) return undefined;

  if (row.needs_extension) {
    await db.query('UPDATE sessions SET expires_at = now() + make_interval(days => $2) WHERE id = $1', [
      row.session_id,
      config.sessionDays,
    ]);
    setCookie(reply, config, token);
  }
  return {
    sessionId: row.session_id,
    accountId: row.account_id,
    kind: row.kind,
    displayName: row.display_name,
    ageBand: row.age_band,
    createdAt: new Date(row.created_at),
    authenticatedAt: new Date(row.authenticated_at),
  };
}

export async function requireSession(
  db: Queryable,
  request: FastifyRequest,
  reply: FastifyReply,
  config: Config,
): Promise<SessionAccount> {
  const session = await readSession(db, request, reply, config);
  if (!session) throw fail('UNAUTHENTICATED', 'Sign in to continue.');
  return session;
}

/** Deletes the session on the server, so a copied cookie stops working too. */
export async function endSession(db: Queryable, request: FastifyRequest, reply: FastifyReply, config: Config): Promise<void> {
  const token = request.cookies[sessionCookieName(config)];
  if (token) await db.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
  clearSessionCookie(reply, config);
}

export function isMinor(ageBand: AgeBand): boolean {
  return ageBand !== '16plus';
}

export async function describeAccount(db: Queryable, accountId: string): Promise<AccountResponse> {
  const { rows } = await db.query<{
    id: string;
    kind: 'guest' | 'registered';
    display_name: string;
    age_band: AgeBand;
    created_at: Date;
    passkeys: number;
  }>(
    `SELECT a.id, a.kind, a.display_name, a.age_band, a.created_at,
            (SELECT count(*)::int FROM passkeys p WHERE p.account_id = a.id) AS passkeys
       FROM accounts a WHERE a.id = $1`,
    [accountId],
  );
  const row = rows[0];
  if (!row) throw fail('UNAUTHENTICATED', 'Sign in to continue.');
  return {
    id: row.id,
    kind: row.kind,
    displayName: row.display_name,
    ageBand: row.age_band,
    minor: isMinor(row.age_band),
    passkeys: row.passkeys,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
