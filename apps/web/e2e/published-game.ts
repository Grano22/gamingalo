import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Shared between the publish setup and the tests that play the game. */
export const PUBLISHED_GAME_FILE = join(tmpdir(), 'gamingalo-e2e-published-game.json');

export function publishedGame(): { id: string; title: string } {
  return JSON.parse(readFileSync(PUBLISHED_GAME_FILE, 'utf8')) as { id: string; title: string };
}
