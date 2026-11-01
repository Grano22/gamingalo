import { defineConfig } from 'vitest/config';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      exclude: ['**/*.test.ts', 'src/test-helpers.ts', 'e2e/**', '*.config.ts'],
      // Dependencies are bundled, so the published types must not refer to them.
      bundleTypes: { bundledPackages: ['@gamingalo/errors'] },
    }),
  ],
  build: {
    lib: { entry: { index: 'src/index.ts', testing: 'src/testing.ts' }, formats: ['es'] },
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
});
