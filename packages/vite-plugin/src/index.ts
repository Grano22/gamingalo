import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { discoverPlugins, generatePluginModule } from './discover';

export { discoverPlugins, generatePluginModule, PluginDiscoveryError } from './discover';
export type { DiscoveredPlugin, Discovery } from './discover';

const VIRTUAL_ID = 'virtual:gamingalo-plugins';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

export interface GamingaloVitePluginOptions {
  /** The folder with package.json and gamingalo.json. Defaults to the Vite root. */
  root?: string;
}

/**
 * Makes installing a plugin package the same as adding it to the SDK. Import `plugins` from
 * `virtual:gamingalo-plugins` and pass it to `Gamingalo.init({ plugins })`.
 */
export function gamingalo(options: GamingaloVitePluginOptions = {}): Plugin {
  let root = options.root ?? process.cwd();

  return {
    name: 'gamingalo',
    enforce: 'pre',
    configResolved(config) {
      root = resolve(options.root ?? config.root);
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return undefined;
      this.addWatchFile(resolve(root, 'package.json'));
      this.addWatchFile(resolve(root, 'gamingalo.json'));
      const discovery = await discoverPlugins(root);
      for (const name of discovery.disabled) this.info(`${name} is turned off in gamingalo.json.`);
      return generatePluginModule(discovery);
    },
    configureServer(server) {
      // Installing a package or changing plugin options reloads the game in development.
      const files = [resolve(root, 'package.json'), resolve(root, 'gamingalo.json')];
      server.watcher.add(files);
      server.watcher.on('change', (file) => {
        if (!files.includes(resolve(file))) return;
        const module = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

export default gamingalo;
