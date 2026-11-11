import { GamingaloError } from '@gamingalo/errors';
import { resolveConfig, type GamingaloConfig } from './config';
import { buildSdk, type GamingaloSdk } from './facade';
import { createGameCache } from './features/cache';
import { createCanvasFilterLayers } from './features/canvas-filters';
import { readBrowserConnection, watchBrowserConnection } from './features/connection';
import { readEnvironment, watchDevices } from './features/environment';
import { getBrowserFiles } from './features/files';
import { isPageHidden, watchPageLifecycle } from './features/lifecycle';
import { createNetwork, createSessionId } from './features/network';
import { createPlatformBridge } from './features/player';
import { getBrowserSaveBackend } from './features/saves';
import { getBrowserStore } from './features/settings';
import { createBrowserStorageInfo } from './features/storage';
import { createObject, defineProperty, freeze } from './primordials';
import { resolveRealm } from './realm';

/** The SDK's own version, set at build time. */
export const SDK_VERSION: string = __SDK_VERSION__;

/**
 * The format of everything the SDK keeps in the browser. It's written once per game, so that a
 * later SDK knows which version wrote the stored data, and can migrate it step by step.
 */
export const STORAGE_FORMAT_VERSION = 1;

function recordStorageFormat(store: ReturnType<typeof getBrowserStore>, gameId: string): void {
  try {
    const key = `gamingalo:${gameId}:format`;
    if (store && store.getItem(key) === null) store.setItem(key, String(STORAGE_FORMAT_VERSION));
  } catch {
    // Blocked or full storage. The format can still be told apart, as data written without a marker is version 1.
  }
}

export interface GamingaloEntry {
  /** The SDK's version. */
  readonly version: string;
  /**
   * Starts the SDK and returns the only reference to it in this realm. There is no way to look it
   * up later, so keep it private. Rejects with `SDK_ALREADY_INITIALIZED` while it's running, which
   * a game should treat as a sign that another script got there first. It does not fail because
   * the player is offline.
   */
  init(config: GamingaloConfig): Promise<GamingaloSdk>;
}

let running = false;
// Captured when the SDK loads, so replacing `fetch` later can't intercept measurements.
const nativeFetch = globalThis.fetch;
const capturedFetch: typeof fetch = (input, init) => nativeFetch(input, init);

async function init(config: GamingaloConfig): Promise<GamingaloSdk> {
  const { gameId, realm: realmOptions, plugins, modules, platformOrigin } = resolveConfig(config);
  if (running) {
    throw new GamingaloError(
      'SDK_ALREADY_INITIALIZED',
      'The SDK is already running in this realm. Only its holder can shut it down and start it again.',
    );
  }
  const realm = resolveRealm(realmOptions);

  // Claimed before loading modules, so that a second `init` can't start while this one waits.
  running = true;
  let loaded: [typeof import('./features/accessibility') | undefined, typeof import('./features/localization') | undefined];
  try {
    loaded = await Promise.all([
      modules.includes('accessibility') ? import('./features/accessibility') : undefined,
      modules.includes('localization') ? import('./features/localization') : undefined,
    ]);
  } catch (cause) {
    running = false;
    throw new GamingaloError('FEATURE_UNAVAILABLE', 'An SDK module failed to load. Check the network and try again.', {
      cause,
    });
  }
  const [accessibilityModule, localizationModule] = loaded;

  const store = getBrowserStore();
  recordStorageFormat(store, gameId);
  const saveBackend = getBrowserSaveBackend(gameId);
  const files = getBrowserFiles(gameId);
  const filters = createCanvasFilterLayers(realm.canvas);
  const accessibility = accessibilityModule?.createBrowserAccessibility(realm.canvas, filters);
  const bridge = platformOrigin ? createPlatformBridge({ platformOrigin, fetch: capturedFetch }) : undefined;
  const available = (name: string) =>
    (name === 'saves' && !!saveBackend) ||
    (name === 'files' && !!files) ||
    (name === 'accessibility' && !!accessibility) ||
    (name === 'localization' && !!localizationModule) ||
    (name === 'player' && !!bridge?.api.available());

  return buildSdk(
    {
      gameId,
      realm,
      connection: readBrowserConnection(),
      suspended: isPageHidden(),
      hasFeature: available,
      readEnvironment,
      store,
      cache: createGameCache(gameId),
      saveBackend,
      files,
      storage: createBrowserStorageInfo(),
      accessibility: accessibility?.api,
      network: createNetwork(capturedFetch, createSessionId()),
      player: bridge?.api,
      localization:
        localizationModule &&
        ((onLocaleChange) =>
          localizationModule.createLocalization({
            gameId,
            store,
            source: localizationModule.createBrowserLocaleSource(),
            onLocaleChange,
          })),
      filters,
      plugins,
      onShutdown: () => {
        running = false;
      },
    },
    (controls) => {
      controls.addCleanup(watchBrowserConnection(controls.setConnection));
      controls.addCleanup(watchPageLifecycle(controls.suspend, controls.resume));
      controls.addCleanup(watchDevices(controls.devicesChanged));
      if (accessibilityModule && accessibility) {
        controls.addCleanup(accessibilityModule.watchAccessibilityPreferences(controls.accessibilityChanged));
      }
      if (bridge) controls.addCleanup(bridge.stop);
      controls.addCleanup(filters.dispose);
      if (accessibility) controls.addCleanup(accessibility.dispose);
      return {};
    },
  );
}

const entry = createObject(null) as GamingaloEntry;
defineProperty(entry, 'init', { __proto__: null, value: freeze(init), enumerable: true } as PropertyDescriptor);
defineProperty(entry, 'version', { __proto__: null, value: SDK_VERSION, enumerable: true } as PropertyDescriptor);

/** The SDK entry point. It's frozen and sets no globals. */
export const Gamingalo: GamingaloEntry = freeze(entry);
