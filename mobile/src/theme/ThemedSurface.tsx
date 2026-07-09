import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { isExpoBlurNativeAvailable } from './blurSupported';
import { useTheme } from './ThemeContext';
import type { Theme } from './types';

interface ThemedSurfaceProps {
  children: ReactNode;
  /** Use `surfaceStrong` instead of `surface`. */
  strong?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Aurora: translucent surface + BlurView when the native module is linked.
 * Falls back to a translucent View in dev clients built before expo-blur was added.
 * Solid: opaque View, no blur.
 */
export function ThemedSurface({ children, strong = false, style }: ThemedSurfaceProps) {
  const { theme } = useTheme();
  const backgroundColor = strong ? theme.surfaceStrong : theme.surface;
  const baseStyle: ViewStyle = {
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.line,
    overflow: 'hidden',
  };

  const useBlur = theme.blur > 0 && isExpoBlurNativeAvailable();

  if (useBlur) {
    return (
      <BlurView
        intensity={theme.blur}
        tint="dark"
        style={[baseStyle, { backgroundColor }, style]}
      >
        {children}
      </BlurView>
    );
  }

  return (
    <View style={[baseStyle, { backgroundColor }, style]}>{children}</View>
  );
}

export function themedCardStyle(theme: Theme, strong = false): ViewStyle {
  return {
    backgroundColor: strong ? theme.surfaceStrong : theme.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.line,
    overflow: 'hidden',
  };
}
