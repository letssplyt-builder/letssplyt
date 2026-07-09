import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { Platform } from 'react-native';
import {
  resolveBottomInset,
  stickyFooterPadding,
  systemFooterPadding,
  tabBarPaddingBottom,
  tabBarTotalHeight,
} from '../../../constants/layout';

describe('layout safe-area helpers', () => {
  const originalOs = Platform.OS;

  beforeEach(() => {
    Platform.OS = 'android';
  });

  afterEach(() => {
    Platform.OS = originalOs;
  });

  it('tabBarPaddingBottom includes Android minimum when OS reports 0', () => {
    expect(tabBarPaddingBottom(0)).toBe(36 + 6);
    // Inset 34 is below ANDROID_MIN_BOTTOM_INSET — minimum still applies.
    expect(tabBarPaddingBottom(34)).toBe(36 + 6);
  });

  it('resolveBottomInset returns a non-negative number', () => {
    const resolved = resolveBottomInset(0);
    expect(typeof resolved).toBe('number');
    expect(resolved).toBeGreaterThanOrEqual(0);
  });

  it('tabBarTotalHeight stacks content chrome above bottom padding', () => {
    expect(tabBarTotalHeight(34)).toBe(tabBarPaddingBottom(34) + 54);
  });

  it('stickyFooterPadding clears floating tab bar for footer CTAs', () => {
    expect(stickyFooterPadding(34)).toBe(tabBarTotalHeight(34) + 16);
  });

  it('systemFooterPadding adds breathing room for auth flows', () => {
    expect(systemFooterPadding(34)).toBe(24);
    expect(systemFooterPadding(0)).toBeGreaterThanOrEqual(36 + 24);
  });

  it('iOS uses reported inset without Android minimum', () => {
    Platform.OS = 'ios';
    expect(resolveBottomInset(0)).toBe(0);
    expect(tabBarPaddingBottom(0)).toBe(6);
    expect(systemFooterPadding(0)).toBe(24);
  });
});
