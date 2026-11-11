import type { Queryable } from './db/database';

export interface MaintenanceResult {
  sessions: number;
  playTokens: number;
  challenges: number;
  guests: number;
}

/**
 * Removes expired sessions, tokens and challenges, and guest accounts that nobody can sign in to
 * any more: no session for `guestRetentionDays`, and no passkey.
 */
export async function runMaintenance(db: Queryable, guestRetentionDays: number): Promise<MaintenanceResult> {
  const sessions = await db.query('DELETE FROM sessions WHERE expires_at < now() RETURNING id');
  const playTokens = await db.query('DELETE FROM play_tokens WHERE expires_at < now() RETURNING token_hash');
  const challenges = await db.query('DELETE FROM webauthn_challenges WHERE expires_at < now() RETURNING id');
  const guests = await db.query(
    `DELETE FROM accounts a
      WHERE a.kind = 'guest'
        AND a.created_at < now() - make_interval(days => $1)
        AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.account_id = a.id)
        AND NOT EXISTS (SELECT 1 FROM games g WHERE g.owner_id = a.id)
      RETURNING a.id`,
    [guestRetentionDays],
  );
  return {
    sessions: sessions.rows.length,
    playTokens: playTokens.rows.length,
    challenges: challenges.rows.length,
    guests: guests.rows.length,
  };
}
