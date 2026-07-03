import { randomBytes } from 'crypto';

/** 9 bytes → 12-char base64url token (~72 bits). Existing 24-char tokens still work. */
export const BREAKDOWN_TOKEN_BYTE_LENGTH = 9;

function getAppBaseUrl(): string {
  const domain = process.env.APP_DOMAIN ?? 'http://localhost:3000';
  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    return domain.replace(/\/$/, '');
  }
  return `https://${domain}`;
}

export function generateBreakdownTokenValue(): string {
  return randomBytes(BREAKDOWN_TOKEN_BYTE_LENGTH).toString('base64url');
}

export function buildBreakdownUrl(token: string): string {
  return buildShortBreakdownUrl(token);
}

/** SMS pay link: {APP_DOMAIN}/s/{token} */
export function buildShortBreakdownUrl(token: string): string {
  return `${getAppBaseUrl()}/s/${token}`;
}

/** Legacy long path — still served for older messages. */
export function buildLegacyBreakdownUrl(token: string): string {
  return `${getAppBaseUrl()}/split/${token}`;
}
