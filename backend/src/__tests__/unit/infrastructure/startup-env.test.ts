import { describe, it, expect } from '@jest/globals';
import { validateStartupEnv, StartupEnvError } from '../../../infrastructure/startup-env';

describe('validateStartupEnv', () => {
  it('accepts development, test, staging, and production', () => {
    expect(validateStartupEnv({ APP_ENV: 'development' })).toBe('development');
    expect(validateStartupEnv({ APP_ENV: 'test' })).toBe('test');
    expect(validateStartupEnv({ APP_ENV: 'staging' })).toBe('staging');
    expect(validateStartupEnv({ APP_ENV: 'production' })).toBe('production');
  });

  it('throws when APP_ENV is missing', () => {
    expect(() => validateStartupEnv({})).toThrow(StartupEnvError);
    expect(() => validateStartupEnv({})).toThrow(/APP_ENV is required/);
  });

  it('throws when APP_ENV is blank', () => {
    expect(() => validateStartupEnv({ APP_ENV: '   ' })).toThrow(StartupEnvError);
  });

  it('throws when APP_ENV is unknown', () => {
    expect(() => validateStartupEnv({ APP_ENV: 'local' })).toThrow(/must be one of/);
  });
});
