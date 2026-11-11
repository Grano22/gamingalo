import { builtinModules } from 'node:module';
import { defineConfig } from 'vitest/config';
import dts from 'vite-plugin-dts';

export default defineConfig({
  // A cache per project, because Vitest processes running in parallel clear a shared one.
  cacheDir: 'node_modules/.vite',
  plugins: [dts({ exclude: ['**/*.test.ts', 'vite.config.ts'], bundleTypes: { bundledPackages: ['@gamingalo/contracts'] } })],
  build: {
    ssr: true,
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' },
    target: 'node22',
    sourcemap: true,
    rollupOptions: {
      external: [...builtinModules, ...builtinModules.map((name) => `node:${name}`), 'vite', 'semver', 'zod'],
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'], testTimeout: 30000 },
});
