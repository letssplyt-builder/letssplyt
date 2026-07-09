import { Platform, UIManager } from 'react-native';

let cached: boolean | null = null;

/**
 * True when the native ExpoBlurView module is linked in the current binary.
 * Dev clients built before `expo-blur` was added return false — use a translucent View fallback.
 */
export function isExpoBlurNativeAvailable(): boolean {
  if (cached !== null) {
    return cached;
  }

  if (Platform.OS === 'web') {
    cached = false;
    return cached;
  }

  const hasViewManager =
    typeof UIManager.hasViewManagerConfig === 'function'
      ? UIManager.hasViewManagerConfig('ExpoBlurView')
      : typeof UIManager.getViewManagerConfig === 'function'
        ? UIManager.getViewManagerConfig('ExpoBlurView') != null
        : false;

  cached = hasViewManager;
  return cached;
}

/** Reset cached probe — tests only. */
export function resetExpoBlurAvailabilityCache(): void {
  cached = null;
}
