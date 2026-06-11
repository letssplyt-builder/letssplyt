import { randomBytes } from 'crypto';

function getAppBaseUrl(): string {
  const domain = process.env.APP_DOMAIN ?? 'http://localhost:3000';
  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    return domain.replace(/\/$/, '');
  }
  return `https://${domain}`;
}

export function generateBreakdownTokenValue(): string {
  return randomBytes(18).toString('base64url');
}

export function buildBreakdownUrl(token: string): string {
  return `${getAppBaseUrl()}/split/${token}`;
}
