import { GamingaloError } from '@gamingalo/errors';
import type { Accessibility, AccessibilityPreferences } from './features/accessibility';
import type { GameCache } from './features/cache';
import type { GameFiles } from './features/files';
import type { ConnectionState } from './features/connection';
import type { Features } from './features/discovery';
import type { Environment, EnvironmentInfo } from './features/environment';
import { createSaves, type SaveBackend, type Saves } from './features/saves';
import { createSessionMemory, type SessionMemory } from './features/session';
import { createSettings, type GraphicsSettings, type KeyValueStore, type Settings } from './features/settings';
import type { StorageInfo } from './features/storage';
import {
  createObject,
  defineProperty,
  freeze,
  guardApi,
  hasOwn,
  ownDescriptor,
  ownKeys,
  reflectApply,
  SafeMap,
  SafeSet,
} from './primordials';
import type { RealmInfo } from './realm';

export interface SdkEventMap {
  suspend: undefined;
  resume: undefined;
  connection: ConnectionState;
  /** A gamepad or media device was added or removed. Call `environment.read()` for current values. */
  devices: undefined;
  /** The graphics preset changed. The game applies the recommended values to its renderer. */
  graphics: GraphicsSettings;
  /** A player's accessibility preference changed. */
  accessibility: AccessibilityPreferences;
}

export type SdkEventHandler<E extends keyof SdkEventMap> = (payload: SdkEventMap[E]) => void;

export interface Connection {
  readonly state: ConnectionState;
}

/** The public SDK reference. It and every feature API are frozen, with no prototype. */
export interface GamingaloSdk {
  readonly gameId: string;
  readonly realm: RealmInfo;
  readonly features: Features;
  readonly connection: Connection;
  readonly environment: Environment;
  readonly settings: Settings;
  readonly session: SessionMemory;
  readonly cache: GameCache;
  /** Throws `FEATURE_UNAVAILABLE` when `features.has('saves')` is `false`. */
  readonly saves: Saves;
  /** Throws `FEATURE_UNAVAILABLE` when `features.has('files')` is `false`. */
  readonly files: GameFiles;
  readonly storage: StorageInfo;
  readonly accessibility: Accessibility;
  /** Subscribes to an event and returns a function that unsubscribes. */
  on<E extends keyof SdkEventMap>(event: E, handler: SdkEventHandler<E>): () => void;
  /** Stops the SDK. Calling it again does nothing. Every other member then throws `SDK_NOT_INITIALIZED`. */
  shutdown(): Promise<void>;
}

/** What an entry point supplies. The facade doesn't know whether it's running for real or in a test. */
export interface SdkParts {
  gameId: string;
  realm: RealmInfo;
  connection: ConnectionState;
  suspended: boolean;
  hasFeature: (name: string) => boolean;
  readEnvironment: () => Promise<EnvironmentInfo>;
  store: KeyValueStore | undefined;
  cache: GameCache;
  saveBackend: SaveBackend | undefined;
  files: GameFiles | undefined;
  storage: StorageInfo;
  accessibility: Accessibility;
  onShutdown: () => void;
}

/** Controls for the entry point that built the SDK. Never given to game code directly. */
export interface SdkControls {
  setConnection(state: ConnectionState): void;
  suspend(): void;
  resume(): void;
  devicesChanged(): void;
  accessibilityChanged(preferences: AccessibilityPreferences): void;
  addCleanup(cleanup: () => void): void;
  assertActive(): void;
}

const EVENT_NAMES = freeze({
  __proto__: null,
  suspend: true,
  resume: true,
  connection: true,
  devices: true,
  graphics: true,
  accessibility: true,
});

/**
 * Connects plain feature functions into one frozen reference. All state lives in this closure,
 * so there is no class, prototype or property that a script could reach or replace.
 * `extend` lets an entry point add members before the reference is frozen.
 */
export function buildSdk<Extra extends object = object>(
  parts: SdkParts,
  extend?: (controls: SdkControls) => Extra,
): GamingaloSdk & Extra {
  const handlers = new SafeMap<keyof SdkEventMap, Set<(payload: never) => void>>();
  const cleanups = new SafeSet<() => void>();
  let active = true;
  let connection = parts.connection;
  let suspended = parts.suspended;

  const assertActive = () => {
    if (!active) {
      throw new GamingaloError('SDK_NOT_INITIALIZED', 'The SDK has been shut down. Call Gamingalo.init() again.');
    }
  };

  const emit = <E extends keyof SdkEventMap>(event: E, payload: SdkEventMap[E]) => {
    handlers.get(event)?.forEach((handler) => {
      try {
        reflectApply(handler as (payload: unknown) => void, undefined, [payload]);
      } catch (error) {
        // A bug in one game handler must not stop the others or break the SDK.
        console.error(`[gamingalo] "${event}" handler failed`, error);
      }
    });
  };

  const controls: SdkControls = freeze<SdkControls>({
    setConnection: (state) => {
      if (state === connection) return;
      connection = state;
      emit('connection', state);
    },
    suspend: () => {
      if (suspended) return;
      suspended = true;
      emit('suspend', undefined);
    },
    resume: () => {
      if (!suspended) return;
      suspended = false;
      emit('resume', undefined);
    },
    devicesChanged: () => emit('devices', undefined),
    accessibilityChanged: (preferences) => emit('accessibility', preferences),
    addCleanup: (cleanup) => void cleanups.add(cleanup),
    assertActive,
  });

  const guard = <T extends object>(api: T) => guardApi(api, assertActive);

  const features = guard<Features>({ has: (name) => parts.hasFeature(name) });
  const connectionApi = guard<Connection>({
    get state() {
      return connection;
    },
  });
  const environment = guard<Environment>({ read: () => parts.readEnvironment() });
  const settings = guard(
    createSettings({
      gameId: parts.gameId,
      store: parts.store,
      readTier: async () => (await parts.readEnvironment()).tier,
      onGraphicsChange: (graphics) => emit('graphics', graphics),
    }),
  );
  const session = guard(createSessionMemory());
  const cache = guard(parts.cache);
  const storage = guard(parts.storage);
  const accessibility = guard(parts.accessibility);
  const { saveBackend } = parts;
  const saves =
    saveBackend && guard(createSaves({ gameId: parts.gameId, backend: saveBackend, markers: parts.store }));
  if (saveBackend) cleanups.add(() => saveBackend.close());
  const files = parts.files && guard(parts.files);

  const api = {
    get gameId() {
      return parts.gameId;
    },
    get realm() {
      return parts.realm;
    },
    get features() {
      return features;
    },
    get connection() {
      return connectionApi;
    },
    get environment() {
      return environment;
    },
    get settings() {
      return settings;
    },
    get session() {
      return session;
    },
    get cache() {
      return cache;
    },
    get saves() {
      if (!saves) {
        throw new GamingaloError('FEATURE_UNAVAILABLE', 'Saves need IndexedDB, which this environment does not provide.');
      }
      return saves;
    },
    get files() {
      if (!files) {
        throw new GamingaloError('FEATURE_UNAVAILABLE', 'Files need OPFS, which this environment does not provide.');
      }
      return files;
    },
    get storage() {
      return storage;
    },
    get accessibility() {
      return accessibility;
    },
    on<E extends keyof SdkEventMap>(event: E, handler: SdkEventHandler<E>): () => void {
      if (!hasOwn(EVENT_NAMES, event) || typeof handler !== 'function') {
        throw new GamingaloError('INVALID_ARGUMENT', 'on() needs a known event name and a handler function.');
      }
      let registered = handlers.get(event);
      if (!registered) {
        registered = new SafeSet();
        handlers.set(event, registered);
      }
      const set = registered;
      set.add(handler as (payload: never) => void);
      return freeze(() => {
        set.delete(handler as (payload: never) => void);
      });
    },
    async shutdown(): Promise<void> {
      if (!active) return;
      active = false;
      cleanups.forEach((cleanup) => cleanup());
      cleanups.clear();
      handlers.clear();
      parts.onShutdown();
    },
  };

  const extra = extend?.(controls);
  const complete = createObject(null) as typeof api & Extra;
  copyMembers(complete, api);
  if (extra) copyMembers(complete, extra);
  return guardApi(complete, assertActive, 'shutdown');
}

function copyMembers(target: object, source: object): void {
  for (const key of ownKeys(source)) defineProperty(target, key, ownDescriptor(source, key));
}
