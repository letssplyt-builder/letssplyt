import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';

/** Skip Sentry.wrap when DSN is unset (local dev without Doppler Sentry secrets). */
export function withOptionalSentryWrap<P extends Record<string, unknown>>(
  Component: ComponentType<P>,
  dsn: string | undefined,
): ComponentType<P> {
  if (!dsn) {
    return Component;
  }
  return Sentry.wrap(Component);
}
