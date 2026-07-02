import { Pressable, StyleSheet, Text, View } from 'react-native';
import { authColors } from '../../theme/colors';

interface ReceiptViewChipProps {
  onPress: () => void;
}

export function ReceiptViewChip({ onPress }: ReceiptViewChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="View receipt breakdown"
      accessibilityHint="Opens a read-only summary of scanned receipt lines"
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
    >
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>🧾</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>View receipt</Text>
        <Text style={styles.hint}>Tap for the full bill breakdown</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    backgroundColor: authColors.glassStrong,
  },
  chipPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: authColors.pillOnDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: authColors.textOnDark,
  },
  hint: {
    fontSize: 11,
    color: authColors.textOnDarkFaint,
    marginTop: 1,
  },
  chevron: {
    fontSize: 22,
    fontWeight: '300',
    color: authColors.textOnDarkMuted,
    marginTop: -2,
  },
});
