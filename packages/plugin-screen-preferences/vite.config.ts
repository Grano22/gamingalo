import { defineConfig } from 'vitest/config';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [dts({ exclude: ['**/*.test.ts', 'e2e/**', '*.config.ts'] })],
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' },
    target: 'es2022',
    sourcemap: true,
  },
  test: { environment: 'happy-dom', include: ['src/**/*.test.ts'] },
});
