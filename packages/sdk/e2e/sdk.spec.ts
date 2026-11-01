import { expect, test, webkit, type Page } from '@playwright/test';
import type { GamingaloEntry, GamingaloSdk } from '../src/index';

declare global {
  interface Window {
    Gamingalo: GamingaloEntry;
    ready: boolean;
    sdkEvents: string[];
    heldSdk: GamingaloSdk;
  }
}

async function open(page: Page): Promise<void> {
  await page.goto('/e2e/fixture.html');
  await page.waitForFunction(() => window.ready);
}

test('AC-1: a plain page can initialize and shut down the built package', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await open(page);

  const result = await page.evaluate(async () => {
    const sdk = await window.Gamingalo.init({ gameId: 'e2e-game' });
    const gameId = sdk.gameId;
    await sdk.shutdown();
    return { gameId };
  });

  expect(result.gameId).toBe('e2e-game');
  expect(failures).toEqual([]);
});

test('AC-3: starts offline and reports connection changes', async ({ page, context }) => {
  await open(page);
  await context.setOffline(true);

  const initial = await page.evaluate(async () => {
    const sdk = await window.Gamingalo.init({ gameId: 'e2e-game' });
    window.heldSdk = sdk;
    window.sdkEvents = [];
    sdk.on('connection', (state) => window.sdkEvents.push(state));
    return sdk.connection.state;
  });
  expect(initial).toBe('offline');

  await context.setOffline(false);
  await page.waitForFunction(() => window.sdkEvents.includes('online'));
  expect(await page.evaluate(() => window.heldSdk.connection.state)).toBe('online');
});

test('AC-4: suspend and resume follow page visibility', async ({ page }) => {
  await open(page);

  // Headless browsers don't hide pages, so this drives each engine's real event
  // dispatch with a simulated visibility value.
  const events = await page.evaluate(async () => {
    const sdk = await window.Gamingalo.init({ gameId: 'e2e-game' });
    const seen: string[] = [];
    sdk.on('suspend', () => seen.push('suspend'));
    sdk.on('resume', () => seen.push('resume'));

    const setVisibility = (state: DocumentVisibilityState) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    setVisibility('hidden');
    window.dispatchEvent(new PageTransitionEvent('pagehide'));
    setVisibility('visible');
    return seen;
  });

  expect(events).toEqual(['suspend', 'resume']);
});

test('environment: reads complete information with no permission prompts', async ({ page }) => {
  let dialogs = 0;
  page.on('dialog', () => dialogs++);
  await open(page);

  const env = await page.evaluate(async () => {
    const sdk = await window.Gamingalo.init({ gameId: 'e2e-game' });
    return sdk.environment.read();
  });

  expect(['chrome', 'firefox', 'safari']).toContain(env.browser.name);
  expect(env.hardware.cpuCores).toBeGreaterThan(0);
  expect(typeof env.graphics.webgl2).toBe('boolean');
  expect(env.display.width).toBeGreaterThan(0);
  expect(['low', 'medium', 'high', 'unknown']).toContain(env.tier);
  expect(dialogs).toBe(0);
});

test('settings: survive a reload and are separate for each game', async ({ page }) => {
  await open(page);
  await page.evaluate(async () => {
    const sdk = await window.Gamingalo.init({ gameId: 'game-a' });
    sdk.settings.set('volume', 0.5);
    await sdk.settings.setGraphicsPreset('low');
  });

  await page.reload();
  await page.waitForFunction(() => window.ready);

  const result = await page.evaluate(async () => {
    const gameA = await window.Gamingalo.init({ gameId: 'game-a' });
    const values = {
      volume: gameA.settings.get('volume'),
      persistent: gameA.settings.persistent,
      quality: (await gameA.settings.getGraphics()).quality,
    };
    await gameA.shutdown();
    const gameB = await window.Gamingalo.init({ gameId: 'game-b' });
    return { ...values, otherGame: gameB.settings.get('volume') ?? null };
  });

  expect(result).toEqual({ volume: 0.5, persistent: true, quality: 'low', otherGame: null });
});

test('cache: stores real files, separate for each game, with no network traffic', async ({ page }) => {
  await open(page);
  const requests: string[] = [];
  page.on('request', (request) => {
    // WebKit reads Blobs through local blob: URLs, which aren't network traffic.
    if (request.url().startsWith('http')) requests.push(request.url());
  });

  const result = await page.evaluate(async () => {
    const gameA = await window.Gamingalo.init({ gameId: 'cache-a' });
    await gameA.cache.put('logo file.png', new Blob(['pixels'], { type: 'image/png' }));
    await gameA.cache.put('note', 'hello');
    const blob = await gameA.cache.get('logo file.png');
    const values = {
      persistent: gameA.cache.persistent,
      text: await blob?.text(),
      type: blob?.type,
      note: await (await gameA.cache.get('note'))?.text(),
      deleted: await gameA.cache.delete('note'),
      afterDelete: (await gameA.cache.get('note')) ?? null,
    };
    await gameA.shutdown();

    const gameB = await window.Gamingalo.init({ gameId: 'cache-b' });
    return { ...values, otherGame: (await gameB.cache.get('logo file.png')) ?? null };
  });

  expect(result).toEqual({
    persistent: true,
    text: 'pixels',
    type: 'image/png',
    note: 'hello',
    deleted: true,
    afterDelete: null,
    otherGame: null,
  });
  expect(requests).toEqual([]);
});

test('saves: survive a reload with binary data, migrate, and stay separate per game', async ({ page }) => {
  await open(page);
  await page.evaluate(async () => {
    const sdk = await window.Gamingalo.init({ gameId: 'saves-a' });
    await sdk.saves.write('slot-1', { level: 3, logo: new Blob(['pixels'], { type: 'image/png' }) });
  });

  await page.reload();
  await page.waitForFunction(() => window.ready);

  const result = await page.evaluate(async () => {
    const gameA = await window.Gamingalo.init({ gameId: 'saves-a' });
    gameA.saves.configure({
      version: 2,
      migrations: { 1: (old: { level: number; logo: Blob }) => ({ ...old, money: 10 }) },
    });
    const save = await gameA.saves.read<{ level: number; money: number; logo: Blob }>('slot-1');
    const values = {
      available: gameA.features.has('saves'),
      version: save?.version,
      level: save?.data.level,
      money: save?.data.money,
      logo: await save?.data.logo.text(),
      slots: (await gameA.saves.list()).map((info) => [info.slot, info.version]),
      evicted: await gameA.saves.wasEvicted(),
    };

    let cloneError = '';
    try {
      await gameA.saves.write('bad', { handler: () => {} });
    } catch (error) {
      cloneError = (error as { code: string }).code;
    }
    await gameA.shutdown();

    const gameB = await window.Gamingalo.init({ gameId: 'saves-b' });
    return { ...values, cloneError, otherGame: (await gameB.saves.read('slot-1')) ?? null };
  });

  expect(result).toEqual({
    available: true,
    version: 2,
    level: 3,
    money: 10,
    logo: 'pixels',
    slots: [['slot-1', 2]],
    evicted: false,
    cloneError: 'INVALID_ARGUMENT',
    otherGame: null,
  });
});

test('saves: report eviction when the browser removes the database', async ({ page }) => {
  await open(page);
  const evicted = await page.evaluate(async () => {
    const sdk = await window.Gamingalo.init({ gameId: 'saves-evicted' });
    await sdk.saves.write('slot-1', 1);
    await sdk.shutdown();

    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase('gamingalo:saves-evicted');
      request.onsuccess = resolve;
      request.onerror = reject;
    });

    const restarted = await window.Gamingalo.init({ gameId: 'saves-evicted' });
    return [await restarted.saves.wasEvicted(), await restarted.saves.wasEvicted()];
  });

  expect(evicted).toEqual([true, false]);
});

test('storage: reports usage and handles persistence requests', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const sdk = await window.Gamingalo.init({ gameId: 'storage-game' });
    // Firefox shows the player a prompt, so its request stays pending in a test.
    const granted = await Promise.race([
      sdk.storage.requestPersistence(),
      new Promise<string>((resolve) => setTimeout(() => resolve('pending'), 500)),
    ]);
    return {
      estimate: await sdk.storage.estimate(),
      granted,
      persistent: await sdk.storage.isPersistent(),
    };
  });

  expect([true, false, 'pending']).toContain(result.granted);
  expect(typeof result.persistent).toBe('boolean');
  if (result.estimate !== 'unknown') expect(result.estimate.quotaBytes).toBeGreaterThan(0);
});

async function checkLargeFiles(page: Page): Promise<void> {
  const size = 8 * 1024 * 1024;
  await page.goto('/e2e/fixture.html');
  await page.waitForFunction(() => window.ready);
  await page.evaluate(async (bytes) => {
    const sdk = await window.Gamingalo.init({ gameId: 'files-a' });
    await sdk.files.write('music/song 1.mp3', new Blob([new Uint8Array(bytes).fill(7)], { type: 'audio/mpeg' }));
    await sdk.files.write('replace', 'first');
    await sdk.files.write('replace', 'second');
    await sdk.files.write('stream', new Blob(['streamed']).stream() as ReadableStream<Uint8Array<ArrayBuffer>>);
  }, size);

  await page.reload();
  await page.waitForFunction(() => window.ready);

  const result = await page.evaluate(async () => {
    const gameA = await window.Gamingalo.init({ gameId: 'files-a' });
    const song = await gameA.files.read('music/song 1.mp3');
    const last = new Uint8Array(await (song as File).slice(-1).arrayBuffer())[0];
    const values = {
      available: await gameA.files.available(),
      name: song?.name,
      size: song?.size,
      last,
      replaced: await (await gameA.files.read('replace'))?.text(),
      streamed: await (await gameA.files.read('stream'))?.text(),
      names: (await gameA.files.list()).map((info) => info.name).sort(),
      missing: (await gameA.files.read('nope')) ?? null,
      deleted: [await gameA.files.delete('replace'), await gameA.files.delete('replace')],
    };
    await gameA.shutdown();
    const gameB = await window.Gamingalo.init({ gameId: 'files-b' });
    return { ...values, otherGame: (await gameB.files.read('replace')) ?? null, otherList: await gameB.files.list() };
  });

  expect(result).toEqual({
    available: true,
    name: 'music/song 1.mp3',
    size,
    last: 7,
    replaced: 'second',
    streamed: 'streamed',
    names: ['music/song 1.mp3', 'replace', 'stream'],
    missing: null,
    deleted: [true, false],
    otherGame: null,
    otherList: [],
  });
}

test('files: large files survive a reload, replace safely and stay separate per game', async ({
  page,
  browserName,
}) => {
  // Playwright's WebKit contexts behave like private browsing. See the two WebKit tests below.
  test.skip(browserName === 'webkit');
  await checkLargeFiles(page);
});

test('files: the same behavior in a persistent WebKit profile, as in normal Safari use', async ({
  browserName,
  baseURL,
}, testInfo) => {
  test.skip(browserName !== 'webkit');
  const context = await webkit.launchPersistentContext(testInfo.outputPath('profile'), {
    ...(baseURL ? { baseURL } : {}),
  });
  try {
    await checkLargeFiles(await context.newPage());
  } finally {
    await context.close();
  }
});

test('files: a private WebKit session reports unavailable and fails cleanly', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit');
  await open(page);
  const result = await page.evaluate(async () => {
    const sdk = await window.Gamingalo.init({ gameId: 'files-private' });
    let code = '';
    try {
      await sdk.files.write('a', 'x');
    } catch (error) {
      code = (error as { code: string }).code;
    }
    return { has: sdk.features.has('files'), available: await sdk.files.available(), code };
  });
  expect(result).toEqual({ has: true, available: false, code: 'STORAGE_UNAVAILABLE' });
});
