import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/dist-sea/**', '**/.next/**', '**/out/**', '**/next-env.d.ts', '**/node_modules/**', '**/.nx/**', '**/test-results/**', '**/playwright-report/**', '**/.angular/**'] },
  ...tseslint.configs.recommended,
);
