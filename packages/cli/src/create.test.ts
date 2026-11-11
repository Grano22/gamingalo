import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createProject, suggestGameId } from './create';

let work: string;
let template: string;

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.email=test@example.com', '-c', 'user.name=Test', ...args], { cwd, stdio: 'pipe' });

/** A small template repository, like the real skeleton. */
async function makeTemplate(templateJson: unknown = {
  formatVersion: 1,
  placeholders: { id: 'my-game', title: 'My game' },
  files: ['package.json', 'gamingalo.json', 'README.md'],
  remove: ['TEMPLATE.md', '.gamingalo'],
}) {
  await mkdir(join(template, '.gamingalo'), { recursive: true });
  await writeFile(join(template, 'package.json'), JSON.stringify({ name: 'my-game', scripts: { memory: 'add my-game' } }));
  await writeFile(join(template, 'gamingalo.json'), JSON.stringify({ id: 'my-game', title: 'My game', version: '1.0.0' }));
  await writeFile(join(template, 'README.md'), '# My game\n\nmy-game is a game.\n');
  await writeFile(join(template, 'TEMPLATE.md'), 'maintainers only');
  await writeFile(join(template, '.gamingalo/template.json'), JSON.stringify(templateJson));
  git(template, 'init', '-q', '-b', 'main');
  git(template, 'add', '.');
  git(template, 'commit', '-q', '-m', 'template');
}

beforeEach(async () => {
  work = await mkdtemp(join(tmpdir(), 'gamingalo-create-'));
  template = join(work, 'template');
  await mkdir(template);
});

afterEach(async () => {
  await rm(work, { recursive: true, force: true });
});

describe('createProject', () => {
  it('clones the template and fills in the ID and title', async () => {
    await makeTemplate();
    const result = await createProject({ directory: join(work, 'Space Race'), template, git: true, title: 'Space Race!' });

    expect(result).toMatchObject({ id: 'space-race', title: 'Space Race!' });
    expect(JSON.parse(await readFile(join(result.root, 'package.json'), 'utf8'))).toEqual({
      name: 'space-race',
      scripts: { memory: 'add space-race' },
    });
    expect(JSON.parse(await readFile(join(result.root, 'gamingalo.json'), 'utf8'))).toMatchObject({ id: 'space-race', title: 'Space Race!' });
    expect(await readFile(join(result.root, 'README.md'), 'utf8')).toBe('# Space Race!\n\nspace-race is a game.\n');
  });

  it("removes the template's own files, and starts a fresh history", async () => {
    await makeTemplate();
    const { root } = await createProject({ directory: join(work, 'game'), template, git: true, id: 'my-new-game' });
    await expect(stat(join(root, 'TEMPLATE.md'))).rejects.toThrow();
    await expect(stat(join(root, '.gamingalo'))).rejects.toThrow();
    expect(() => git(root, 'log')).toThrow();
    expect((await stat(join(root, '.git'))).isDirectory()).toBe(true);
  });

  it('can skip git', async () => {
    await makeTemplate();
    const { root } = await createProject({ directory: join(work, 'game'), template, git: false, id: 'my-new-game' });
    await expect(stat(join(root, '.git'))).rejects.toThrow();
  });

  it('refuses an invalid ID, a folder that is not empty, and option-like values', async () => {
    await makeTemplate();
    await expect(createProject({ directory: join(work, 'g'), template, git: false, id: 'a--b' })).rejects.toThrow(/can't be a game ID/);
    await mkdir(join(work, 'taken'));
    await writeFile(join(work, 'taken', 'file'), 'x');
    await expect(createProject({ directory: join(work, 'taken'), template, git: false, id: 'my-new-game' })).rejects.toThrow(/isn't empty/);
    await expect(createProject({ directory: join(work, 'g2'), template: '--upload-pack=evil', git: false, id: 'my-new-game' })).rejects.toThrow(/must not start/);
  });

  it('cleans up after a failed clone or a bad template', async () => {
    await expect(createProject({ directory: join(work, 'nothing'), template: join(work, 'missing'), git: false, id: 'my-new-game' })).rejects.toThrow(/Could not clone/);
    await expect(stat(join(work, 'nothing'))).rejects.toThrow();

    await makeTemplate({ formatVersion: 1, placeholders: { id: 'my-game', title: 'My game' }, files: ['../outside.txt'], remove: [] });
    await expect(createProject({ directory: join(work, 'bad'), template, git: false, id: 'my-new-game' })).rejects.toThrow(/outside the project/);
    await expect(stat(join(work, 'bad'))).rejects.toThrow();
  });
});

describe('suggestGameId', () => {
  it.each([
    ['My Game!', 'my-game'],
    ['  space__race  ', 'space-race'],
    ['Ünïcode Game', 'n-code-game'],
  ])('turns %s into %s', (name, id) => {
    expect(suggestGameId(name)).toBe(id);
  });
});
