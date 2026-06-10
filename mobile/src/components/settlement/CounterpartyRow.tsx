import { Pressable, StyleSheet, Text, View } from 'react-native';
import { authColors } from '../../theme/colors';
import { formatMoney } from '../../utils/events';

interface CounterpartyRowProps {
  displayName: string;
  amount: number;
  avatarColour?: string;
  directionLabel?: string;
  onPress: () => void;
}

export function CounterpartyRow({
  displayName,
  amount,
  avatarColour = '#4F46E5',
  directionLabel,
  onPress,
}: CounterpartyRowProps) {
  const spokenAmount = formatMoney(amount);
  const accessibilityLabel = directionLabel
    ? `${displayName}, ${spokenAmount}, ${directionLabel}`
    : `${displayName}, ${spokenAmount}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.avatar, { backgroundColor: avatarColour }]}>
        <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
        {directionLabel ? <Text style={styles.hint}>{directionLabel}</Text> : null}
      </View>
      <Text style={styles.amount}>{spokenAmount}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: authColors.glass,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    marginBottom: 8,
  },
  rowPressed: {
    opacity: 0.88,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: authColors.textOnDark,
    fontWeight: '700',
    fontSize: 16,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: authColors.textOnDark,
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    color: authColors.textOnDarkMuted,
    fontSize: 12,
    marginTop: 2,
  },
  amount: {
    color: authColors.textOnDark,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
});
