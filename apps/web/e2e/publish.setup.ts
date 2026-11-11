import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test as setup } from '@playwright/test';
import { PUBLISHED_GAME_FILE } from './published-game';

const run = promisify(execFile);
const here = new URL('.', import.meta.url).pathname;

setup('a creator publishes a game with the CLI', async ({ page }) => {
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

  await page.goto('/sign-in');
  await page.getByLabel('16 or older').check();
  await page.getByRole('button', { name: 'Play as a guest' }).click();
  await page.getByRole('button', { name: 'Add a passkey' }).click();
  await expect(page.getByRole('status')).toHaveText('Passkey added.');

  await page.getByRole('link', { name: 'Creator' }).click();
  await page.getByLabel('Token name').fill('E2E');
  await page.getByRole('button', { name: 'Create token' }).click();
  const token = await page.getByLabel('Your new token. It won’t be shown again.').inputValue();
  expect(token).toMatch(/^gmg_/);

  // A game folder with the built SDK inside it, as a game maker would ship it.
  const id = `e2e-${Date.now().toString(36)}`;
  const work = await mkdtemp(join(tmpdir(), 'gamingalo-e2e-'));
  const dist = join(work, 'dist');
  await mkdir(join(dist, 'sdk'), { recursive: true });
  await cp(join(here, 'sample-game/index.html'), join(dist, 'index.html'));
  const script = (await readFile(join(here, 'sample-game/game.js'), 'utf8'))
    .replace('__GAME_ID__', id)
    .replace('__PLATFORM_ORIGIN__', new URL(page.url()).origin);
  await writeFile(join(dist, 'game.js'), script);
  const sdkDist = join(here, '../../../packages/sdk/dist');
  for (const file of await readdir(sdkDist)) {
    if (file.endsWith('.js')) await cp(join(sdkDist, file), join(dist, 'sdk', file));
  }
  await writeFile(join(work, 'gamingalo.json'), JSON.stringify({ schemaVersion: 1, id, title: 'E2E game', version: '1.0.0' }));

  const cli = join(here, '../../../packages/cli/dist/cli.js');
  const env = {
    ...process.env,
    GAMINGALO_TOKEN: token,
    GAMINGALO_API_URL: 'http://localhost:4322',
    GAMINGALO_CONFIG_DIR: join(work, 'config'),
  };
  for (const command of ['game:create', 'game:keys:create', 'game:validate', 'game:publish']) {
    const { stdout } = await run('node', [cli, command, '--dir', work], { env });
    if (command === 'game:publish') expect(stdout).toContain(`Published ${id} 1.0.0 to production`);
  }

  await page.reload();
  await expect(page.getByRole('heading', { name: 'E2E game' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'production' })).toBeVisible();
  await writeFile(PUBLISHED_GAME_FILE, JSON.stringify({ id, title: 'E2E game' }));
});
