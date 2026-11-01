import { GamingaloError } from '@gamingalo/errors';
import type { GamingaloConfig, GamingaloMode, ResolvedConfig } from './config';
import { resolveConfig } from './config';
import { readBrowserConnection, watchBrowserConnection, type ConnectionState } from './connection';
import { MOCK_ENVIRONMENT, readEnvironment, watchDevices, type Environment } from './environment';
import type { Features } from './features';
import { isPageHidden, watchPageLifecycle } from './lifecycle';

export interface SdkEventMap {
  suspend: undefined;
  resume: undefined;
  connection: ConnectionState;
  /** A gamepad or media device was added or removed. Call `environment.read()` for current values. */
  devices: undefined;
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
  /** `undefined` unless `mode` is `mock`. */
  readonly mock: MockControls | undefined;
  /** Subscribes to an event and returns a function that unsubscribes. */
  on<E extends keyof SdkEventMap>(event: E, handler: SdkEventHandler<E>): () => void;
  /** Stops the SDK. Calling it again does nothing. Every other member then throws `SDK_NOT_INITIALIZED`. */
  shutdown(): Promise<void>;
}

class SdkInstance implements GamingaloSdk {
  readonly #config: ResolvedConfig;
  readonly #onShutdown: () => void;
  readonly #handlers = new Map<keyof SdkEventMap, Set<(payload: never) => void>>();
  readonly #stopWatching: Array<() => void> = [];
  readonly #mockControls: MockControls | undefined;
  #active = true;
  #connection: ConnectionState;
  #suspended: boolean;

  constructor(config: ResolvedConfig, onShutdown: () => void) {
    this.#config = config;
    this.#onShutdown = onShutdown;

    if (config.mode === 'mock') {
      // Browser state is ignored so that tests stay deterministic.
      this.#connection = config.mock.connection;
      this.#suspended = false;
      this.#mockControls = {
        setConnection: (state) => {
          this.#assertActive();
          this.#setConnection(state);
        },
        suspend: () => {
          this.#assertActive();
          this.#suspend();
        },
        resume: () => {
          this.#assertActive();
          this.#resume();
        },
        devicesChanged: () => {
          this.#assertActive();
          this.#emit('devices', undefined);
        },
      };
    } else {
      this.#connection = readBrowserConnection();
      this.#suspended = isPageHidden();
      this.#mockControls = undefined;
      this.#stopWatching.push(
        watchBrowserConnection((state) => this.#setConnection(state)),
        watchPageLifecycle(
          () => this.#suspend(),
          () => this.#resume(),
        ),
        watchDevices(() => this.#emit('devices', undefined)),
      );
    }
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
    return {
      has: (name) => {
        this.#assertActive();
        return (this.#config.mock.features as string[]).includes(name);
      },
    };
  }

  get connection(): Connection {
    this.#assertActive();
    const read = () => {
      this.#assertActive();
      return this.#connection;
    };
    return {
      get state() {
        return read();
      },
    };
  }

  get environment(): Environment {
    this.#assertActive();
    return {
      read: async () => {
        this.#assertActive();
        if (this.#config.mode === 'mock') {
          return structuredClone({ ...MOCK_ENVIRONMENT, ...this.#config.mock.environment });
        }
        return readEnvironment();
      },
    };
  }

  get mock(): MockControls | undefined {
    this.#assertActive();
    return this.#mockControls;
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

let current: { key: string; sdk: SdkInstance } | undefined;

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

    const sdk = new SdkInstance(resolved, () => {
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
