import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../theme/colors';

interface PrimaryButtonProps {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: 'button';
}

export function PrimaryButton({
  label,
  loading,
  disabled,
  style,
  onPress,
  accessibilityLabel,
  accessibilityRole = 'button',
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
