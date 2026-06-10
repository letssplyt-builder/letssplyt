import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/utils'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['utils/splitCalculator.ts'],
};

export default config;
