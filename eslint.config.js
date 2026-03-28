// @ts-check
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const tsParser = require('@typescript-eslint/parser')

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  // ESLint v9 全域 ignores（CJS 版本）
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // TypeScript 型別安全核心規則
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'warn',
      // 本專案大量使用 console 輸出診斷訊息，故關閉
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
]
