import { expect, test, type Page } from '@playwright/test';
import type { Gamingalo as GamingaloApi } from '../src/index';

declare global {
  interface Window {
    Gamingalo: typeof GamingaloApi;
    ready: boolean;
    sdkEvents: string[];
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
    window.sdkEvents = [];
    sdk.on('connection', (state) => window.sdkEvents.push(state));
    return sdk.connection.state;
  });
  expect(initial).toBe('offline');

  await context.setOffline(false);
  await page.waitForFunction(() => window.sdkEvents.includes('online'));
  expect(await page.evaluate(() => window.Gamingalo.instance().connection.state)).toBe('online');
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

test('AC-7: mock mode makes no network requests', async ({ page }) => {
  await open(page);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));

  await page.evaluate(async () => {
    const sdk = await window.Gamingalo.init({
      gameId: 'e2e-game',
      mode: 'mock',
      mock: { features: ['saves'] },
    });
    sdk.mock?.setConnection('offline');
    sdk.mock?.suspend();
    sdk.mock?.resume();
    sdk.features.has('saves');
    await sdk.shutdown();
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  expect(requests).toEqual([]);
});
