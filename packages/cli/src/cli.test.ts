import { cp, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { creator, startService, type TestService } from '../../../apps/api/src/test-support';
import type { Runtime } from './commands';
import { createProgram } from './program';
import { buildManifest, loadProject } from './project';

let service: TestService;
let apiUrl: string;
let token: string;
let work: string;

beforeAll(async () => {
  service = await startService();
  await service.app.listen({ port: 0, host: '127.0.0.1' });
  apiUrl = `http://127.0.0.1:${(service.app.server.address() as AddressInfo).port}`;
  token = (await creator(service)).token;
});

afterAll(async () => {
  await service.close();
});

beforeEach(async () => {
  work = await mkdtemp(join(tmpdir(), 'gamingalo-cli-'));
  await cp(new URL('../test-fixtures/sample-game', import.meta.url).pathname, join(work, 'game'), { recursive: true });
  // Created here, because .gitignore keeps .DS_Store files out of the repository.
  await writeFile(join(work, 'game/public/.DS_Store'), '');
});

async function run(args: string[], env: NodeJS.ProcessEnv = {}, stdin = '') {
  const lines: string[] = [];
  const runtime: Runtime = {
    env: { GAMINGALO_CONFIG_DIR: join(work, 'config'), ...env },
    fetch,
    readStdin: async () => stdin,
    output: { info: (message) => lines.push(message), warn: (message) => lines.push(`warn: ${message}`) },
  };
  const program = createProgram(runtime).exitOverride();
  await program.parseAsync(['node', 'gamingalo', ...args, ...(args[0]?.startsWith('game:') ? ['--dir', join(work, 'game')] : [])]);
  return lines;
}

const signedIn = { GAMINGALO_TOKEN: '', GAMINGALO_API_URL: '' };

describe('project validation', () => {
  it('lists files, skips hidden ones, and builds a manifest at the current format', async () => {
    const project = await loadProject(join(work, 'game'));
    expect(project.problems).toEqual([]);
    expect(project.files.map((file) => file.path)).toEqual(['assets/logo.svg', 'game.js', 'index.html']);
    expect(project.skipped).toEqual(['.DS_Store (hidden)']);
    expect(buildManifest(project)).toMatchObject({ formatVersion: 1, gameId: 'sample-game', entry: 'index.html' });
  });

  it('reports budgets, disallowed files and a missing entry', async () => {
    const config = JSON.parse(await readFile(join(work, 'game/gamingalo.json'), 'utf8'));
    config.budgets = { maxFiles: 1, maxFileBytes: 10, maxTotalBytes: 20 };
    config.entry = 'start.html';
    await writeFile(join(work, 'game/gamingalo.json'), JSON.stringify(config));
    await writeFile(join(work, 'game/public/tool.exe'), 'x');

    const { problems } = await loadProject(join(work, 'game'));

    expect(problems.join('\n')).toContain('tool.exe: This file type is not allowed.');
    expect(problems.join('\n')).toContain('The entry file start.html is missing');
    expect(problems.join('\n')).toContain('maxFiles is 1');
    expect(problems.join('\n')).toContain('maxTotalBytes is 20');
    expect(problems.join('\n')).toContain('maxFileBytes is 10');
  });

  it('refuses symbolic links and a folder outside the project', async () => {
    await symlink('/etc/hosts', join(work, 'game/public/hosts.txt'));
    expect((await loadProject(join(work, 'game'))).problems.join()).toContain('symbolic links');

    const config = JSON.parse(await readFile(join(work, 'game/gamingalo.json'), 'utf8'));
    await writeFile(join(work, 'game/gamingalo.json'), JSON.stringify({ ...config, dir: '../' }));
    await expect(loadProject(join(work, 'game'))).rejects.toThrow(/inside the project/);
  });

  it('explains an invalid or too new gamingalo.json', async () => {
    await writeFile(join(work, 'game/gamingalo.json'), JSON.stringify({ id: 'Bad', title: 'x', version: '1' }));
    await expect(loadProject(join(work, 'game'))).rejects.toThrow(/gamingalo.json is not valid. id:/);
    await writeFile(join(work, 'game/gamingalo.json'), JSON.stringify({ schemaVersion: 9, id: 'a-b-c', title: 'x', version: '1.0.0' }));
    await expect(loadProject(join(work, 'game'))).rejects.toThrow(/newer than this tool supports/);
  });
});

describe('commands', () => {
  it('logs in from stdin, keeping the token in a private file', async () => {
    const lines = await run(['login', '--token-stdin', '--api-url', apiUrl], signedIn, `${token}\n`);
    const file = join(work, 'config/credentials.json');
    expect(lines.join()).toContain('Signed in');
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ apiUrl, token });
    expect((await stat(file)).mode & 0o777).toBe(0o600);
  });

  it('refuses a bad token at login, and saves nothing', async () => {
    await expect(run(['login', '--token-stdin', '--api-url', apiUrl], signedIn, 'gmg_wrong')).rejects.toThrow(/not valid/);
    await expect(stat(join(work, 'config/credentials.json'))).rejects.toThrow();
  });

  it('creates, signs, publishes, lists and rolls back a game', async () => {
    const env = { GAMINGALO_TOKEN: token, GAMINGALO_API_URL: apiUrl };
    expect((await run(['game:create'], env)).join()).toContain('http://sample-game.games.localhost:3001/');
    await run(['game:keys:create'], env);
    expect((await stat(join(work, 'config/keys/sample-game.pem'))).mode & 0o777).toBe(0o600);

    const first = await run(['game:publish'], env);
    expect(first.join('\n')).toContain('Published sample-game 1.0.0 to production: uploaded 3 of 3 files');
    expect(first.join('\n')).toContain('warn: Skipped .DS_Store (hidden)');

    const served = await service.games.inject({ url: '/', headers: { host: 'sample-game.games.localhost:3001' } });
    expect(served.body).toContain('<h1>Sample game</h1>');

    const config = JSON.parse(await readFile(join(work, 'game/gamingalo.json'), 'utf8'));
    await writeFile(join(work, 'game/gamingalo.json'), JSON.stringify({ ...config, version: '1.1.0' }));
    await writeFile(join(work, 'game/public/game.js'), 'document.body.dataset.ready = "v2";');
    const second = await run(['game:publish', '--channel', 'preview'], env);
    expect(second.join()).toContain('uploaded 1 of 3 files');
    expect(second.join()).toContain('preview--sample-game');

    const versions = (await run(['game:versions'], env)).join('\n');
    expect(versions).toMatch(/1\.1\.0\s+ready.*\(preview\)/);
    expect(versions).toMatch(/1\.0\.0\s+ready.*\(production\)/);

    await run(['game:promote', '1.1.0'], env);
    expect((await service.games.inject({ url: '/game.js', headers: { host: 'sample-game.games.localhost:3001' } })).body).toContain('v2');
    await run(['game:rollback', '1.0.0'], env);
    expect((await service.games.inject({ url: '/game.js', headers: { host: 'sample-game.games.localhost:3001' } })).body).toContain('"true"');
  });

  it('refuses to publish without a signing key, or with problems', async () => {
    const env = { GAMINGALO_TOKEN: token, GAMINGALO_API_URL: apiUrl };
    const config = JSON.parse(await readFile(join(work, 'game/gamingalo.json'), 'utf8'));
    await writeFile(join(work, 'game/gamingalo.json'), JSON.stringify({ ...config, id: 'unsigned-game' }));
    await run(['game:create'], env);
    await expect(run(['game:publish'], env)).rejects.toThrow(/No signing key/);

    await writeFile(join(work, 'game/public/tool.exe'), 'x');
    await expect(run(['game:publish'], env)).rejects.toThrow(/can't be published/);
  });

  it('validates without signing in, and rejects bad arguments', async () => {
    expect((await run(['game:validate'], signedIn)).join()).toContain('Ready to publish');
    await expect(run(['game:promote', 'not-a-version'], signedIn)).rejects.toThrow();
    await expect(run(['game:publish', '--channel', 'beta'], signedIn)).rejects.toThrow();
  });

  it('asks to sign in when there is no token', async () => {
    await expect(run(['game:versions'], signedIn)).rejects.toThrow(/Not signed in/);
  });

  it('removes credentials on logout', async () => {
    await run(['login', '--token-stdin', '--api-url', apiUrl], signedIn, token);
    await run(['logout'], signedIn);
    await expect(stat(join(work, 'config/credentials.json'))).rejects.toThrow();
  });
});

afterAll(async () => {
  await rm(work, { recursive: true, force: true });
});
