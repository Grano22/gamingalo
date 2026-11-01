import { GamingaloError } from '@gamingalo/errors';
import { resolveConfig, type GamingaloConfig } from './config';
import { buildSdk, type GamingaloSdk } from './facade';
import { createBrowserAccessibility, watchAccessibilityPreferences } from './features/accessibility';
import { createGameCache } from './features/cache';
import { readBrowserConnection, watchBrowserConnection } from './features/connection';
import { readEnvironment, watchDevices } from './features/environment';
import { getBrowserFiles } from './features/files';
import { isPageHidden, watchPageLifecycle } from './features/lifecycle';
import { createNetwork, createSessionId } from './features/network';
import { getBrowserSaveBackend } from './features/saves';
import { getBrowserStore } from './features/settings';
import { createBrowserStorageInfo } from './features/storage';
import { createObject, defineProperty, freeze } from './primordials';
import { resolveRealm } from './realm';

export interface GamingaloEntry {
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
  const { gameId, realm: realmOptions } = resolveConfig(config);
  if (running) {
    throw new GamingaloError(
      'SDK_ALREADY_INITIALIZED',
      'The SDK is already running in this realm. Only its holder can shut it down and start it again.',
    );
  }
  const realm = resolveRealm(realmOptions);

  running = true;
  const saveBackend = getBrowserSaveBackend(gameId);
  const files = getBrowserFiles(gameId);
  const accessibility = createBrowserAccessibility(realm.canvas);

  return buildSdk(
    {
      gameId,
      realm,
      connection: readBrowserConnection(),
      suspended: isPageHidden(),
      hasFeature: (name) => (name === 'saves' && !!saveBackend) || (name === 'files' && !!files),
      readEnvironment,
      store: getBrowserStore(),
      cache: createGameCache(gameId),
      saveBackend,
      files,
      storage: createBrowserStorageInfo(),
      accessibility: accessibility.api,
      network: createNetwork(capturedFetch, createSessionId()),
      onShutdown: () => {
        running = false;
      },
    },
    (controls) => {
      controls.addCleanup(watchBrowserConnection(controls.setConnection));
      controls.addCleanup(watchPageLifecycle(controls.suspend, controls.resume));
      controls.addCleanup(watchDevices(controls.devicesChanged));
      controls.addCleanup(watchAccessibilityPreferences(controls.accessibilityChanged));
      controls.addCleanup(accessibility.dispose);
      return {};
    },
  );
}

const entry = createObject(null) as GamingaloEntry;
defineProperty(entry, 'init', { __proto__: null, value: freeze(init), enumerable: true } as PropertyDescriptor);

/** The SDK entry point. It's frozen and sets no globals. */
export const Gamingalo: GamingaloEntry = freeze(entry);
