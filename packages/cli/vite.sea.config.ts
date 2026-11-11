import { readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/** One CommonJS file with every dependency inside, for a Node single executable application. */
export default defineConfig({
  define: { __CLI_VERSION__: JSON.stringify(version) },
  build: {
    ssr: 'src/cli.ts',
    target: 'node22',
    outDir: 'dist-sea',
    emptyOutDir: true,
    minify: true,
    rollupOptions: {
      external: [...builtinModules, ...builtinModules.map((name) => `node:${name}`)],
      output: { format: 'cjs', entryFileNames: 'gamingalo.cjs', inlineDynamicImports: true },
    },
  },
  ssr: { noExternal: true },
});
