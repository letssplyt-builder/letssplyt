import { afterEach, describe, expect, it } from '@jest/globals';
import {
  BREAKDOWN_TOKEN_BYTE_LENGTH,
  buildShortBreakdownUrl,
  generateBreakdownTokenValue,
  getPayLinkBaseUrl,
} from '../../../modules/messages/breakdown-url';

describe('breakdown-url', () => {
  const originalPayLinkBase = process.env.PAY_LINK_BASE_URL;
  const originalAppDomain = process.env.APP_DOMAIN;

  afterEach(() => {
    if (originalPayLinkBase === undefined) {
      delete process.env.PAY_LINK_BASE_URL;
    } else {
      process.env.PAY_LINK_BASE_URL = originalPayLinkBase;
    }
    process.env.APP_DOMAIN = originalAppDomain;
  });

  it('generates 12-character base64url tokens', () => {
    const token = generateBreakdownTokenValue();
    expect(token.length).toBe(12);
    expect(BREAKDOWN_TOKEN_BYTE_LENGTH).toBe(9);
  });

  it('buildShortBreakdownUrl uses /s/ path on APP_DOMAIN by default', () => {
    process.env.APP_DOMAIN = 'letssplyt.app';
    delete process.env.PAY_LINK_BASE_URL;

    expect(buildShortBreakdownUrl('abc123token12')).toBe(
      'https://letssplyt.app/s/abc123token12',
    );
  });

  it('getPayLinkBaseUrl prefers PAY_LINK_BASE_URL when set', () => {
    process.env.APP_DOMAIN = 'staging.letssplyt.up.railway.app';
    process.env.PAY_LINK_BASE_URL = 'https://pay.letssplyt.app';

    expect(getPayLinkBaseUrl()).toBe('https://pay.letssplyt.app');
    expect(buildShortBreakdownUrl('abc123token12')).toBe(
      'https://pay.letssplyt.app/s/abc123token12',
    );
  });
});
