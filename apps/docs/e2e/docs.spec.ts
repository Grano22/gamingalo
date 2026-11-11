import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = ['./', 'docs/', 'docs/sdk/', 'docs/plugins/', 'docs/design-system/', 'docs/changelogs/sdk/'];

test('the home page leads to the docs, under the Pages base path', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Build web games');
  await page.getByRole('link', { name: 'Get started' }).click();
  await expect(page).toHaveURL(/\/gamingalo\/docs\/getting-started\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Getting started');
});

test('sidebar navigation reaches every section', async ({ page }) => {
  await page.goto('docs/');
  const sidebar = page.locator('#nd-sidebar');
  for (const name of ['CLI', 'Publishing', 'Design system']) {
    await expect(sidebar.getByRole('link', { name, exact: true }).first()).toBeVisible();
  }
  // Folders start collapsed, and open when chosen.
  await sidebar.getByRole('button', { name: 'SDK' }).click();
  await sidebar.getByRole('link', { name: 'Saves', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Saves');
});

test('search runs in the browser from the static index', async ({ page }) => {
  await page.goto('docs/');
  await page.getByRole('button', { name: /^Search/ }).first().click();
  const input = page.getByLabel('Search the docs');
  await expect(input).toBeVisible();
  await input.fill('mock SDK');
  // The first query downloads the index, so allow time for it.
  await expect(page.getByRole('dialog')).toContainText('Test SDK use with the mock SDK', { timeout: 15000 });
});

test('changelog pages show each module’s current version', async ({ page }) => {
  await page.goto('docs/changelogs/sdk/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('@gamingalo/sdk');
  await expect(page.getByRole('heading', { name: /0\.14\.0/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'changelogs/' })).toHaveAttribute('href', /github\.com\/Grano22\/gamingalo\/tree\/main\/packages\/sdk\/changelogs/);
});

test('unknown pages show the not-found page', async ({ page }) => {
  const response = await page.goto('docs/no-such-page/');
  expect(response?.status()).toBe(404);
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    for (const path of PAGES) {
      test(`${path} has no automatically detectable WCAG 2.2 AA violations`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
        expect(
          results.violations.map((violation) => `${violation.id}: ${violation.nodes.slice(0, 3).map((node) => node.target.join(' ')).join(', ')}`),
        ).toEqual([]);
      });
    }
  });
}

test('the logo stays still when the reader asks for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  const animation = await page.locator('.gg-logo-lit').first().evaluate((node) => getComputedStyle(node).animationName);
  expect(animation).toBe('none');
});
