import { describe, expect, it } from '@jest/globals';
import { resolveAuthenticatedRoute } from '../../../navigation/authFlowNavigation';

describe('resolveAuthenticatedRoute', () => {
  it('prioritises biometric opt-in after OTP (clears OTP stack)', () => {
    expect(resolveAuthenticatedRoute(true, null, false, true)).toBe('BiometricOptIn');
    expect(resolveAuthenticatedRoute(true, 'join-token', true, true)).toBe('BiometricOptIn');
  });

  it('routes to AppJoin when a deep link is pending', () => {
    expect(resolveAuthenticatedRoute(false, 'join-token', false, true)).toBe('AppJoin');
  });

  it('routes new users to push permission before the handle prompt', () => {
    expect(resolveAuthenticatedRoute(false, null, true, true)).toBe('PushPermission');
  });

  it('routes new users to the handle prompt after push', () => {
    expect(resolveAuthenticatedRoute(false, null, false, true)).toBe('PaymentHandlePrompt');
  });

  it('routes returning users directly to main tabs', () => {
    expect(resolveAuthenticatedRoute(false, null, false, false)).toBe('MainTabs');
  });
});
