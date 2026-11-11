import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  // A cache per project, because Vitest processes running in parallel clear a shared one.
  cacheDir: 'node_modules/.vite',
  plugins: [dts({ exclude: ['**/*.test.ts', 'vite.config.ts'] })],
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' },
    rollupOptions: { external: ['zod'] },
    target: 'es2022',
    sourcemap: true,
  },
});
