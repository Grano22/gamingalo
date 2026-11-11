import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { discoverPlugins, gamingalo, generatePluginModule } from './index';

let root: string;

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, JSON.stringify(value));
}

/** Writes a package into node_modules, as npm would install it. */
async function install(name: string, packageJson: Record<string, unknown>, code = ''): Promise<void> {
  const dir = join(root, 'node_modules', name);
  await writeJson(join(dir, 'package.json'), { name, version: '1.0.0', type: 'module', main: 'index.js', ...packageJson });
  await writeFile(join(dir, 'index.js'), code);
}

async function project(dependencies: Record<string, string>, config?: Record<string, unknown>): Promise<void> {
  await writeJson(join(root, 'package.json'), { name: 'game', dependencies });
  if (config) await writeJson(join(root, 'gamingalo.json'), { id: 'my-game', title: 'Game', version: '1.0.0', ...config });
}

const manifest = { gamingalo: { formatVersion: 1, sdk: '>=0.14.0 <1.0.0' } };

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'gamingalo-vite-'));
  await install('@gamingalo/sdk', { version: '0.15.0' }, 'export const Gamingalo = {};');
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('discoverPlugins', () => {
  it('finds runtime dependencies with a gamingalo field, sorted by name', async () => {
    await install('zeta-plugin', manifest);
    await install('alpha-plugin', { gamingalo: { formatVersion: 1, sdk: '*', export: 'createAlpha' } });
    await install('lodash', {});
    await project({ '@gamingalo/sdk': '*', 'zeta-plugin': '*', 'alpha-plugin': '*', lodash: '*' });

    const { plugins } = await discoverPlugins(root);

    expect(plugins.map((plugin) => [plugin.name, plugin.manifest.export])).toEqual([
      ['alpha-plugin', 'createAlpha'],
      ['zeta-plugin', 'gamingaloPlugin'],
    ]);
  });

  it('ignores development dependencies, which do not ship with the game', async () => {
    await install('dev-plugin', manifest);
    await writeJson(join(root, 'package.json'), { name: 'game', dependencies: { '@gamingalo/sdk': '*' }, devDependencies: { 'dev-plugin': '*' } });
    expect((await discoverPlugins(root)).plugins).toEqual([]);
  });

  it('passes options from gamingalo.json, and false turns a plugin off', async () => {
    await install('a-plugin', manifest);
    await install('b-plugin', manifest);
    await project({ '@gamingalo/sdk': '*', 'a-plugin': '*', 'b-plugin': '*' }, { plugins: { 'a-plugin': { level: 2 }, 'b-plugin': false } });

    const discovery = await discoverPlugins(root);

    expect(discovery.plugins.map((plugin) => [plugin.name, plugin.options])).toEqual([['a-plugin', { level: 2 }]]);
    expect(discovery.disabled).toEqual(['b-plugin']);
  });

  it('refuses a plugin that does not support the installed SDK', async () => {
    await install('old-plugin', { version: '2.0.0', gamingalo: { formatVersion: 1, sdk: '<0.10.0' } });
    await project({ '@gamingalo/sdk': '*', 'old-plugin': '*' });
    await expect(discoverPlugins(root)).rejects.toThrow(/old-plugin 2.0.0 needs @gamingalo\/sdk <0.10.0, but 0.15.0 is installed/);
  });

  it.each([
    ['an invalid manifest', { gamingalo: { formatVersion: 9, sdk: '*' } }, /invalid gamingalo field/],
    ['an invalid range', { gamingalo: { formatVersion: 1, sdk: 'not a range' } }, /invalid SDK range/],
  ])('refuses %s', async (_name, packageJson, message) => {
    await install('bad-plugin', packageJson);
    await project({ '@gamingalo/sdk': '*', 'bad-plugin': '*' });
    await expect(discoverPlugins(root)).rejects.toThrow(message);
  });

  it('refuses options for packages that are missing or are not plugins', async () => {
    await install('lodash', {});
    await project({ '@gamingalo/sdk': '*', lodash: '*' }, { plugins: { 'not-installed': {} } });
    await expect(discoverPlugins(root)).rejects.toThrow(/isn't a dependency/);

    await project({ '@gamingalo/sdk': '*', lodash: '*' }, { plugins: { lodash: {} } });
    await expect(discoverPlugins(root)).rejects.toThrow(/isn't a Gamingalo plugin/);
  });

  it('asks for npm install when a dependency is missing', async () => {
    await project({ '@gamingalo/sdk': '*', 'never-installed': '*' });
    await expect(discoverPlugins(root)).rejects.toThrow(/Run npm install/);
  });

  it('finds packages hoisted to a parent folder, as in a workspace', async () => {
    const nested = join(root, 'games', 'my-game');
    await install('hoisted-plugin', manifest);
    await writeJson(join(nested, 'package.json'), { name: 'game', dependencies: { 'hoisted-plugin': '*' } });
    expect((await discoverPlugins(nested)).plugins.map((plugin) => plugin.name)).toEqual(['hoisted-plugin']);
  });
});

describe('generatePluginModule', () => {
  it('embeds options as JSON, so they cannot inject code', () => {
    const code = generatePluginModule({
      sdkVersion: '0.15.0',
      disabled: [],
      plugins: [
        { name: 'a-plugin', version: '1.0.0', manifest: { formatVersion: 1, sdk: '*', export: 'gamingaloPlugin' }, options: { x: '"); alert(1); ("' } },
      ],
    });
    expect(code).toContain('import { gamingaloPlugin as plugin0 } from "a-plugin";');
    expect(code).toContain('plugin0({"x":"\\"); alert(1); (\\""})');
  });
});

describe('vite build', () => {
  it('bundles installed plugins into the game, with their options', async () => {
    await install('glow-plugin', manifest, 'export function gamingaloPlugin(options) { return { name: "glow", setup: () => ({ level: options.level }) }; }');
    await project({ '@gamingalo/sdk': '*', 'glow-plugin': '*' }, { plugins: { 'glow-plugin': { level: 7 } } });
    await writeFile(join(root, 'main.js'), 'import { plugins, pluginNames } from "virtual:gamingalo-plugins"; window.result = [pluginNames, plugins.map((p) => p.setup().level)];');

    await build({
      root,
      logLevel: 'silent',
      plugins: [gamingalo()],
      build: { outDir: 'out', lib: { entry: join(root, 'main.js'), formats: ['es'], fileName: 'main' } },
    });

    const output = await readFile(join(root, 'out', (await readdir(join(root, 'out')))[0] as string), 'utf8');
    expect(output).toContain('name: "glow"');
    expect(output).toContain('"glow-plugin"');
    expect(output).toContain('level: 7');
  });

  it('fails the build with a clear message for an incompatible plugin', async () => {
    await install('old-plugin', { gamingalo: { formatVersion: 1, sdk: '<0.1.0' } });
    await project({ '@gamingalo/sdk': '*', 'old-plugin': '*' });
    await writeFile(join(root, 'main.js'), 'import { plugins } from "virtual:gamingalo-plugins"; console.log(plugins);');
    await expect(
      build({ root, logLevel: 'silent', plugins: [gamingalo()], build: { outDir: 'out', lib: { entry: join(root, 'main.js'), formats: ['es'], fileName: 'main' } } }),
    ).rejects.toThrow(/needs @gamingalo\/sdk <0.1.0/);
  });
});
