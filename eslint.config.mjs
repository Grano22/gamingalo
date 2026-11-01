import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.nx/**', '**/test-results/**', '**/playwright-report/**', '**/.angular/**'] },
  ...tseslint.configs.recommended,
);
