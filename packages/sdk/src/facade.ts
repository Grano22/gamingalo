import { GamingaloError } from '@gamingalo/errors';
import type { GamingaloConfig, GamingaloMode, ResolvedConfig } from './config';
import { resolveConfig } from './config';
import { readBrowserConnection, watchBrowserConnection, type ConnectionState } from './features/connection';
import { createGameCache, createMemoryCache, type GameCache } from './features/cache';
import type { Features } from './features/discovery';
import { MOCK_ENVIRONMENT, readEnvironment, watchDevices, type Environment } from './features/environment';
import { isPageHidden, watchPageLifecycle } from './features/lifecycle';
import { createSessionMemory, type SessionMemory } from './features/session';
import {
  createMemoryStore,
  createSettings,
  getBrowserStore,
  type GraphicsSettings,
  type Settings,
} from './features/settings';

export interface SdkEventMap {
  suspend: undefined;
  resume: undefined;
  connection: ConnectionState;
  /** A gamepad or media device was added or removed. Call `environment.read()` for current values. */
  devices: undefined;
  /** The graphics preset changed. The game applies the recommended values to its renderer. */
  graphics: GraphicsSettings;
}

export type SdkEventHandler<E extends keyof SdkEventMap> = (payload: SdkEventMap[E]) => void;

export interface Connection {
  readonly state: ConnectionState;
}

/** Test controls, available only in mock mode. */
export interface MockControls {
  setConnection(state: ConnectionState): void;
  suspend(): void;
  resume(): void;
  devicesChanged(): void;
}

export interface GamingaloSdk {
  readonly gameId: string;
  readonly mode: GamingaloMode;
  readonly features: Features;
  readonly connection: Connection;
  readonly environment: Environment;
  readonly settings: Settings;
  readonly session: SessionMemory;
  readonly cache: GameCache;
  /** `undefined` unless `mode` is `mock`. */
  readonly mock: MockControls | undefined;
  /** Subscribes to an event and returns a function that unsubscribes. */
  on<E extends keyof SdkEventMap>(event: E, handler: SdkEventHandler<E>): () => void;
  /** Stops the SDK. Calling it again does nothing. Every other member then throws `SDK_NOT_INITIALIZED`. */
  shutdown(): Promise<void>;
}

/**
 * The facade only connects plain feature functions from `features/` and holds
 * per-session state. Feature logic belongs in the feature modules.
 */
class Facade implements GamingaloSdk {
  readonly #config: ResolvedConfig;
  readonly #onShutdown: () => void;
  readonly #handlers = new Map<keyof SdkEventMap, Set<(payload: never) => void>>();
  readonly #stopWatching: Array<() => void> = [];
  #active = true;
  #connection: ConnectionState;
  #suspended: boolean;

  readonly #api: Pick<
    GamingaloSdk,
    'features' | 'connection' | 'environment' | 'settings' | 'session' | 'cache' | 'mock'
  >;

  constructor(config: ResolvedConfig, onShutdown: () => void) {
    this.#config = config;
    this.#onShutdown = onShutdown;

    const mocked = config.mode === 'mock';
    // Browser state is ignored in mock mode so that tests stay deterministic.
    this.#connection = mocked ? config.mock.connection : readBrowserConnection();
    this.#suspended = mocked ? false : isPageHidden();

    if (!mocked) {
      this.#stopWatching.push(
        watchBrowserConnection((state) => this.#setConnection(state)),
        watchPageLifecycle(
          () => this.#suspend(),
          () => this.#resume(),
        ),
        watchDevices(() => this.#emit('devices', undefined)),
      );
    }

    const setConnection = (state: ConnectionState) => this.#setConnection(state);
    const getConnection = () => this.#connection;
    const read = async () =>
      mocked ? structuredClone({ ...MOCK_ENVIRONMENT, ...config.mock.environment }) : readEnvironment();

    this.#api = {
      features: this.#guard<Features>({
        has: (name) => (config.mock.features as string[]).includes(name),
      }),
      connection: this.#guard<Connection>({
        get state() {
          return getConnection();
        },
      }),
      environment: this.#guard<Environment>({ read }),
      settings: this.#guard<Settings>(
        createSettings({
          gameId: config.gameId,
          store: mocked ? createMemoryStore() : getBrowserStore(),
          readTier: async () => (await read()).tier,
          onGraphicsChange: (graphics) => this.#emit('graphics', graphics),
        }),
      ),
      session: this.#guard(createSessionMemory()),
      cache: this.#guard(mocked ? createMemoryCache() : createGameCache(config.gameId)),
      mock: mocked
        ? this.#guard<MockControls>({
            setConnection,
            suspend: () => this.#suspend(),
            resume: () => this.#resume(),
            devicesChanged: () => this.#emit('devices', undefined),
          })
        : undefined,
    };
  }

  get gameId(): string {
    this.#assertActive();
    return this.#config.gameId;
  }

  get mode(): GamingaloMode {
    this.#assertActive();
    return this.#config.mode;
  }

  get features(): Features {
    this.#assertActive();
    return this.#api.features;
  }

  get connection(): Connection {
    this.#assertActive();
    return this.#api.connection;
  }

  get environment(): Environment {
    this.#assertActive();
    return this.#api.environment;
  }

  get settings(): Settings {
    this.#assertActive();
    return this.#api.settings;
  }

  get session(): SessionMemory {
    this.#assertActive();
    return this.#api.session;
  }

  get cache(): GameCache {
    this.#assertActive();
    return this.#api.cache;
  }

  get mock(): MockControls | undefined {
    this.#assertActive();
    return this.#api.mock;
  }

  on<E extends keyof SdkEventMap>(event: E, handler: SdkEventHandler<E>): () => void {
    this.#assertActive();
    let handlers = this.#handlers.get(event);
    if (!handlers) {
      handlers = new Set();
      this.#handlers.set(event, handlers);
    }
    const registered = handlers;
    registered.add(handler as (payload: never) => void);
    return () => {
      registered.delete(handler as (payload: never) => void);
    };
  }

  async shutdown(): Promise<void> {
    if (!this.#active) return;
    this.#active = false;
    this.#stopWatching.forEach((stop) => stop());
    this.#handlers.clear();
    this.#onShutdown();
  }

  /** Makes a feature API throw `SDK_NOT_INITIALIZED` once the SDK has been shut down. */
  #guard<T extends object>(api: T): T {
    return new Proxy(api, {
      get: (target, key) => {
        this.#assertActive();
        const value: unknown = Reflect.get(target, key);
        if (typeof value !== 'function') return value;
        return (...args: unknown[]) => {
          this.#assertActive();
          return value.apply(target, args);
        };
      },
    });
  }

  #assertActive(): void {
    if (!this.#active) {
      throw new GamingaloError('SDK_NOT_INITIALIZED', 'The SDK has been shut down. Call Gamingalo.init() again.');
    }
  }

  #setConnection(state: ConnectionState): void {
    if (state === this.#connection) return;
    this.#connection = state;
    this.#emit('connection', state);
  }

  #suspend(): void {
    if (this.#suspended) return;
    this.#suspended = true;
    this.#emit('suspend', undefined);
  }

  #resume(): void {
    if (!this.#suspended) return;
    this.#suspended = false;
    this.#emit('resume', undefined);
  }

  #emit<E extends keyof SdkEventMap>(event: E, payload: SdkEventMap[E]): void {
    for (const handler of [...(this.#handlers.get(event) ?? [])]) {
      try {
        (handler as SdkEventHandler<E>)(payload);
      } catch (error) {
        // A bug in one game handler must not stop the others or break the SDK.
        console.error(`[gamingalo] "${event}" handler failed`, error);
      }
    }
  }
}

let current: { key: string; sdk: Facade } | undefined;

export const Gamingalo = {
  /**
   * Starts the SDK. Calling it again with the same configuration returns the same
   * instance. It does not fail because the player is offline.
   */
  async init(config: GamingaloConfig): Promise<GamingaloSdk> {
    const resolved = resolveConfig(config);
    const key = JSON.stringify(resolved);

    if (current) {
      if (current.key === key) return current.sdk;
      throw new GamingaloError(
        'SDK_ALREADY_INITIALIZED',
        'The SDK is already running with a different configuration. Call shutdown() first.',
      );
    }

    const sdk = new Facade(resolved, () => {
      current = undefined;
    });
    current = { key, sdk };
    return sdk;
  },

  /** Returns the running instance, or throws `SDK_NOT_INITIALIZED`. */
  instance(): GamingaloSdk {
    if (!current) {
      throw new GamingaloError('SDK_NOT_INITIALIZED', 'Call Gamingalo.init() before using the SDK.');
    }
    return current.sdk;
  },
};
