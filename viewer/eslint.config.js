import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'coverage/', 'test/e2e/.results/', 'playwright-report/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['scripts/**', 'test/e2e/**', 'playwright.config.ts'],
    languageOptions: {
      globals: { URL: 'readonly', console: 'readonly', process: 'readonly', document: 'readonly', getComputedStyle: 'readonly', HTMLElement: 'readonly' },
    },
  },
);
