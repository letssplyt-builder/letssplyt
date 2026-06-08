import { forwardRef, useEffect, useRef } from 'react';
import { Animated, StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { authColors } from '../../theme/colors';

interface OtpDigitBoxProps extends TextInputProps {
  filled: boolean;
  index: number;
}

export const OtpDigitBox = forwardRef<TextInput, OtpDigitBoxProps>(function OtpDigitBox(
  { filled, index, style, ...rest },
  ref,
) {
  const scale = useRef(new Animated.Value(1)).current;
  const entry = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(entry, {
      toValue: 1,
      delay: index * 45,
      friction: 8,
      tension: 70,
      useNativeDriver: true,
    }).start();
  }, [entry, index]);

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: filled ? 1.08 : 1,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [filled, scale]);

  const opacity = entry.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const translateY = entry.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }, { scale }],
      }}
    >
      <TextInput
        ref={ref}
        {...rest}
        style={[styles.digitBox, filled && styles.digitBoxFilled, style]}
      />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  digitBox: {
    width: 48,
    height: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    backgroundColor: authColors.glass,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: authColors.textOnDark,
  },
  digitBoxFilled: {
    borderColor: authColors.ctaSurface,
    backgroundColor: authColors.glassStrong,
  },
});
