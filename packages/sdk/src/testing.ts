/**
 * Mock SDK for game makers' tests. Import from `@gamingalo/sdk/testing`.
 * This file must never be imported by `index.ts`: the build fails if mock code reaches production.
 */
import { GamingaloError } from '@gamingalo/errors';
import { resolveConfig, snapshotOwn } from './config';
import { buildSdk, type GamingaloSdk } from './facade';
import {
  assertCanvasFilter,
  parseMirrorItems,
  type Accessibility,
  type AccessibilityPreferences,
  type CanvasFilter,
  type MirrorItem,
  type MirrorRole,
} from './features/accessibility';
import { createMemoryCache } from './features/cache';
import { createCanvasFilterLayers } from './features/canvas-filters';
import { createMemoryFiles } from './features/files';
import { CONNECTION_STATES, type ConnectionState } from './features/connection';
import { FEATURE_NAMES, type FeatureName } from './features/discovery';
import type { EnvironmentInfo } from './features/environment';
import type { GeolocationResult, KeyboardInfo } from './features/localization';
import { createSessionId, type Network, type NetworkMeasurement } from './features/network';
import { createMemorySaveBackend } from './features/saves';
import type { GamingaloPlugin } from './features/plugins';
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
  /** Features reported as available. Defaults to the features that work in mock mode (`saves`, `files`). */
  features?: FeatureName[];
  /** Replaces top-level sections of the fixed mock environment. */
  environment?: Partial<EnvironmentInfo>;
  /** Values returned by `network.measure()`. */
  network?: Partial<NetworkMeasurement>;
  /** Values reported by `sdk.localization`. */
  localization?: { languages?: string[]; timeZone?: string; keyboard?: KeyboardInfo; geolocation?: GeolocationResult };
  /** Plugins to test. */
  plugins?: ReadonlyArray<GamingaloPlugin<object>>;
}

/** Controls for simulating events in a test. */
export interface MockControls {
  setConnection(state: ConnectionState): void;
  suspend(): void;
  resume(): void;
  devicesChanged(): void;
  setNetwork(values: Partial<NetworkMeasurement>): void;
  /** The combined CSS filter that plugins have set. A mock has no canvas to apply it to. */
  canvasFilter(): string;
  readonly accessibility: MockAccessibilityControls;
}

/** Lets a test check what the game exposes to assistive technology. */
export interface MockAccessibilityControls {
  announcements(): string[];
  mirrorItems(): Array<{ id: string; role: MirrorRole; label: string }>;
  /** Simulates a player activating a button. Returns `false` if there's no such item. */
  activate(id: string): boolean;
  setPreferences(preferences: Partial<AccessibilityPreferences>): void;
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

function createMockAccessibility(): {
  api: Accessibility;
  controls: (notify: (preferences: AccessibilityPreferences) => void) => MockAccessibilityControls;
} {
  const announced: string[] = [];
  let items: MirrorItem[] = [];
  let filter: CanvasFilter = 'none';
  let preferences: AccessibilityPreferences = freeze({
    reducedMotion: false,
    contrast: 'no-preference',
    forcedColors: false,
    reducedTransparency: false,
  });

  return {
    api: {
      preferences: () => preferences,
      mirror: (list) => {
        items = parseMirrorItems(list);
      },
      focus: (id) => items.some((item) => item.id === id),
      announce: (text) => void announced.push(text),
      setCanvasFilter: (next) => {
        assertCanvasFilter(next);
        filter = next;
      },
      getCanvasFilter: () => filter,
      speak: () => true,
      stopSpeaking: () => {},
    },
    controls: (notify) =>
      freeze({
        announcements: () => [...announced],
        mirrorItems: () => items.map(({ id, role, label }) => ({ id, role, label })),
        activate: (id: string) => {
          const item = items.find((candidate) => candidate.id === id);
          if (!item) return false;
          item.onActivate?.();
          return true;
        },
        setPreferences: (next: Partial<AccessibilityPreferences>) => {
          preferences = freeze({ ...preferences, ...next });
          notify(preferences);
        },
      }),
  };
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
    if (!['gameId', 'connection', 'features', 'environment', 'network', 'plugins', 'localization'].includes(name)) throw invalid(`Unknown option ${name}.`);
  }

  const connection = own['connection'] ?? 'online';
  if (!includes(CONNECTION_STATES, connection)) throw invalid('Unknown connection state.');

  const featureList = own['features'] ?? ['saves', 'files'];
  if (!Array.isArray(featureList) || !featureList.every((name) => includes(FEATURE_NAMES, name))) {
    throw invalid('Unknown feature.');
  }

  const features = new SafeSet<string>();
  for (const name of featureList as string[]) features.add(name);
  const overrides = snapshotOwn(own['environment']) ?? {};
  const accessibility = createMockAccessibility();
  const gameId = typeof own['gameId'] === 'string' ? own['gameId'] : 'mock-game';
  const { plugins } = resolveConfig({ gameId, plugins: own['plugins'] });
  const filters = createCanvasFilterLayers(undefined);
  const locale = snapshotOwn(own['localization']) ?? {};
  const mockLanguages = (locale['languages'] as string[] | undefined) ?? ['en-US'];
  let currentConnection = connection as ConnectionState;
  let measurement: NetworkMeasurement = freeze({
    pingMs: 20,
    jitterMs: 2,
    lossPercent: 0,
    samples: 5,
    throughputMbps: 100,
    ...snapshotOwn(own['network']),
  });
  const sessionId = createSessionId();
  const network: Network = {
    get sessionId() {
      return sessionId;
    },
    info: () =>
      freeze({
        online: currentConnection !== 'offline',
        effectiveType: '4g',
        downlinkMbps: 100,
        rttMs: 20,
        saveData: false,
      }),
    measure: async () => measurement,
  };

  return buildSdk<{ mock: MockControls }>(
    {
      gameId,
      realm: freeze({ origin: 'mock', embedded: false, canvas: undefined }),
      connection: connection as ConnectionState,
      suspended: false,
      hasFeature: (name) => features.has(name),
      readEnvironment: async () => clone({ ...MOCK_ENVIRONMENT, ...overrides }),
      store: createMemoryStore(),
      cache: createMemoryCache(),
      saveBackend: features.has('saves') ? createMemorySaveBackend() : undefined,
      files: features.has('files') ? createMemoryFiles() : undefined,
      storage: createMockStorageInfo(),
      accessibility: accessibility.api,
      network,
      localeSource: {
        languages: () => mockLanguages,
        timeZone: () => (locale['timeZone'] as string | undefined) ?? 'UTC',
        keyboard: async () =>
          (locale['keyboard'] as KeyboardInfo | undefined) ?? freeze({ layout: 'qwerty', keys: freeze({}) }),
        geolocation: async () => (locale['geolocation'] as GeolocationResult | undefined) ?? freeze({ status: 'denied' }),
      },
      filters,
      plugins,
      onShutdown: () => {},
    },
    (controls) => ({
      mock: freeze({
        setConnection(state: ConnectionState) {
          controls.assertActive();
          currentConnection = state;
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
        setNetwork(values: Partial<NetworkMeasurement>) {
          controls.assertActive();
          measurement = freeze({ ...measurement, ...values });
        },
        canvasFilter() {
          controls.assertActive();
          return filters.composed();
        },
        accessibility: accessibility.controls(controls.accessibilityChanged),
      }),
    }),
  );
}

freeze(createMockSdk);
