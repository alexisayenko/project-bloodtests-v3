import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    // Legacy pre-nav flow, not wired into App.tsx (see CLAUDE.md) — linted
    // again if/when it returns or moves to archive/.
    'src/components/layout',
    'src/components/panels',
    'src/components/results',
    'src/components/upload',
    'src/components/analytics',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Context modules export a provider component plus its hook — the standard
    // React context pattern; the fast-refresh-purity rule doesn't apply well.
    files: ['**/*Context.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
