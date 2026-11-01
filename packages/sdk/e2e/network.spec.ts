import { expect, test, type Page, type Request } from '@playwright/test';
import type { GamingaloEntry, GamingaloSdk } from '../src/index';

declare global {
  interface Window {
    Gamingalo: GamingaloEntry;
    ready: boolean;
    heldSdk: GamingaloSdk;
  }
}

async function start(page: Page): Promise<void> {
  await page.goto('/e2e/fixture.html');
  await page.waitForFunction(() => window.ready);
  await page.evaluate(async () => {
    window.heldSdk = await window.Gamingalo.init({ gameId: 'network' });
  });
}

test('AC-1: measures a real connection', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(() =>
    window.heldSdk.network.measure({ samples: 3, throughputUrl: '/dist/index.js' }),
  );

  expect(result.lossPercent).toBe(0);
  expect(result.samples).toBe(3);
  expect(result.pingMs).toBeGreaterThanOrEqual(0);
  expect(result.jitterMs).toBeGreaterThanOrEqual(0);
  // A very fast local download can round to no measurable time.
  if (result.throughputMbps !== 'unknown') expect(result.throughputMbps).toBeGreaterThan(0);
});

test('AC-2: being offline is reported as loss, not an error', async ({ page, context }) => {
  await start(page);
  await context.setOffline(true);
  const result = await page.evaluate(() => window.heldSdk.network.measure({ samples: 2, timeoutMs: 2000 }));
  await context.setOffline(false);

  expect(result).toEqual({
    pingMs: 'unknown',
    jitterMs: 'unknown',
    lossPercent: 100,
    samples: 2,
    throughputMbps: 'unknown',
  });
});

test('AC-5 and AC-6: nothing is sent until asked, and requests send no referrer', async ({ page }) => {
  await start(page);
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));

  await page.evaluate(() => window.heldSdk.network.info());
  await page.waitForTimeout(100);
  expect(requests).toEqual([]);

  await page.evaluate(() => window.heldSdk.network.measure({ samples: 1 }));
  expect(requests).toHaveLength(1);
  expect(requests[0]?.method()).toBe('HEAD');
  // allHeaders() reads what was sent. Chromium's provisional headers show an empty placeholder.
  expect((await requests[0]?.allHeaders())?.['referer']).toBeUndefined();
});

test('info and the session ID work in every browser', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(() => ({
    online: window.heldSdk.network.info().online,
    sessionId: window.heldSdk.network.sessionId,
  }));
  expect(result.online).toBe(true);
  expect(result.sessionId).toMatch(/^[0-9a-f-]{36}$/);
});
