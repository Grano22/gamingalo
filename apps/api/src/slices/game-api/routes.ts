import { playerProfileSchema } from '@gamingalo/contracts';
import type { FastifyInstance } from 'fastify';
import type { Database } from '../../db/database';
import { fail } from '../../errors';
import { bearerToken } from '../../auth/creators';
import { hashToken, isMinor } from '../../auth/sessions';

/**
 * Routes games call directly, from their own origin, with a play token. They never accept cookies,
 * and return only what a game needs, with a player ID that differs for each game.
 */
export function registerGameApiRoutes(app: FastifyInstance, database: Database): void {
  app.get('/v1/game/me', async (request) => {
    const token = bearerToken(request);
    if (!token) throw fail('UNAUTHENTICATED', 'This request needs a play token.');
    const { rows } = await database.query<{
      player_id: string;
      display_name: string;
      age_band: '16plus' | '13to15' | 'under13';
      kind: string;
    }>(
      `SELECT p.player_id, a.display_name, a.age_band, a.kind
         FROM play_tokens t
         JOIN accounts a ON a.id = t.account_id
         JOIN players p ON p.account_id = t.account_id AND p.game_id = t.game_id
        WHERE t.token_hash = $1 AND t.expires_at > now()`,
      [hashToken(token)],
    );
    const row = rows[0];
    if (!row) throw fail('UNAUTHENTICATED', 'This play token is not valid.');
    return playerProfileSchema.parse({
      playerId: row.player_id,
      displayName: row.display_name,
      minor: isMinor(row.age_band),
      guest: row.kind === 'guest',
    });
  });
}
