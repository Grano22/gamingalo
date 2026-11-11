import { builtinModules } from 'node:module';
import { defineConfig } from 'vitest/config';

// Workspace packages are bundled. Published dependencies stay external and come from node_modules.
const external = [
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
  /^fastify/,
  /^@fastify\//,
  'pg',
  /^@electric-sql\//,
  'zod',
];

export default defineConfig({
  // A cache per project, because Vitest processes running in parallel clear a shared one.
  cacheDir: 'node_modules/.vite',
  build: {
    ssr: 'src/main.ts',
    target: 'node22',
    sourcemap: true,
    rollupOptions: { external },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'], testTimeout: 20000 },
});
