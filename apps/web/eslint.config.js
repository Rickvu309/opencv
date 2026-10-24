import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['src/features/paper/**/*.{ts,tsx}'],
    rules: {
      // Prototype-port reset, debounce, and dropdown mount flags.
      'react-hooks/set-state-in-effect': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: [
      'src/features/paper/**/*.{ts,tsx}',
      'src/features/apply/**/*.{ts,tsx}',
      'src/features/pitch/**/*.{ts,tsx}',
    ],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/router', '@/router.*'],
              message: 'A surface feature must not import the router.',
            },
            {
              group: [
                '@/features/app-shell/*',
                '!@/features/app-shell/use-media-query.ts',
                '!@/features/app-shell/profile-display.ts',
              ],
              message: 'A surface feature must not import shell chrome.',
            },
            {
              group: ['@/components/search-modal*'],
              message: 'A surface feature must not import the search modal.',
            },
          ],
        },
      ],
    },
  },
])
