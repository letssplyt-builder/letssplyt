import { describe, expect, it, afterEach } from '@jest/globals';
import {
  loadConfig,
  normalizeWebOrigin,
  resetConfigForTests,
  resolveAppDomainConfig,
  resolveAppUrl,
} from '../../../infrastructure/config';

describe('config', () => {
  afterEach(() => {
    resetConfigForTests();
  });

  it('normalizeWebOrigin adds https for domain-only values', () => {
    expect(normalizeWebOrigin('letssplyt.app')).toBe('https://letssplyt.app');
    expect(normalizeWebOrigin('https://staging.letssplyt.com')).toBe(
      'https://staging.letssplyt.com',
    );
    expect(normalizeWebOrigin('http://localhost:3000/')).toBe('http://localhost:3000');
  });

  it('resolveAppDomainConfig allows localhost fallback in development', () => {
    const result = resolveAppDomainConfig(undefined, 'development');
    expect(result.appBaseUrl).toBe('http://localhost:3000');
    expect(result.corsOrigins).toEqual(['http://localhost:3000']);
  });

  it('resolveAppDomainConfig requires APP_DOMAIN in production', () => {
    expect(() => resolveAppDomainConfig(undefined, 'production')).toThrow(/APP_DOMAIN is required/);
  });

  it('resolveAppUrl requires APP_URL in staging when unset', () => {
    expect(() => resolveAppUrl(undefined, 'staging', 'https://letssplyt.app')).toThrow(
      /APP_URL is required/,
    );
  });

  it('loadConfig parses comma-separated CORS origins', () => {
    const config = loadConfig({
      APP_ENV: 'development',
      APP_DOMAIN: 'letssplyt.app,https://admin.letssplyt.app',
      APP_URL: 'https://letssplyt.app',
    });

    expect(config.corsOrigins).toEqual([
      'https://letssplyt.app',
      'https://admin.letssplyt.app',
    ]);
    expect(config.appBaseUrl).toBe('https://letssplyt.app');
    expect(config.appUrl).toBe('https://letssplyt.app');
  });
});
