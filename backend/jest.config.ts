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
  // Per-file 100% gates run in CI (mandated for PII + financial code). Global thresholds are local-only
  // aspirational targets until overall backend coverage reaches the bar.
  coverageThreshold: {
    './src/infrastructure/security/crypto.ts': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    './src/infrastructure/security/sanitize.ts': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    ...(process.env.CI !== 'true'
      ? {
          global: {
            lines: 80,
            branches: 70,
            functions: 80,
            statements: 80,
          },
        }
      : {}),
  } as Config['coverageThreshold'],
  setupFilesAfterEnv: ['./src/__tests__/setup.ts'],
  moduleNameMapper: {
    '@letssplyt/shared/paymentHandleValidation':
      '<rootDir>/../shared/utils/paymentHandleValidation.ts',
    '@letssplyt/shared/paymentLinks': '<rootDir>/../shared/utils/paymentLinks.ts',
    '@letssplyt/shared/utils/splitCalculator': '<rootDir>/../shared/utils/splitCalculator.ts',
    '@letssplyt/shared/utils/receiptDiscounts': '<rootDir>/../shared/utils/receiptDiscounts.ts',
    '@letssplyt/shared/(.*)': '<rootDir>/../shared/types/$1',
  },
};

export default config;
