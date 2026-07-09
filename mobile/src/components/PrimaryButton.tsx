import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';

type ButtonVariant = 'brand' | 'inverse' | 'outline';

interface PrimaryButtonProps {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: 'button';
  variant?: ButtonVariant;
}

export function PrimaryButton({
  label,
  loading,
  disabled,
  style,
  onPress,
  accessibilityLabel,
  accessibilityRole = 'button',
  variant = 'brand',
}: PrimaryButtonProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const isDisabled = disabled || loading;
  const isInverse = variant === 'inverse';
  const isOutline = variant === 'outline';

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isOutline
          ? styles.buttonOutline
          : isInverse
            ? styles.buttonInverse
            : styles.buttonBrand,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isInverse || isOutline ? theme.accentInk : theme.accentInk} />
      ) : (
        <Text
          style={[
            styles.label,
            isOutline
              ? styles.labelOutline
              : isInverse
                ? styles.labelInverse
                : styles.labelBrand,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    button: {
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonBrand: {
      backgroundColor: theme.accent,
    },
    buttonInverse: {
      backgroundColor: theme.ink,
    },
    buttonOutline: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: theme.line,
    },
    buttonPressed: {
      opacity: 0.92,
      transform: [{ scale: 0.99 }],
    },
    buttonDisabled: {
      opacity: 0.65,
    },
    label: {
      fontSize: 17,
      fontWeight: '700',
      fontFamily: theme.fontBody,
    },
    labelBrand: {
      color: theme.accentInk,
    },
    labelInverse: {
      color: theme.accentInk,
    },
    labelOutline: {
      color: theme.ink,
    },
  });
}
