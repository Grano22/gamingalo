import { expect, test, type Page } from '@playwright/test';
import type { GamingaloSdk } from '@gamingalo/sdk';
import type { ScreenPreferences } from '../src/index';

declare global {
  interface Window {
    sdk: GamingaloSdk;
    screenApi: ScreenPreferences;
    ready: boolean;
  }
}

async function open(page: Page): Promise<void> {
  await page.goto('/plugin-screen-preferences/e2e/fixture.html');
  await page.waitForFunction(() => window.ready);
}

const shot = async (page: Page) => (await page.locator('#game').screenshot()).toString('base64');

test('each setting changes what the player sees, and reset restores it', async ({ page }) => {
  await open(page);
  const original = await shot(page);

  for (const change of [
    () => window.screenApi.setBrightness(1.5),
    () => window.screenApi.setContrast(1.5),
    () => window.screenApi.setGamma(2),
  ]) {
    await page.evaluate(change);
    expect(await shot(page)).not.toBe(original);
    await page.evaluate(() => window.screenApi.reset());
    expect(await shot(page)).toBe(original);
  }
});

test('values survive a reload and apply at startup', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.screenApi.setBrightness(1.3));
  const changed = await shot(page);

  await page.reload();
  await page.waitForFunction(() => window.ready);

  expect(await page.evaluate(() => window.screenApi.values().brightness)).toBe(1.3);
  expect(await shot(page)).toBe(changed);
});

test('it combines with accessibility filters, and shutdown removes everything', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const canvas = document.getElementById('game') as HTMLCanvasElement;
    window.screenApi.setBrightness(1.2);
    window.screenApi.setGamma(2);
    window.sdk.accessibility.setCanvasFilter('grayscale');
    const combined = canvas.style.filter;
    const svgDuring = document.querySelectorAll('svg[data-gamingalo-screen]').length;
    await window.sdk.shutdown();
    return {
      combined,
      svgDuring,
      restored: canvas.style.filter,
      svgAfter: document.querySelectorAll('svg[data-gamingalo-screen]').length,
    };
  });

  expect(result.combined).toContain('brightness(1.2)');
  expect(result.combined).toContain('url(');
  expect(result.combined).toContain('grayscale(1)');
  expect(result.svgDuring).toBe(1);
  expect(result.restored).toBe('');
  expect(result.svgAfter).toBe(0);
});
