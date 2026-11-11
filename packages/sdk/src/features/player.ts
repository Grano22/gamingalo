import { GamingaloError } from '@gamingalo/errors';
import { freeze, hasOwn } from '../primordials';

export interface PlayerProfile {
  /** Different for each game, so games can't link a player across games. */
  readonly playerId: string;
  readonly displayName: string;
  readonly minor: boolean;
  readonly guest: boolean;
}

/** The player signed in on the platform. Only works when the game runs inside the platform. */
export interface Player {
  /** `false` outside the platform, or without `platform` in `init`. */
  available(): boolean;
  /** Rejects with `UNAUTHENTICATED` if the platform has no signed-in player. */
  profile(): Promise<PlayerProfile>;
}

interface PlayToken {
  token: string;
  expiresAt: number;
  apiOrigin: string;
}

const TOKEN_WAIT_MS = 5000;
const REFRESH_MARGIN_MS = 60_000;

function own(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null && hasOwn(value, key) ? (value as Record<string, unknown>)[key] : undefined;
}

function parseToken(data: unknown): PlayToken | undefined {
  const token = own(data, 'token');
  const expiresAt = own(data, 'expiresAt');
  const apiOrigin = own(data, 'apiOrigin');
  if (typeof token !== 'string' || typeof expiresAt !== 'string' || typeof apiOrigin !== 'string') return undefined;
  let origin: string;
  try {
    const url = new URL(apiOrigin);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    origin = url.origin;
  } catch {
    return undefined;
  }
  const time = Date.parse(expiresAt);
  return Number.isFinite(time) ? { token, expiresAt: time, apiOrigin: origin } : undefined;
}

function parseProfile(data: unknown): PlayerProfile {
  const playerId = own(data, 'playerId');
  const displayName = own(data, 'displayName');
  const minor = own(data, 'minor');
  const guest = own(data, 'guest');
  if (typeof playerId !== 'string' || typeof displayName !== 'string' || typeof minor !== 'boolean' || typeof guest !== 'boolean') {
    throw new GamingaloError('INTERNAL', 'The platform sent an unexpected profile.');
  }
  return freeze({ playerId, displayName, minor, guest });
}

export interface BridgeOptions {
  platformOrigin: string;
  fetch: typeof fetch;
}

export interface PlatformBridge {
  api: Player;
  stop(): void;
}

/**
 * Talks to the platform page around the game. Messages are accepted only from the platform's
 * origin and the parent frame. The play token stays in this closure and is never given to game code.
 */
export function createPlatformBridge({ platformOrigin, fetch: fetchFn }: BridgeOptions): PlatformBridge {
  const parentWindow = typeof window !== 'undefined' && window.parent !== window ? window.parent : undefined;
  let current: PlayToken | undefined;
  let waiting: Array<(token: PlayToken) => void> = [];

  const ask = (type: 'gamingalo:ready' | 'gamingalo:token-request') => {
    parentWindow?.postMessage({ type }, platformOrigin);
  };

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== platformOrigin || event.source !== parentWindow) return;
    if (own(event.data, 'type') !== 'gamingalo:play-token') return;
    const token = parseToken(event.data);
    if (!token) return;
    current = token;
    const resolvers = waiting;
    waiting = [];
    resolvers.forEach((resolve) => resolve(token));
  };

  if (parentWindow) {
    window.addEventListener('message', onMessage);
    ask('gamingalo:ready');
  }

  const validToken = (): Promise<PlayToken> => {
    if (current && current.expiresAt - Date.now() > REFRESH_MARGIN_MS) return Promise.resolve(current);
    current = undefined;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        waiting = waiting.filter((candidate) => candidate !== settle);
        reject(new GamingaloError('UNAUTHENTICATED', 'The platform has no signed-in player.'));
      }, TOKEN_WAIT_MS);
      const settle = (token: PlayToken) => {
        clearTimeout(timer);
        resolve(token);
      };
      waiting.push(settle);
      ask('gamingalo:token-request');
    });
  };

  const request = async (token: PlayToken) => {
    try {
      return await fetchFn(`${token.apiOrigin}/v1/game/me`, {
        headers: { authorization: `Bearer ${token.token}` },
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
    } catch (cause) {
      throw new GamingaloError('NETWORK_OFFLINE', 'The platform could not be reached.', { cause });
    }
  };

  return {
    api: {
      available: () => !!parentWindow,
      async profile() {
        if (!parentWindow) throw new GamingaloError('FEATURE_UNAVAILABLE', 'The player is only available inside the platform.');
        let response = await request(await validToken());
        if (response.status === 401) {
          // The token expired or was revoked, so get a new one and try once more.
          current = undefined;
          response = await request(await validToken());
        }
        if (response.status === 401) throw new GamingaloError('UNAUTHENTICATED', 'The platform has no signed-in player.');
        if (!response.ok) throw new GamingaloError('SERVICE_UNAVAILABLE', 'The platform could not load the player.');
        return parseProfile(await response.json());
      },
    },
    stop() {
      if (parentWindow) window.removeEventListener('message', onMessage);
      current = undefined;
      waiting = [];
    },
  };
}
