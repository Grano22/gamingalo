// A real game page, built only from files the platform hosts. Placeholders are filled in by the test.
import { Gamingalo } from './sdk/index.js';

const lines = [];
try {
  void window.parent.document.cookie;
  lines.push('parent: readable');
} catch {
  lines.push('parent: blocked');
}
lines.push(`cookie: ${document.cookie || 'none'}`);

const sdk = await Gamingalo.init({ gameId: '__GAME_ID__', platform: { origin: '__PLATFORM_ORIGIN__' } });
try {
  const player = await sdk.player.profile();
  lines.push(`Hello ${player.displayName}`, `player id: ${player.playerId}`);
} catch (error) {
  lines.push(`player: ${error.code}`);
}
document.getElementById('out').textContent = lines.join('\n');
