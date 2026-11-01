import { expect, test, type Page } from '@playwright/test';
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
    window.heldSdk = await window.Gamingalo.init({ gameId: 'localization' });
  });
}

test.describe('with a Polish browser', () => {
  test.use({ locale: 'pl-PL', timezoneId: 'Europe/Warsaw' });

  test('detects language, region and time zone with no prompts', async ({ page, browserName }) => {
    let dialogs = 0;
    page.on('dialog', () => dialogs++);
    await start(page);

    const detected = await page.evaluate(() => window.heldSdk.localization.detect());

    expect(detected.language).toBe('pl-PL');
    expect(detected.region).toBe('PL');
    expect(detected.timeZone).toBe('Europe/Warsaw');
    expect(detected.direction).toBe('ltr');
    expect(dialogs).toBe(0);
    if (browserName !== 'chromium') expect(detected.keyboard.layout).toBe('unknown');
    else expect(typeof detected.keyboard.layout).toBe('string');
  });

  test('uses Polish messages, plurals and formatting', async ({ page }) => {
    await start(page);
    const result = await page.evaluate(() => {
      const { localization } = window.heldSdk;
      localization.addMessages('pl', {
        'coins.one': '{count} moneta',
        'coins.few': '{count} monety',
        'coins.many': '{count} monet',
      });
      localization.addMessages('en', { only: 'English fallback' });
      return {
        one: localization.t('coins', { count: 1 }),
        few: localization.t('coins', { count: 2 }),
        many: localization.t('coins', { count: 5 }),
        fallback: localization.t('only'),
        missing: localization.t('missing'),
      };
    });
    expect(result).toEqual({
      one: '1 moneta',
      few: '2 monety',
      many: '5 monet',
      fallback: 'English fallback',
      missing: 'missing',
    });
  });
});

test('a chosen locale survives a reload', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.heldSdk.localization.setLocale('ar'));
  await page.reload();
  await page.waitForFunction(() => window.ready);
  await page.evaluate(async () => {
    window.heldSdk = await window.Gamingalo.init({ gameId: 'localization' });
  });
  const result = await page.evaluate(() => ({
    locale: window.heldSdk.localization.locale(),
    direction: window.heldSdk.localization.direction(),
  }));
  expect(result).toEqual({ locale: 'ar', direction: 'rtl' });
});

test('geolocation is denied cleanly when the player refuses', async ({ page, context, browserName }) => {
  // Run in Chromium only, because a browser that shows a prompt instead would wait for a player's answer.
  test.skip(browserName !== 'chromium');
  await context.clearPermissions();
  await start(page);
  const result = await page.evaluate(() => window.heldSdk.localization.requestGeolocation({ timeoutMs: 3000 }));
  expect(['denied', 'timeout']).toContain(result.status);
});

test('geolocation returns the position when the player allows it', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 52.23, longitude: 21.01, accuracy: 25 });
  await start(page);
  const result = await page.evaluate(() => window.heldSdk.localization.requestGeolocation({ timeoutMs: 5000 }));
  expect(result).toMatchObject({ status: 'granted', latitude: 52.23, longitude: 21.01, accuracyMeters: 25 });
});
