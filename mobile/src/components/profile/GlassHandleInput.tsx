import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TextInput, View } from 'react-native';
import { authColors } from '../../theme/colors';

interface GlassHandleInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  error?: string | null;
  hint?: string;
}

export function GlassHandleInput({
  value,
  onChangeText,
  placeholder,
  error,
  hint,
}: GlassHandleInputProps) {
  const focusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: error ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [error, focusAnim]);

  const borderColor = error
    ? authColors.errorOnDark
    : focusAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [authColors.glassBorder, authColors.glassBorder],
      });

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.inputShell, { borderColor }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={authColors.textOnDarkFaint}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </Animated.View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  inputShell: {
    borderWidth: 1.5,
    borderRadius: 18,
    backgroundColor: authColors.glassStrong,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    fontSize: 16,
    color: authColors.textOnDark,
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    color: authColors.textOnDarkMuted,
    lineHeight: 18,
  },
  error: {
    fontSize: 12,
    color: authColors.errorOnDark,
    lineHeight: 18,
  },
});
