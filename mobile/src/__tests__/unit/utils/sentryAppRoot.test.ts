import { describe, expect, it, jest } from '@jest/globals';
import type { ComponentType } from 'react';

const mockWrap = jest.fn((component: ComponentType<Record<string, unknown>>) => component);

jest.mock('@sentry/react-native', () => ({
  wrap: (component: ComponentType<Record<string, unknown>>) => mockWrap(component),
}));

import { withOptionalSentryWrap } from '../../../utils/sentryAppRoot';

function DummyApp() {
  return null;
}

describe('withOptionalSentryWrap', () => {
  it('returns the component unchanged when DSN is missing', () => {
    expect(withOptionalSentryWrap(DummyApp, undefined)).toBe(DummyApp);
    expect(mockWrap).not.toHaveBeenCalled();
  });

  it('wraps the component when DSN is set', () => {
    const wrapped = withOptionalSentryWrap(DummyApp, 'https://example@sentry.io/1');
    expect(mockWrap).toHaveBeenCalledWith(DummyApp);
    expect(wrapped).toBe(DummyApp);
  });
});
