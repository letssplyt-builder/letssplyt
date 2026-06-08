import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { authColors, colors } from '../theme/colors';

type ButtonVariant = 'brand' | 'inverse';

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
  const isDisabled = disabled || loading;
  const isInverse = variant === 'inverse';

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isInverse ? styles.buttonInverse : styles.buttonBrand,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isInverse ? authColors.ctaText : '#FFFFFF'} />
      ) : (
        <Text style={[styles.label, isInverse ? styles.labelInverse : styles.labelBrand]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonBrand: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonInverse: {
    backgroundColor: authColors.ctaSurface,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
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
  },
  labelBrand: {
    color: '#FFFFFF',
  },
  labelInverse: {
    color: authColors.ctaText,
  },
});
