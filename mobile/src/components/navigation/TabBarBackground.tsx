import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Tab bar chrome that bleeds to the physical bottom edge (§4B).
 * Touch targets sit above insets via tabBarStyle.paddingBottom on the navigator.
 */
export function TabBarBackground() {
  const { theme } = useTheme();

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.line,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
      ]}
    />
  );
}
