import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Node/Express server code (server/, dev/, prisma.config.ts runs in Node)
    files: ['server/**/*.{js,mjs}', 'dev/**/*.{js,mjs}', 'scripts/**/*.{js,cjs,mjs}'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
