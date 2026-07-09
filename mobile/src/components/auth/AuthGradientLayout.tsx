import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
  type Edge,
} from 'react-native-safe-area-context';
import { systemFooterPadding, stickyFooterPadding } from '../../constants/layout';
import { useTheme } from '../../theme/ThemeContext';

type BottomSafeAreaMode = 'tabBar' | 'system';

interface AuthGradientLayoutProps {
  children: ReactNode;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  footerStyle?: StyleProp<ViewStyle>;
  /**
   * `tabBar` — bottom inset handled by floating tab bar + sticky footers (main app).
   * `system` — respect OS home-indicator inset (auth / join flows without tab bar).
   */
  bottomSafeArea?: BottomSafeAreaMode;
  /** Override SafeAreaView edges — e.g. omit `top` when a modal applies top inset manually. */
  safeAreaEdges?: readonly Edge[];
}

function FloatingOrb({
  color,
  style,
  duration = 5200,
  driftY = 14,
  driftX = -10,
}: {
  color: string;
  style: object;
  duration?: number;
  driftY?: number;
  driftX?: number;
}) {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift, duration]);

  const translateY = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, driftY],
  });
  const translateX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, driftX],
  });

  return (
    <Animated.View
      style={[style, { backgroundColor: color, transform: [{ translateY }, { translateX }] }]}
    />
  );
}

/** Full-screen themed gradient with softly drifting ambient orbs. */
export function AuthGradientLayout({
  children,
  footer,
  contentStyle,
  footerStyle,
  bottomSafeArea = 'tabBar',
  safeAreaEdges,
}: AuthGradientLayoutProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const defaultSafeAreaEdges =
    bottomSafeArea === 'system'
      ? (['top', 'left', 'right', 'bottom'] as const)
      : (['top', 'left', 'right'] as const);
  const resolvedSafeAreaEdges = safeAreaEdges ?? defaultSafeAreaEdges;
  const footerBottomPad =
    bottomSafeArea === 'system'
      ? systemFooterPadding(insets.bottom)
      : stickyFooterPadding(insets.bottom);

  return (
    <View style={[styles.root, { backgroundColor: theme.bgGradient[0] }]}>
      <LinearGradient
        colors={theme.bgGradient}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <FloatingOrb
        color={theme.orb1}
        style={[styles.orb, styles.orbTop]}
        duration={5600}
        driftY={18}
        driftX={-12}
      />
      <FloatingOrb
        color={theme.orb2}
        style={[styles.orb, styles.orbBottom]}
        duration={4800}
        driftY={-16}
        driftX={14}
      />
      <SafeAreaView style={styles.safe} edges={resolvedSafeAreaEdges}>
        <View style={[styles.content, contentStyle]}>{children}</View>
        {footer ? (
          <View style={[styles.footer, { paddingBottom: footerBottomPad }, footerStyle]}>
            {footer}
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
    paddingHorizontal: 28,
  },
  footer: {
    paddingHorizontal: 28,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbTop: {
    width: 280,
    height: 280,
    top: -80,
    right: -60,
    opacity: 0.9,
  },
  orbBottom: {
    width: 220,
    height: 220,
    bottom: 120,
    left: -70,
    opacity: 0.85,
  },
});
