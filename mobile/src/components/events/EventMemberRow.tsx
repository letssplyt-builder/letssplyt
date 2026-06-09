import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { authColors } from '../../theme/colors';
import { formatMoney, joinMethodLabel } from '../../utils/events';

interface EventMemberRowProps {
  displayName: string;
  joinMethod?: string;
  isOrganiser?: boolean;
  isSelf?: boolean;
  paymentStatus?: string;
  amountOwed?: number | null;
  currency?: string;
  showAmount?: boolean;
  showRemove?: boolean;
  isRemoving?: boolean;
  onRemove?: () => void;
  variant: 'joining' | 'settlement' | 'participant';
}

export function EventMemberRow({
  displayName,
  joinMethod,
  isOrganiser = false,
  isSelf = false,
  paymentStatus,
  amountOwed,
  currency = 'USD',
  showAmount = true,
  showRemove = false,
  isRemoving = false,
  onRemove,
  variant,
}: EventMemberRowProps) {
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View style={[styles.row, isSelf && styles.selfRow]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
        {variant === 'joining' && joinMethod ? (
          <View style={[styles.methodChip, isOrganiser && styles.organiserChip]}>
            <Text style={[styles.methodChipText, isOrganiser && styles.organiserChipText]}>
              {joinMethodLabel(joinMethod, isOrganiser)}
            </Text>
          </View>
        ) : null}
        {variant === 'settlement' && paymentStatus ? (
          <Text style={styles.statusMeta}>{paymentStatus}</Text>
        ) : null}
        {variant === 'participant' && isOrganiser ? (
          <View style={[styles.methodChip, styles.organiserChip]}>
            <Text style={[styles.methodChipText, styles.organiserChipText]}>Organiser</Text>
          </View>
        ) : null}
      </View>

      {variant === 'settlement' && amountOwed !== undefined ? (
        <Text style={styles.amount}>{formatMoney(amountOwed, currency)}</Text>
      ) : null}
      {variant === 'participant' && showAmount && amountOwed !== undefined ? (
        <Text style={styles.amount}>
          {amountOwed === null ? '—' : formatMoney(amountOwed, currency)}
        </Text>
      ) : null}

      {showRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${displayName}`}
          disabled={isRemoving}
          onPress={onRemove}
          style={({ pressed }) => [
            styles.removeButton,
            pressed && !isRemoving && styles.removeButtonPressed,
          ]}
        >
          {isRemoving ? (
            <ActivityIndicator size="small" color="#F87171" />
          ) : (
            <Text style={styles.removeIcon}>×</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: authColors.glass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    marginBottom: 6,
    gap: 10,
    minHeight: 48,
  },
  selfRow: {
    backgroundColor: 'rgba(99, 102, 241, 0.14)',
    borderColor: 'rgba(129, 140, 248, 0.35)',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: authColors.pillOnDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: authColors.textOnDark,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: authColors.textOnDark,
  },
  methodChip: {
    alignSelf: 'flex-start',
    marginTop: 3,
    backgroundColor: authColors.pillOnDark,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 100,
  },
  methodChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: authColors.textOnDarkMuted,
  },
  organiserChip: {
    backgroundColor: 'rgba(99, 102, 241, 0.22)',
  },
  organiserChipText: {
    color: '#C7D2FE',
  },
  statusMeta: {
    fontSize: 11,
    color: authColors.textOnDarkMuted,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  amount: {
    fontSize: 13,
    fontWeight: '700',
    color: authColors.textOnDark,
  },
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  removeIcon: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '600',
    color: '#F87171',
    marginTop: -1,
  },
});
