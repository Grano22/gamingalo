import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('the status page shows the real services through the proxy', async ({ page }) => {
  await page.goto('/status');
  await expect(page.getByRole('status')).toContainText('Available');
  await expect(page.getByRole('status')).toContainText('gamingalo-api');
});

test('the status page reports when the services are down, and recovers', async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort());
  await page.goto('/status');
  await expect(page.getByRole('status')).toContainText('Unavailable');

  await page.unroute('**/api/**');
  await page.getByRole('button', { name: 'Check again' }).click();
  await expect(page.getByRole('status')).toContainText('Available');
});

test('navigation works and sets page titles', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Play and publish');
  await page.getByRole('link', { name: 'Status' }).click();
  await expect(page).toHaveURL(/\/status$/);
  await expect(page).toHaveTitle(/Service status/);
  await expect(page.getByRole('link', { name: 'Status' })).toHaveAttribute('aria-current', 'page');
});

test('keyboard users can skip to the main content', async ({ page, browserName }) => {
  // WebKit only tabs to links when a macOS setting is on, which isn't something tests control.
  test.skip(browserName === 'webkit');
  await page.goto('/');
  // The app shows once it knows who is signed in, so wait for it before pressing Tab.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
});

for (const path of ['/', '/status', '/sign-in']) {
  test(`${path} has no automatically detectable WCAG 2.2 AA violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
}
