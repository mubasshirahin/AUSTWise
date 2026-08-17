import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import unusedImports from 'eslint-plugin-unused-imports'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dev', 'qa-*', 'test-car-*', 'verify-glow.mjs']),
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        google: 'readonly',
        YouTubePlayer: 'readonly',
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      // Unused imports/vars should be removed, not just reported. The
      // unused-imports plugin provides safe autofixes for both.
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': ['error', {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
      }],

      // Empty catch blocks (offline / best-effort fallbacks) are intentional.
      'no-empty': ['error', { allowEmptyCatch: true }],

      // React Compiler-era rules: useful signals but not worth blocking errors
      // on a legacy codebase. Keep them visible as warnings.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/exhaustive-deps': 'warn',

      // Fast-refresh convenience hint, not a correctness error.
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    // Node-side code: server runtime + build/config scripts.
    files: ['server/**/*.{js,mjs}', 'scripts/**/*.{js,mjs,cjs}', 'vite.config.js', '*.config.js', '*.config.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        google: 'readonly',
        YouTubePlayer: 'readonly',
      },
    },
  },
])