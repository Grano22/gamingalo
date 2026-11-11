import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function playAsGuest(page: Page, age = '16 or older'): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel(age).check();
  await page.getByRole('button', { name: 'Play as a guest' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your account');
}

test('AC-1: a guest can play, rename themselves and sign out', async ({ page }) => {
  await playAsGuest(page);
  await expect(page.getByRole('navigation', { name: 'Main' })).toContainText('Player-');

  await page.getByLabel('Display name').fill('Ada');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByRole('status')).toHaveText('Name saved.');
  await expect(page.getByRole('navigation', { name: 'Main' })).toContainText('Ada');

  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Main' })).toContainText('Ada');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  await page.goto('/account');
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('AC-3: the session cookie is not readable from scripts', async ({ page, context }) => {
  await playAsGuest(page);
  expect(await page.evaluate(() => document.cookie)).not.toContain('gamingalo_session');
  const cookie = (await context.cookies()).find((candidate) => candidate.name === 'gamingalo_session');
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' });
});

test('names are checked before saving', async ({ page }) => {
  await playAsGuest(page);
  await page.getByLabel('Display name').fill('   ');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByText('Use 1 to 32 visible characters.')).toBeVisible();
  await expect(page.getByLabel('Display name')).toHaveAttribute('aria-invalid', 'true');
});

test('consent choices persist', async ({ page }) => {
  await playAsGuest(page);
  const analytics = page.getByLabel('Share anonymous usage analytics');
  await expect(analytics).not.toBeChecked();
  await analytics.check();
  await expect(page.getByRole('status')).toHaveText('Privacy settings saved.');
  await page.reload();
  await expect(page.getByLabel('Share anonymous usage analytics')).toBeChecked();
});

test('AC-5: under 13s get safe defaults', async ({ page }) => {
  await playAsGuest(page, 'Under 13');
  await expect(page.getByLabel('Share anonymous usage analytics')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Add a passkey' })).toHaveCount(0);
  await expect(page.getByText('A parent or guardian needs to agree before you can add a passkey.')).toBeVisible();
});

test('AC-6: the data download contains the account', async ({ page }) => {
  await playAsGuest(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download your data' }).click(),
  ]);
  const path = await download.path();
  const data = JSON.parse((await import('node:fs')).readFileSync(path, 'utf8')) as {
    account: { displayName: string };
  };
  expect(download.suggestedFilename()).toBe('gamingalo-data.json');
  expect(data.account.displayName).toMatch(/^Player-/);
});

test('AC-7: a guest can delete their account', async ({ page }) => {
  await playAsGuest(page);
  const deleteButton = page.getByRole('button', { name: 'Delete account' });
  await expect(deleteButton).toBeDisabled();
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await deleteButton.click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto('/account');
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('AC-2: a passkey upgrades a guest and signs the same account back in', async ({ page, browserName }) => {
  // Only Chromium offers a virtual authenticator for tests.
  test.skip(browserName !== 'chromium');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  await playAsGuest(page);
  await page.getByLabel('Display name').fill('Passkey Player');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByRole('status')).toHaveText('Name saved.');

  await page.getByRole('button', { name: 'Add a passkey' }).click();
  await expect(page.getByRole('status')).toHaveText('Passkey added.');
  await expect(page.getByText('Passkey account')).toBeVisible();
  await expect(page.getByText('You have 1 passkey.')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your account');
  await expect(page.getByRole('navigation', { name: 'Main' })).toContainText('Passkey Player');

  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await page.getByRole('button', { name: 'Delete account' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('AC-9: the account page has no automatically detectable WCAG 2.2 AA violations', async ({ page }) => {
  await playAsGuest(page);
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)).toEqual([]);
});
