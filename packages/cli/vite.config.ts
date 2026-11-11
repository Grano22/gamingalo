import { readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { defineConfig } from 'vitest/config';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  define: { __CLI_VERSION__: JSON.stringify(version) },
  build: {
    ssr: 'src/cli.ts',
    target: 'node22',
    sourcemap: true,
    rollupOptions: {
      external: [...builtinModules, ...builtinModules.map((name) => `node:${name}`), 'commander', 'zod'],
      output: { banner: '#!/usr/bin/env node' },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'], testTimeout: 30000 },
});
