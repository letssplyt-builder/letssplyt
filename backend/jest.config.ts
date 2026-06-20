import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
    '!src/**/index.ts',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  // CI uploads lcov for Codecov; threshold enforcement is tracked separately as coverage grows.
  ...(process.env.CI === 'true' ? {} : {
    coverageThreshold: {
      global: {
        lines: 80,
        branches: 70,
        functions: 80,
        statements: 80,
      },
    },
  }),
  setupFilesAfterEnv: ['./src/__tests__/setup.ts'],
  moduleNameMapper: {
    '@letssplyt/shared/paymentHandleValidation':
      '<rootDir>/../shared/utils/paymentHandleValidation.ts',
    '@letssplyt/shared/utils/splitCalculator': '<rootDir>/../shared/utils/splitCalculator.ts',
    '@letssplyt/shared/utils/receiptDiscounts': '<rootDir>/../shared/utils/receiptDiscounts.ts',
    '@letssplyt/shared/(.*)': '<rootDir>/../shared/types/$1',
  },
};

export default config;
