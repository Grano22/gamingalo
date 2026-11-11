import { expect, test, type Page } from '@playwright/test';
import type { GamingaloEntry } from '../src/index';

declare global {
  interface Window {
    Gamingalo: GamingaloEntry;
    ready: boolean;
  }
}

async function open(page: Page): Promise<void> {
  await page.goto('/e2e/fixture.html');
  await page.waitForFunction(() => window.ready);
}

test('AC-1: the public surface cannot be changed', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    'use strict';
    const sdk = await window.Gamingalo.init({ gameId: 'hardening' });
    const target = sdk as unknown as Record<string, unknown>;
    const attempts = [
      () => {
        target['on'] = () => {};
      },
      () => {
        delete target['settings'];
      },
      () => Object.defineProperty(sdk, 'on', { value: () => {} }),
      () => Object.setPrototypeOf(sdk, {}),
      () => {
        (window.Gamingalo as unknown as Record<string, unknown>)['init'] = () => {};
      },
      () => {
        (sdk.settings as unknown as Record<string, unknown>)['get'] = () => 'evil';
      },
    ];
    const blocked = attempts.map((attempt) => {
      try {
        attempt();
        return false;
      } catch (error) {
        return error instanceof TypeError;
      }
    });
    sdk.preferences.set('volume', 1);
    return {
      blocked,
      frozen: Object.isFrozen(sdk) && Object.isFrozen(sdk.settings) && Object.isFrozen(window.Gamingalo),
      prototype: Object.getPrototypeOf(sdk) === null,
      volume: sdk.preferences.get('volume'),
    };
  });

  expect(result).toEqual({ blocked: [true, true, true, true, true, true], frozen: true, prototype: true, volume: 1 });
});

test('AC-2: a polluted prototype cannot supply options', async ({ page }) => {
  await open(page);
  const code = await page.evaluate(async () => {
    const prototype = Object.prototype as unknown as Record<string, unknown>;
    prototype['gameId'] = 'evil-game';
    try {
      await window.Gamingalo.init({} as never);
      return 'started';
    } catch (error) {
      return (error as { code: string }).code;
    } finally {
      delete prototype['gameId'];
    }
  });
  expect(code).toBe('INVALID_CONFIG');
});

test('AC-3: patched built-ins cannot see session values', async ({ page }) => {
  await open(page);
  const seen = await page.evaluate(async () => {
    const sdk = await window.Gamingalo.init({ gameId: 'hardening' });
    const seenValues: unknown[] = [];
    const originalSet = Map.prototype.set;
    Map.prototype.set = function (key: unknown, value: unknown) {
      seenValues.push(value);
      return originalSet.call(this, key, value);
    };
    sdk.session.set('secret', 'value');
    const read = sdk.session.get('secret');
    Map.prototype.set = originalSet;
    return { seenValues, read };
  });
  expect(seen).toEqual({ seenValues: [], read: 'value' });
});

test('AC-4: a second script cannot get the running reference', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    await window.Gamingalo.init({ gameId: 'hardening' });
    const url = '/dist/index.js';
    const again = (await import(url)) as { Gamingalo: GamingaloEntry };
    let code = '';
    try {
      await again.Gamingalo.init({ gameId: 'hardening' });
    } catch (error) {
      code = (error as { code: string }).code;
    }
    return { code, keys: Object.keys(again.Gamingalo), globals: 'sdk' in window || 'gamingalo' in window };
  });
  expect(result).toEqual({ code: 'SDK_ALREADY_INITIALIZED', keys: ['init', 'version'], globals: false });
});

test('AC-5: a canvas from another iframe and wrong realms are rejected', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const codeOf = async (realm: Parameters<GamingaloEntry['init']>[0]['realm']) => {
      try {
        const sdk = await window.Gamingalo.init({ gameId: 'hardening', realm: realm as never });
        await sdk.shutdown();
        return 'started';
      } catch (error) {
        return (error as { code: string }).code;
      }
    };
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const foreignCanvas = frame.contentDocument?.createElement('canvas');
    return {
      foreign: await codeOf({ canvas: foreignCanvas as HTMLCanvasElement }),
      origin: await codeOf({ origins: ['https://elsewhere.example'] }),
      embedded: await codeOf({ frame: 'embedded' }),
      own: await codeOf({ canvas: document.createElement('canvas'), origins: [location.origin], frame: 'top' }),
    };
  });
  expect(result).toEqual({
    foreign: 'REALM_NOT_ALLOWED',
    origin: 'REALM_NOT_ALLOWED',
    embedded: 'REALM_NOT_ALLOWED',
    own: 'started',
  });
});

test('AC-7: mock mode runs under WebDriver and makes no network requests', async ({ page }) => {
  await open(page);
  const requests: string[] = [];
  const result = await page.evaluate(async () => {
    const url = '/dist/testing.js';
    const { createMockSdk } = (await import(url)) as typeof import('../src/testing');
    const sdk = await createMockSdk({ features: ['saves'] });
    sdk.mock.setConnection('offline');
    sdk.mock.suspend();
    sdk.mock.resume();
    return { saves: sdk.features.has('saves'), state: sdk.connection.state };
  });
  page.on('request', (request) => requests.push(request.url()));
  await page.waitForTimeout(100);
  expect(result).toEqual({ saves: true, state: 'offline' });
  expect(requests).toEqual([]);
});

test('AC-7: mock mode is refused in a normal browser session', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });
  });
  await open(page);
  const code = await page.evaluate(async () => {
    const url = '/dist/testing.js';
    const { createMockSdk } = (await import(url)) as typeof import('../src/testing');
    try {
      await createMockSdk();
      return 'started';
    } catch (error) {
      return (error as { code: string }).code;
    }
  });
  expect(code).toBe('MOCK_NOT_ALLOWED');
});
