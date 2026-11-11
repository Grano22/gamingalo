import { GamingaloError } from '@gamingalo/errors';
import { arrayFrom, createObject, freeze, hasOwn, isArray, matches, objectKeys } from './primordials';
import type { GamingaloPlugin } from './features/plugins';
import type { RealmOptions } from './realm';

export interface GamingaloConfig {
  /** Lowercase letters, digits and hyphens. */
  gameId: string;
  /** Restricts where this SDK can run. See `RealmOptions`. */
  realm?: RealmOptions;
  /** Optional modules, available through `sdk.use(plugin)`. */
  plugins?: ReadonlyArray<GamingaloPlugin<object>>;
  /** Built-in modules to load, which keeps them out of the core download for games that don't use them. */
  modules?: readonly SdkModule[];
  /** The Gamingalo platform that embeds this game, for `sdk.player`. Messages from any other origin are ignored. */
  platform?: { origin: string };
}

export type SdkModule = 'localization' | 'accessibility';

export interface ResolvedConfig {
  readonly gameId: string;
  readonly realm: RealmOptions | undefined;
  readonly plugins: readonly ResolvedPlugin[];
  readonly modules: readonly SdkModule[];
  readonly platformOrigin: string | undefined;
}

/** The original object is kept as the key for `sdk.use`, and its fields are read once. */
export interface ResolvedPlugin {
  readonly plugin: object;
  readonly name: string;
  readonly setup: GamingaloPlugin<object>['setup'];
}

const GAME_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;
const PLUGIN_NAME_PATTERN = /^[a-z0-9@][a-z0-9@/_-]{0,127}$/;
const CONFIG_KEYS = freeze({ __proto__: null, gameId: true, realm: true, plugins: true, modules: true, platform: true });
const MODULES = freeze({ __proto__: null, localization: true, accessibility: true });
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

function resolvePlugins(input: unknown): readonly ResolvedPlugin[] {
  if (input === undefined) return freeze([]);
  if (!isArray(input)) throw invalid('plugins: expected a list');
  const list = arrayFrom(input as unknown[]);
  const resolved: ResolvedPlugin[] = [];
  for (let index = 0; index < list.length; index++) {
    const plugin = list[index];
    const own = snapshotOwn(plugin);
    if (!own) throw invalid('plugins: each plugin must be an object');
    const { name, setup } = own;
    if (typeof name !== 'string' || !matches(PLUGIN_NAME_PATTERN, name)) throw invalid('plugins: invalid plugin name');
    if (typeof setup !== 'function') throw invalid(`plugins: "${name}" needs a setup function`);
    for (let earlier = 0; earlier < index; earlier++) {
      if ((resolved[earlier] as ResolvedPlugin).name === name) throw invalid(`plugins: "${name}" is listed twice`);
    }
    resolved[index] = freeze({ plugin: plugin as object, name, setup: setup as ResolvedPlugin['setup'] });
  }
  return freeze(resolved);
}

function resolveModules(input: unknown): readonly SdkModule[] {
  if (input === undefined) return freeze([]);
  if (!isArray(input)) throw invalid('modules: expected a list');
  const list = arrayFrom(input as unknown[]);
  const modules: SdkModule[] = [];
  for (let index = 0; index < list.length; index++) {
    const name = list[index];
    if (typeof name !== 'string' || !hasOwn(MODULES, name)) throw invalid('modules: expected localization or accessibility');
    if (!modules.includes(name as SdkModule)) modules[modules.length] = name as SdkModule;
  }
  return freeze(modules);
}

function resolvePlatformOrigin(input: unknown): string | undefined {
  if (input === undefined) return undefined;
  const platform = snapshotOwn(input);
  if (!platform) throw invalid('platform: expected an object');
  assertKnownKeys(platform, freeze({ __proto__: null, origin: true }), 'platform.');
  const origin = platform['origin'];
  let parsed: URL | undefined;
  try {
    parsed = typeof origin === 'string' ? new URL(origin) : undefined;
  } catch {
    parsed = undefined;
  }
  // Exactly an origin, so that comparing it with a message's origin is exact.
  if (!parsed || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || parsed.origin !== origin) {
    throw invalid('platform.origin: expected an origin such as https://play.example');
  }
  return parsed.origin;
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
  return freeze({
    gameId,
    realm: resolveRealmOptions(config['realm']),
    plugins: resolvePlugins(config['plugins']),
    modules: resolveModules(config['modules']),
    platformOrigin: resolvePlatformOrigin(config['platform']),
  });
}
