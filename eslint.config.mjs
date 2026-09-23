import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'coverage/', 'badges/', '.angular/', 'tools/system-npm/'],
  },
  eslint.configs.recommended,
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        project: [
          './projects/ngx-signal-flow/tsconfig.lib.json',
          './projects/ngx-signal-flow/tsconfig.spec.json',
          './projects/example/tsconfig.app.json',
          './projects/example/tsconfig.spec.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/restrict-template-expressions': ['error', {allowNumber: true}],
    },
  },
  {
    files: ['**/*.spec.ts', 'projects/ngx-signal-flow/src/lib/integration/**/*.ts'],
    rules: {
      '@typescript-eslint/no-invalid-void-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    files: ['**/*.mjs', '**/*.js'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        globalThis: 'readonly',
      },
    },
  },
  prettier,
);
