const tsParser = require('@typescript-eslint/parser')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const importPlugin = require('eslint-plugin-import')

module.exports = [
  {
    // Flat config ignores replaces .eslintignore in ESLint v9+
    ignores: ['node_modules/', 'dist/', 'drizzle/', 'drizzle.config.ts']
  },
  {
    // Explicitly disable type-aware linting for drizzle.config.ts to avoid parserOptions.project errors
    files: ['drizzle.config.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        // Disable project-based parsing for this standalone config file
        project: false,
        tsconfigRootDir: __dirname,
        sourceType: 'module',
        ecmaVersion: 'latest'
      }
    },
    rules: {}
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        // Use a dedicated tsconfig for ESLint if available; fallback to normal tsconfig
        project: './tsconfig.eslint.json',
        tsconfigRootDir: __dirname,
        sourceType: 'module',
        ecmaVersion: 'latest'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json'
        }
      }
    },
    rules: {
      // Base
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',

      // import plugin - disabled because it conflicts with TypeScript path mapping
      'import/no-unresolved': 'off',

      // TS strictness
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/consistent-type-imports': 'error'
    }
  }
]