import { afterEach, describe, expect, it } from '@jest/globals';
import {
  BREAKDOWN_TOKEN_BYTE_LENGTH,
  buildShortBreakdownUrl,
  generateBreakdownTokenValue,
} from '../../../modules/messages/breakdown-url';

describe('breakdown-url', () => {
  const originalAppDomain = process.env.APP_DOMAIN;

  afterEach(() => {
    process.env.APP_DOMAIN = originalAppDomain;
  });

  it('generates 12-character base64url tokens', () => {
    const token = generateBreakdownTokenValue();
    expect(token.length).toBe(12);
    expect(BREAKDOWN_TOKEN_BYTE_LENGTH).toBe(9);
  });

  it('buildShortBreakdownUrl uses APP_DOMAIN with /s/ path', () => {
    process.env.APP_DOMAIN = 'letssplyt.app';

    expect(buildShortBreakdownUrl('abc123token12')).toBe(
      'https://letssplyt.app/s/abc123token12',
    );
  });
});
