module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    'no-console': 'warn',
  },
  ignorePatterns: ['dist/', 'node_modules/', '.expo/', 'coverage/'],
  overrides: [
    {
      files: [
        '**/__tests__/**/*',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/__tests__/**/*.tsx',
      ],
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        'prefer-const': 'off',
      },
    },
  ],
};
