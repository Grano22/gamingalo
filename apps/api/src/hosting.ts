import type { Channel, GameResponse } from '@gamingalo/contracts';
import type { Config } from './config';

/** The address a game is served from: its own subdomain of the games site, with `preview--` for previews. */
export function gameUrl(config: Config, gameId: string, channel: Channel = 'production'): string {
  const base = config.gamesBaseUrl;
  const label = channel === 'preview' ? `preview--${gameId}` : gameId;
  return `${base.protocol}//${label}.${base.host}/`;
}

/** Reads the game and channel from a request's host, or returns `undefined` for any other host. */
export function parseGameHost(config: Config, host: string | undefined): { gameId: string; channel: Channel } | undefined {
  if (!host) return undefined;
  const base = config.gamesBaseUrl;
  const suffix = `.${base.host}`;
  if (!host.endsWith(suffix)) return undefined;
  const label = host.slice(0, -suffix.length);
  if (!label || label.includes('.')) return undefined;
  if (label.startsWith('preview--')) return { gameId: label.slice('preview--'.length), channel: 'preview' };
  return { gameId: label, channel: 'production' };
}

/** Whether an origin belongs to a hosted game. Used to allow game requests to the game API. */
export function isGameOrigin(config: Config, origin: string | undefined): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return url.protocol === config.gamesBaseUrl.protocol && parseGameHost(config, url.host) !== undefined;
  } catch {
    return false;
  }
}

export interface GameRow {
  id: string;
  title: string;
  production_version: string | null;
  preview_version: string | null;
  created_at: Date;
}

export function describeGame(config: Config, row: GameRow): GameResponse {
  return {
    id: row.id,
    title: row.title,
    productionVersion: row.production_version,
    previewVersion: row.preview_version,
    url: gameUrl(config, row.id),
    previewUrl: gameUrl(config, row.id, 'preview'),
    createdAt: new Date(row.created_at).toISOString(),
  };
}
