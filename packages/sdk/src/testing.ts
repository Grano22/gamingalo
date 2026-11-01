/**
 * Mock SDK for game makers' tests. Import from `@gamingalo/sdk/testing`.
 * This file must never be imported by `index.ts`: the build fails if mock code reaches production.
 */
import { GamingaloError } from '@gamingalo/errors';
import { snapshotOwn } from './config';
import { buildSdk, type GamingaloSdk } from './facade';
import { createMemoryCache } from './features/cache';
import { CONNECTION_STATES, type ConnectionState } from './features/connection';
import { FEATURE_NAMES, type FeatureName } from './features/discovery';
import type { EnvironmentInfo } from './features/environment';
import { createMemorySaveBackend } from './features/saves';
import { createMemoryStore } from './features/settings';
import { createMockStorageInfo } from './features/storage';
import { clone, freeze, hasOwn, SafeSet } from './primordials';

const NOT_ALLOWED_MESSAGE =
  'Mock mode is only available in a test context. It needs NODE_ENV=test, Vitest, Jest or a WebDriver-controlled browser.';

export interface MockOptions {
  /** Defaults to `mock-game`. */
  gameId?: string;
  /** Starting connection state. Defaults to `online`. */
  connection?: ConnectionState;
  /** Features reported as available. Defaults to the features that work in mock mode (`saves`). */
  features?: FeatureName[];
  /** Replaces top-level sections of the fixed mock environment. */
  environment?: Partial<EnvironmentInfo>;
}

/** Controls for simulating events in a test. */
export interface MockControls {
  setConnection(state: ConnectionState): void;
  suspend(): void;
  resume(): void;
  devicesChanged(): void;
}

export type MockGamingaloSdk = GamingaloSdk & { readonly mock: MockControls };

const MOCK_ENVIRONMENT: EnvironmentInfo = {
  browser: { name: 'chrome', version: '1' },
  platform: { os: 'mock', mobile: false, installedPwa: false },
  hardware: { cpuCores: 8, memoryGb: 8 },
  graphics: { webgpu: true, webgl2: true, adapter: 'unknown' },
  display: {
    width: 1920,
    height: 1080,
    pixelRatio: 1,
    colorDepth: 24,
    hdr: false,
    multipleDisplays: false,
    touch: false,
  },
  devices: { gamepads: 0, microphones: 0, cameras: 0, speakers: 0 },
  tier: 'high',
};

interface TestSignals {
  nodeEnv: unknown;
  vitest: unknown;
  jestWorker: unknown;
  webdriver: unknown;
}

function readSignals(): TestSignals {
  const process = (globalThis as { process?: { env?: Record<string, unknown> } }).process;
  const env = process?.env;
  const fromEnv = (name: string) => (env && hasOwn(env, name) ? env[name] : undefined);
  return {
    nodeEnv: fromEnv('NODE_ENV'),
    vitest: fromEnv('VITEST'),
    jestWorker: fromEnv('JEST_WORKER_ID'),
    webdriver: typeof navigator === 'undefined' ? undefined : navigator.webdriver,
  };
}

/**
 * Keeps mock mode out of real sessions by accident or misuse. It isn't a security boundary: a
 * production build has no mock code, and a mock instance can't reach anything real.
 */
export function isTestContext(signals: TestSignals = readSignals()): boolean {
  if (signals.nodeEnv === 'production') return false;
  return (
    signals.nodeEnv === 'test' || !!signals.vitest || signals.jestWorker !== undefined || signals.webdriver === true
  );
}

function invalid(details: string): GamingaloError {
  return new GamingaloError('INVALID_CONFIG', `Invalid mock options. ${details}`);
}

function includes(list: readonly string[], value: unknown): boolean {
  return typeof value === 'string' && list.includes(value);
}

/** Creates an independent mock SDK that touches no browser storage and makes no network requests. */
export async function createMockSdk(options: MockOptions = {}): Promise<MockGamingaloSdk> {
  if (!isTestContext()) throw new GamingaloError('MOCK_NOT_ALLOWED', NOT_ALLOWED_MESSAGE);

  const own = snapshotOwn(options);
  if (!own) throw invalid('Expected an object.');
  for (const name of Object.keys(own)) {
    if (!['gameId', 'connection', 'features', 'environment'].includes(name)) throw invalid(`Unknown option ${name}.`);
  }

  const connection = own['connection'] ?? 'online';
  if (!includes(CONNECTION_STATES, connection)) throw invalid('Unknown connection state.');

  const featureList = own['features'] ?? ['saves'];
  if (!Array.isArray(featureList) || !featureList.every((name) => includes(FEATURE_NAMES, name))) {
    throw invalid('Unknown feature.');
  }

  const features = new SafeSet<string>();
  for (const name of featureList as string[]) features.add(name);
  const overrides = snapshotOwn(own['environment']) ?? {};

  return buildSdk<{ mock: MockControls }>(
    {
      gameId: typeof own['gameId'] === 'string' ? own['gameId'] : 'mock-game',
      realm: freeze({ origin: 'mock', embedded: false, canvas: undefined }),
      connection: connection as ConnectionState,
      suspended: false,
      hasFeature: (name) => features.has(name),
      readEnvironment: async () => clone({ ...MOCK_ENVIRONMENT, ...overrides }),
      store: createMemoryStore(),
      cache: createMemoryCache(),
      saveBackend: features.has('saves') ? createMemorySaveBackend() : undefined,
      storage: createMockStorageInfo(),
      onShutdown: () => {},
    },
    (controls) => ({
      mock: freeze({
        setConnection(state: ConnectionState) {
          controls.assertActive();
          controls.setConnection(state);
        },
        suspend() {
          controls.assertActive();
          controls.suspend();
        },
        resume() {
          controls.assertActive();
          controls.resume();
        },
        devicesChanged() {
          controls.assertActive();
          controls.devicesChanged();
        },
      }),
    }),
  );
}

freeze(createMockSdk);
