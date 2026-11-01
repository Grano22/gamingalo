import { GamingaloError } from '@gamingalo/errors';
import { arrayFrom, createObject, freeze, hasOwn, isArray, matches, objectKeys } from './primordials';
import type { RealmOptions } from './realm';

export interface GamingaloConfig {
  /** Lowercase letters, digits and hyphens. */
  gameId: string;
  /** Restricts where this SDK can run. See `RealmOptions`. */
  realm?: RealmOptions;
}

export interface ResolvedConfig {
  readonly gameId: string;
  readonly realm: RealmOptions | undefined;
}

const GAME_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;
const CONFIG_KEYS = freeze({ __proto__: null, gameId: true, realm: true });
const REALM_KEYS = freeze({ __proto__: null, origins: true, frame: true, canvas: true });
const FRAMES = freeze({ __proto__: null, top: true, embedded: true, any: true });

/**
 * Copies own properties once into an object with no prototype, so a polluted `Object.prototype`
 * can't supply options, and later changes or getters can't alter what was checked.
 */
export function snapshotOwn(input: unknown): Record<string, unknown> | undefined {
  if (typeof input !== 'object' || input === null) return undefined;
  const snapshot = createObject(null) as Record<string, unknown>;
  const names = objectKeys(input);
  for (let index = 0; index < names.length; index++) {
    const name = names[index] as string;
    snapshot[name] = (input as Record<string, unknown>)[name];
  }
  return snapshot;
}

function invalid(details: string): GamingaloError {
  return new GamingaloError('INVALID_CONFIG', `Invalid SDK configuration. ${details}`);
}

function assertKnownKeys(values: Record<string, unknown>, allowed: object, path: string): void {
  const names = objectKeys(values);
  for (let index = 0; index < names.length; index++) {
    const name = names[index] as string;
    if (!hasOwn(allowed, name)) throw invalid(`${path}${name}: unknown option`);
  }
}

function resolveRealmOptions(input: unknown): RealmOptions | undefined {
  if (input === undefined) return undefined;
  const realm = snapshotOwn(input);
  if (!realm) throw invalid('realm: expected an object');
  assertKnownKeys(realm, REALM_KEYS, 'realm.');

  const { origins, frame } = realm;
  if (origins !== undefined) {
    if (!isArray(origins)) throw invalid('realm.origins: expected a list of strings');
    // Copied so that the list checked here is the list used later.
    const copy = freeze(arrayFrom(origins as unknown[]));
    for (let index = 0; index < copy.length; index++) {
      if (typeof copy[index] !== 'string') throw invalid('realm.origins: expected a list of strings');
    }
    realm['origins'] = copy;
  }
  if (frame !== undefined && (typeof frame !== 'string' || !hasOwn(FRAMES, frame))) {
    throw invalid('realm.frame: expected top, embedded or any');
  }
  return freeze(realm) as RealmOptions;
}

/**
 * Hand-written rather than using Zod, because this code must not read inherited properties
 * and Zod's parsers do. See D-22.
 */
export function resolveConfig(input: unknown): ResolvedConfig {
  const config = snapshotOwn(input);
  if (!config) throw invalid('config: expected an object');
  assertKnownKeys(config, CONFIG_KEYS, '');

  const gameId = config['gameId'];
  if (typeof gameId !== 'string' || !matches(GAME_ID_PATTERN, gameId)) {
    throw invalid('gameId: expected lowercase letters, digits and hyphens');
  }
  return freeze({ gameId, realm: resolveRealmOptions(config['realm']) });
}
