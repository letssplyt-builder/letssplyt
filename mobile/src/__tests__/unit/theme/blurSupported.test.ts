import { beforeEach, describe, expect, it } from '@jest/globals';
import { UIManager } from 'react-native';
import {
  isExpoBlurNativeAvailable,
  resetExpoBlurAvailabilityCache,
} from '../../../theme/blurSupported';

describe('isExpoBlurNativeAvailable', () => {
  beforeEach(() => {
    resetExpoBlurAvailabilityCache();
  });

  it('returns false when ExpoBlurView is not registered (Jest / old dev client)', () => {
    expect(isExpoBlurNativeAvailable()).toBe(false);
  });

  it('returns true when ExpoBlurView view manager exists', () => {
    const original = UIManager.hasViewManagerConfig;
    UIManager.hasViewManagerConfig = (name: string) => name === 'ExpoBlurView';
    resetExpoBlurAvailabilityCache();

    expect(isExpoBlurNativeAvailable()).toBe(true);

    UIManager.hasViewManagerConfig = original;
  });
});
