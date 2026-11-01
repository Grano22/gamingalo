import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [dts({ exclude: ['**/*.test.ts', 'vite.config.ts'] })],
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' },
    rollupOptions: { external: ['zod'] },
    target: 'es2022',
    sourcemap: true,
  },
});
