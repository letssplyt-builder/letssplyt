import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authColors } from '../theme/colors';

interface BottomToastProps {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
}

export function BottomToast({ message, onDismiss, durationMs = 3200 }: BottomToastProps) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (!message) return;

    const show = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 6 }),
    ]);

    const hide = Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 12, duration: 220, useNativeDriver: true }),
    ]);

    show.start();

    const hideTimer = setTimeout(() => {
      hide.start(({ finished }) => {
        if (finished) onDismiss();
      });
    }, durationMs);

    return () => {
      clearTimeout(hideTimer);
      opacity.stopAnimation();
      translateY.stopAnimation();
    };
  }, [message, durationMs, onDismiss, opacity, translateY]);

  if (!message) return null;

  return (
    <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + 20 }]}>
      <Animated.View style={[styles.bubble, { opacity, transform: [{ translateY }] }]}>
        <Text style={styles.icon}>✓</Text>
        <Text style={styles.message}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
    zIndex: 100,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: '100%',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  icon: {
    fontSize: 15,
    fontWeight: '800',
    color: '#059669',
  },
  message: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    color: authColors.segmentActiveText,
  },
});
