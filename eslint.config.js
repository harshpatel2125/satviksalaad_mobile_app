// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'ios/*', 'android/*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', {
        vars: 'all',
        args: 'none',
        ignoreRestSiblings: true,
        caughtErrors: 'all',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
      // TypeScript already checks namespace members; this rule cannot follow `export *` from a .d.ts.
      'import/namespace': 'off',
      // React Compiler rules added in eslint-config-expo 58. The compiler skips the components they
      // flag, so they stay warnings until those components are reworked.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
]);
