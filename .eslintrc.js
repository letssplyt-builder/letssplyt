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
    // PostgREST filter injection guard (audit M4 / PA-17): use .eq/.in or multi-query merge instead.
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.property.name='or'] TemplateLiteral",
        message:
          'Avoid template literals in PostgREST .or() filters; use typed .eq/.in builders or merge separate queries.',
      },
    ],
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
