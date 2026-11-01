import { expect, test, type Page } from '@playwright/test';
import type { GamingaloEntry, GamingaloSdk } from '../src/index';

declare global {
  interface Window {
    Gamingalo: GamingaloEntry;
    ready: boolean;
    heldSdk: GamingaloSdk;
    activated: string[];
  }
}

async function start(page: Page): Promise<void> {
  await page.goto('/e2e/fixture.html');
  await page.waitForFunction(() => window.ready);
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.id = 'game';
    document.body.append(canvas);
    window.activated = [];
    window.heldSdk = await window.Gamingalo.init({ gameId: 'a11y', realm: { canvas } });
  });
}

test('AC-1 and AC-2: exposes roles and names, activates by keyboard, and treats HTML as text', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    window.heldSdk.accessibility.mirror([
      { id: 'title', role: 'heading', label: 'Main menu' },
      { id: 'start', role: 'button', label: 'Start game', onActivate: () => window.activated.push('start') },
      { id: 'name', role: 'text', label: '<img src=x onerror="window.activated.push(1)">' },
    ]);
  });

  await expect(page.getByRole('heading', { name: 'Main menu' })).toHaveCount(1);
  const button = page.getByRole('button', { name: 'Start game' });
  await expect(button).toHaveCount(1);

  await page.evaluate(() => window.heldSdk.accessibility.focus('start'));
  await expect(button).toBeFocused();
  await page.keyboard.press('Enter');

  expect(await page.evaluate(() => window.activated)).toEqual(['start']);
  expect(await page.locator('[data-gamingalo-accessibility] img').count()).toBe(0);
  await expect(page.getByText('<img src=x')).toHaveCount(1);
});

test('AC-3: focus stays on an item when the mirror updates', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    const { accessibility } = window.heldSdk;
    accessibility.mirror([
      { id: 'a', role: 'button', label: 'First' },
      { id: 'b', role: 'button', label: 'Second' },
    ]);
    accessibility.focus('b');
    accessibility.mirror([
      { id: 'a', role: 'button', label: 'First' },
      { id: 'b', role: 'button', label: 'Second updated' },
      { id: 'c', role: 'button', label: 'Third' },
    ]);
  });
  await expect(page.getByRole('button', { name: 'Second updated' })).toBeFocused();
});

test('AC-3: focus and order are right when items are reordered', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    const { accessibility } = window.heldSdk;
    accessibility.mirror([
      { id: 'a', role: 'button', label: 'First' },
      { id: 'b', role: 'button', label: 'Second' },
      { id: 'c', role: 'button', label: 'Third' },
    ]);
    accessibility.focus('c');
    accessibility.mirror([
      { id: 'c', role: 'button', label: 'Third' },
      { id: 'a', role: 'button', label: 'First' },
      { id: 'b', role: 'button', label: 'Second' },
    ]);
  });
  await expect(page.getByRole('button', { name: 'Third' })).toBeFocused();
  await expect(page.locator('[data-gamingalo-accessibility] button')).toHaveText(['Third', 'First', 'Second']);
});

test('AC-4: announcements reach live regions, including repeats', async ({ page }) => {
  await start(page);
  const text = await page.evaluate(() => {
    const { accessibility } = window.heldSdk;
    const read = (level: string) => document.querySelector(`[aria-live=${level}]`)?.textContent;
    accessibility.announce('Saved');
    const first = read('polite');
    accessibility.announce('Saved');
    const second = read('polite');
    accessibility.announce('Low health', { assertive: true });
    return { first, second, urgent: read('assertive') };
  });
  expect(text.first?.trim()).toBe('Saved');
  expect(text.second?.trim()).toBe('Saved');
  expect(text.first).not.toBe(text.second);
  expect(text.urgent?.trim()).toBe('Low health');
});

test('AC-5: preferences follow the browser, and changes emit an event', async ({ page }) => {
  await start(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => {
    window.activated = [];
    window.heldSdk.on('accessibility', (preferences) => {
      window.activated.push(String(preferences.reducedMotion));
    });
  });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => window.activated.includes('true'));

  expect(await page.evaluate(() => window.heldSdk.accessibility.preferences().reducedMotion)).toBe(true);
});

test('AC-6: filters apply to the canvas, and shutdown removes everything the SDK added', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(async () => {
    const canvas = document.getElementById('game') as HTMLCanvasElement;
    const sdk = window.heldSdk;
    sdk.accessibility.setCanvasFilter('high-contrast');
    sdk.accessibility.announce('x');
    const applied = getComputedStyle(canvas).filter;
    const hidden = document.querySelector('[data-gamingalo-accessibility]')?.getBoundingClientRect().width;
    await sdk.shutdown();
    return {
      applied,
      hidden,
      restored: canvas.style.filter,
      leftovers: document.querySelectorAll('[data-gamingalo-accessibility]').length,
    };
  });
  expect(result.applied).toContain('contrast');
  expect(result.hidden).toBeLessThanOrEqual(1);
  expect(result.restored).toBe('');
  expect(result.leftovers).toBe(0);
});
