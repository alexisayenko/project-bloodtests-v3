import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    // Generated from public/schema/bloodtests-3.schema.json by
    // scripts/generate-envelope-types.mjs — never hand-edited.
    'src/data/envelopeTypes.ts',
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
