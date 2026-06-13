import { describe, expect, it } from '@jest/globals';
import { resolveAuthenticatedRoute } from '../../../navigation/authFlowNavigation';

describe('resolveAuthenticatedRoute', () => {
  it('prioritises biometric opt-in after OTP (clears OTP stack)', () => {
    expect(resolveAuthenticatedRoute(true, null, false)).toBe('BiometricOptIn');
    expect(resolveAuthenticatedRoute(true, 'join-token', true)).toBe('BiometricOptIn');
  });

  it('routes to AppJoin when a deep link is pending', () => {
    expect(resolveAuthenticatedRoute(false, 'join-token', false)).toBe('AppJoin');
  });

  it('routes new users to push permission before home', () => {
    expect(resolveAuthenticatedRoute(false, null, true)).toBe('PushPermission');
  });

  it('routes returning users directly to main tabs', () => {
    expect(resolveAuthenticatedRoute(false, null, false)).toBe('MainTabs');
  });
});
