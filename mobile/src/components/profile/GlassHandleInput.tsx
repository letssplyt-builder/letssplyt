import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

interface GlassHandleInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  error?: string | null;
  hint?: string;
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    wrap: {
      gap: 8,
    },
    inputShell: {
      borderWidth: 1.5,
      borderRadius: theme.radiusSm,
      backgroundColor: theme.modalInset,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    input: {
      fontSize: 16,
      color: theme.ink,
      fontWeight: '500',
      fontFamily: theme.fontBody,
    },
    hint: {
      fontSize: 12,
      color: theme.ink2,
      lineHeight: 18,
      fontFamily: theme.fontBody,
    },
    error: {
      fontSize: 12,
      color: theme.bad,
      lineHeight: 18,
      fontFamily: theme.fontBody,
    },
  });
}

export function GlassHandleInput({
  value,
  onChangeText,
  placeholder,
  error,
  hint,
}: GlassHandleInputProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.wrap}>
      <View style={[styles.inputShell, { borderColor: error ? theme.bad : theme.line }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.ink3}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}
