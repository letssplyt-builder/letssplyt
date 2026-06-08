import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authColors } from '../../theme/colors';

interface AuthGradientLayoutProps {
  children: ReactNode;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

function FloatingOrb({
  style,
  duration = 5200,
  driftY = 14,
  driftX = -10,
}: {
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
    <Animated.View style={[style, { transform: [{ translateY }, { translateX }] }]} />
  );
}

/**
 * Full-screen dark teal gradient with softly drifting ambient orbs.
 */
export function AuthGradientLayout({ children, footer, contentStyle }: AuthGradientLayoutProps) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[authColors.gradientTop, authColors.gradientMid, authColors.gradientBottom]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <FloatingOrb style={[styles.orb, styles.orbTop]} duration={5600} driftY={18} driftX={-12} />
      <FloatingOrb
        style={[styles.orb, styles.orbBottom]}
        duration={4800}
        driftY={-16}
        driftX={14}
      />
      <SafeAreaView style={styles.safe}>
        <View style={[styles.content, contentStyle]}>{children}</View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: authColors.gradientTop,
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
    paddingBottom: 24,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: authColors.glowTeal,
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
    backgroundColor: authColors.glowCyan,
    opacity: 0.85,
  },
});
