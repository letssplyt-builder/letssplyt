import type { Config } from 'jest';

const config: Config = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['./src/__tests__/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo|@expo|expo-modules-core|@unimodules|unimodules|sentry-expo|native-base|@react-navigation|react-navigation|react-native-phone-number-input|@letssplyt)/)',
  ],
  moduleNameMapper: {
    '@letssplyt/shared/paymentHandleValidation': '<rootDir>/../shared/utils/paymentHandleValidation.ts',
    '@letssplyt/shared/utils/splitCalculator': '<rootDir>/../shared/utils/splitCalculator.ts',
    '@letssplyt/shared/utils/receiptDiscounts': '<rootDir>/../shared/utils/receiptDiscounts.ts',
    '@letssplyt/shared/(.*)': '<rootDir>/../shared/types/$1',
    '^expo-haptics$': '<rootDir>/src/__tests__/mocks/expo-haptics.ts',
    '^expo-constants$': '<rootDir>/src/__tests__/mocks/expo-constants.ts',
    '^expo-linear-gradient$': '<rootDir>/src/__tests__/mocks/expo-linear-gradient.tsx',
    '^expo-status-bar$': '<rootDir>/src/__tests__/mocks/expo-status-bar.tsx',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/src/__tests__/mocks/fileMock.ts',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx',
    '!src/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      lines: 70,
      branches: 60,
    },
  },
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],
  // Full-suite coverage on GitHub Actions can exceed the default 5s on async UI tests.
  testTimeout: 15000,
};

export default config;
