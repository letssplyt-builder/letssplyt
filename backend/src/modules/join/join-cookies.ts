import { randomBytes } from 'crypto';
import type { Response } from 'express';

const CSRF_COOKIE = 'csrf_token';
const SESSION_COOKIE = 'join_session';

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    out[key] = decodeURIComponent(value);
  }
  return out;
}

export function createCsrfToken(): string {
  return randomBytes(24).toString('hex');
}

export function createJoinSessionId(): string {
  return randomBytes(18).toString('hex');
}

export function setJoinCookies(
  res: Response,
  csrfToken: string,
  sessionId: string,
): void {
  const secure = process.env.APP_ENV === 'production' || process.env.APP_ENV === 'staging';
  const base = `Path=/; SameSite=Lax${secure ? '; Secure' : ''}`;
  res.append('Set-Cookie', `${CSRF_COOKIE}=${encodeURIComponent(csrfToken)}; HttpOnly; ${base}`);
  res.append('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; HttpOnly; ${base}`);
}

export function readCsrfFromCookies(cookieHeader: string | undefined): string | undefined {
  return parseCookies(cookieHeader)[CSRF_COOKIE];
}

export function readJoinSessionFromCookies(cookieHeader: string | undefined): string | undefined {
  return parseCookies(cookieHeader)[SESSION_COOKIE];
}

export function validateCsrf(
  cookieHeader: string | undefined,
  submittedToken: string | undefined,
): boolean {
  if (!submittedToken) return false;
  const cookieToken = readCsrfFromCookies(cookieHeader);
  return Boolean(cookieToken && cookieToken === submittedToken);
}
