import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

interface FadeSlideInProps {
  children: ReactNode;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}

/** Gentle entrance — opacity + upward drift. */
export function FadeSlideIn({
  children,
  delay = 0,
  distance = 18,
  style,
}: FadeSlideInProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 520,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        friction: 9,
        tension: 55,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [delay, distance, opacity, translateY]);

  return (
    <Animated.View
      style={[{ opacity, transform: [{ translateY }], overflow: 'visible' }, style]}
    >
      {children}
    </Animated.View>
  );
}
