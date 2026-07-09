import { forwardRef, useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

interface OtpDigitBoxProps extends TextInputProps {
  filled: boolean;
  index: number;
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    digitBox: {
      width: 48,
      height: 58,
      borderRadius: theme.radiusSm,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.surface,
      textAlign: 'center',
      fontSize: 24,
      fontWeight: '700',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    digitBoxFilled: {
      borderColor: theme.accent,
      backgroundColor: theme.surfaceStrong,
    },
  });
}

export const OtpDigitBox = forwardRef<TextInput, OtpDigitBoxProps>(function OtpDigitBox(
  { filled, index, style, ...rest },
  ref,
) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
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
