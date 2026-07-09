import { useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppInsets } from '../../hooks/useAppInsets';
import { useSparkFeedbackStore } from '../../store/sparkFeedbackStore';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      right: 0,
      zIndex: 40,
      elevation: 12,
    },
    glow: {
      position: 'absolute',
      right: -4,
      top: -6,
      bottom: -6,
      width: 52,
      borderTopLeftRadius: 18,
      borderBottomLeftRadius: 18,
      backgroundColor: theme.orb2,
    },
    pressable: {
      borderTopLeftRadius: 16,
      borderBottomLeftRadius: 16,
      overflow: 'hidden',
      shadowColor: '#000000',
      shadowOffset: { width: -2, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 10,
      elevation: 10,
    },
    pressablePressed: {
      opacity: 0.92,
      transform: [{ scale: 0.98 }],
    },
    ribbon: {
      width: 42,
      paddingVertical: 14,
      paddingLeft: 10,
      paddingRight: 6,
      alignItems: 'center',
      borderTopLeftRadius: 16,
      borderBottomLeftRadius: 16,
      borderWidth: 1,
      borderRightWidth: 0,
      borderColor: theme.line,
    },
    spark: {
      fontSize: 18,
      color: theme.ink,
      lineHeight: 20,
      marginBottom: 4,
    },
    label: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 1.2,
      color: theme.ink2,
      transform: [{ rotate: '-90deg' }],
      width: 36,
      textAlign: 'center',
      fontFamily: theme.fontBody,
    },
  });
}

export function SparkRibbon() {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const gradientColors = useMemo(
    () => [theme.bgGradient[1], theme.bgGradient[2]] as [string, string],
    [theme.bgGradient],
  );
  const { tabBarTotalHeight, top } = useAppInsets();
  const openPicker = useSparkFeedbackStore((state) => state.openPicker);
  const hideRibbonForSession = useSparkFeedbackStore((state) => state.hideRibbonForSession);
  const hasRibbonPulsed = useSparkFeedbackStore((state) => state.hasRibbonPulsed);
  const markRibbonPulsed = useSparkFeedbackStore((state) => state.markRibbonPulsed);

  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (hasRibbonPulsed) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse, {
            toValue: 1.06,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0.85,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0.35,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
      { iterations: 2 },
    );

    animation.start(({ finished }) => {
      if (finished) {
        markRibbonPulsed();
      }
    });

    return () => animation.stop();
  }, [glow, hasRibbonPulsed, markRibbonPulsed, pulse]);

  const handleLongPress = () => {
    Alert.alert(
      'Hide spark ribbon?',
      'It stays hidden until you restart the app. You can still send feedback from Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Hide for now', style: 'destructive', onPress: hideRibbonForSession },
      ],
    );
  };

  const windowHeight = Dimensions.get('window').height;
  const contentHeight = windowHeight - top - tabBarTotalHeight;
  const ribbonTop = top + contentHeight * 0.42;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          top: ribbonTop,
          transform: [{ scale: pulse }],
        },
      ]}
    >
      <Animated.View style={[styles.glow, { opacity: glow }]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send feedback — spark note"
        accessibilityHint="Opens quick feedback options"
        onPress={openPicker}
        onLongPress={handleLongPress}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressablePressed]}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.ribbon}
        >
          <Text style={styles.spark}>✦</Text>
          <Text style={styles.label}>Note</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}
