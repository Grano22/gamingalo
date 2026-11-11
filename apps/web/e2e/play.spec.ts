import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { publishedGame } from './published-game';

async function playAsGuest(page: Page): Promise<string> {
  await page.goto('/sign-in');
  await page.getByLabel('16 or older').check();
  await page.getByRole('button', { name: 'Play as a guest' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your account');
  return (await page.getByLabel('Display name').inputValue()).trim();
}

test('AC-8: a published game plays inside the platform and knows the player', async ({ page }) => {
  const game = publishedGame();
  const name = await playAsGuest(page);

  await page.goto('/');
  await page.getByRole('link', { name: game.title }).first().click();
  await expect(page).toHaveURL(new RegExp(`/play/${game.id}$`));

  const frame = page.frameLocator(`iframe[title="Game: ${game.title}"]`);
  await expect(frame.locator('#out')).toContainText(`Hello ${name}`);
  await expect(frame.locator('#out')).toContainText(/player id: [0-9a-f-]{36}/);
});

test('AC-8: the game is isolated from the platform', async ({ page }) => {
  const game = publishedGame();
  await playAsGuest(page);
  await page.goto(`/play/${game.id}`);
  const out = page.frameLocator(`iframe[title="Game: ${game.title}"]`).locator('#out');
  await expect(out).toContainText('parent: blocked');
  await expect(out).toContainText('cookie: none');

  const iframe = page.locator('iframe');
  await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock');
  expect(new URL((await iframe.getAttribute('src')) ?? '').hostname).toBe(`${game.id}.games.localhost`);
});

test('a game without a signed-in player still runs, and says so', async ({ page }) => {
  const game = publishedGame();
  await page.goto(`/play/${game.id}`);
  await expect(page.getByText("The game can't see who you are until you")).toBeVisible();
  await expect(page.frameLocator('iframe').locator('#out')).toContainText('player: UNAUTHENTICATED', { timeout: 10000 });
});

test('an unknown game shows a clear message', async ({ page }) => {
  await page.goto('/play/no-such-game');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Game not found');
});

test('the game page can only be embedded by the platform', async ({ request }) => {
  const game = publishedGame();
  const response = await request.get(`http://${game.id}.games.localhost:4324/`);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-security-policy']).toContain('frame-ancestors http://localhost:4323');
});

test('the play page has no automatically detectable WCAG 2.2 AA violations', async ({ page }) => {
  const game = publishedGame();
  await playAsGuest(page);
  await page.goto(`/play/${game.id}`);
  await expect(page.frameLocator('iframe').locator('#out')).toContainText('Hello');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
});
