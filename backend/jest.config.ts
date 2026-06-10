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
  coverageThreshold: {
    global: {
      lines: 80,
      branches: 70,
      functions: 80,
      statements: 80,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['./src/__tests__/setup.ts'],
  moduleNameMapper: {
    '@letssplyt/shared/paymentHandleValidation':
      '<rootDir>/../shared/utils/paymentHandleValidation.ts',
    '@letssplyt/shared/utils/splitCalculator': '<rootDir>/../shared/utils/splitCalculator.ts',
    '@letssplyt/shared/(.*)': '<rootDir>/../shared/types/$1',
  },
};

export default config;
