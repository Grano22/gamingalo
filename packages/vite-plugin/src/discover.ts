import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseGameConfig, pluginManifestSchema, type PluginManifest } from '@gamingalo/contracts';
import semver from 'semver';

export interface DiscoveredPlugin {
  /** The package name, which is also how the generated code imports it. */
  name: string;
  version: string;
  manifest: PluginManifest;
  /** From `gamingalo.json`, or an empty object. */
  options: Record<string, unknown>;
}

export interface Discovery {
  plugins: DiscoveredPlugin[];
  /** Plugins installed but turned off with `false` in `gamingalo.json`. */
  disabled: string[];
  sdkVersion: string | undefined;
}

export class PluginDiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PluginDiscoveryError';
  }
}

interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  gamingalo?: unknown;
}

async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw new PluginDiscoveryError(`Could not read ${path}: ${(error as Error).message}`);
  }
}

/** Finds an installed package the way Node does, by walking up through `node_modules` folders. */
async function findPackage(root: string, name: string): Promise<PackageJson | undefined> {
  let dir = root;
  for (;;) {
    const found = await readJson<PackageJson>(join(dir, 'node_modules', name, 'package.json'));
    if (found) return found;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Lists the game's plugins: runtime dependencies whose `package.json` has a `gamingalo` field.
 * Development dependencies are never plugins, because they don't ship with the game. The result is
 * sorted by name, so every build gets the same order.
 */
export async function discoverPlugins(root: string): Promise<Discovery> {
  const project = await readJson<PackageJson>(join(root, 'package.json'));
  if (!project) throw new PluginDiscoveryError(`There is no package.json in ${root}.`);
  const rawConfig = await readJson<unknown>(join(root, 'gamingalo.json'));
  let configured: Record<string, false | Record<string, unknown>> = {};
  if (rawConfig !== undefined) {
    try {
      configured = parseGameConfig(rawConfig).plugins ?? {};
    } catch (error) {
      throw new PluginDiscoveryError(`gamingalo.json is not valid: ${(error as Error).message}`);
    }
  }

  const sdkVersion = (await findPackage(root, '@gamingalo/sdk'))?.version;
  const plugins: DiscoveredPlugin[] = [];
  const disabled: string[] = [];
  const names = Object.keys(project.dependencies ?? {}).sort();

  for (const name of names) {
    const installed = await findPackage(root, name);
    if (!installed) throw new PluginDiscoveryError(`${name} is a dependency, but isn't installed. Run npm install.`);
    if (installed.gamingalo === undefined) continue;

    const parsed = pluginManifestSchema.safeParse(installed.gamingalo);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'gamingalo'}: ${issue.message}`).join('; ');
      throw new PluginDiscoveryError(`${name} has an invalid gamingalo field in its package.json. ${details}`);
    }
    const options = Object.hasOwn(configured, name) ? configured[name] : {};
    if (options === false) {
      disabled.push(name);
      continue;
    }
    if (!sdkVersion) throw new PluginDiscoveryError(`${name} is a Gamingalo plugin, but @gamingalo/sdk isn't installed.`);
    if (!semver.validRange(parsed.data.sdk)) {
      throw new PluginDiscoveryError(`${name} declares an invalid SDK range: ${parsed.data.sdk}`);
    }
    if (!semver.satisfies(sdkVersion, parsed.data.sdk, { includePrerelease: true })) {
      throw new PluginDiscoveryError(
        `${name} ${installed.version ?? ''} needs @gamingalo/sdk ${parsed.data.sdk}, but ${sdkVersion} is installed. Update one of them.`,
      );
    }
    plugins.push({ name, version: installed.version ?? '0.0.0', manifest: parsed.data, options: options ?? {} });
  }

  for (const name of Object.keys(configured)) {
    if (!names.includes(name)) {
      throw new PluginDiscoveryError(`gamingalo.json configures ${name}, but it isn't a dependency in package.json.`);
    }
    if (!plugins.some((plugin) => plugin.name === name) && !disabled.includes(name)) {
      throw new PluginDiscoveryError(`gamingalo.json configures ${name}, but that package isn't a Gamingalo plugin.`);
    }
  }
  return { plugins, disabled, sdkVersion };
}

/** The generated module. Options are embedded as JSON, so they can't inject code. */
export function generatePluginModule(discovery: Discovery): string {
  const imports = discovery.plugins.map(
    (plugin, index) => `import { ${plugin.manifest.export} as plugin${index} } from ${JSON.stringify(plugin.name)};`,
  );
  const created = discovery.plugins.map((plugin, index) => `plugin${index}(${JSON.stringify(plugin.options)})`);
  return [
    '// Generated by @gamingalo/vite-plugin from package.json and gamingalo.json.',
    ...imports,
    `export const plugins = Object.freeze([${created.join(', ')}]);`,
    `export const pluginNames = Object.freeze(${JSON.stringify(discovery.plugins.map((plugin) => plugin.name))});`,
    '',
  ].join('\n');
}
