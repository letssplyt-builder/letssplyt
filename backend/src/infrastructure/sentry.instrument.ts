import * as Sentry from '@sentry/node';
import packageJson from '../../package.json';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.APP_ENV ?? 'unknown',
    release: packageJson.version,
    tracesSampleRate: 0.1,
  });
}

export function isSentryEnabled(): boolean {
  return Boolean(dsn);
}
