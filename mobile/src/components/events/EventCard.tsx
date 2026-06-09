import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { EventListItem } from '@letssplyt/shared/event.types';
import { authColors } from '../../theme/colors';
import { formatEventDate, formatMoney, statusChipLabel } from '../../utils/events';

interface EventCardProps {
  event: EventListItem;
  onPress: () => void;
  variant?: 'default' | 'compact';
}

export function EventCard({ event, onPress, variant = 'default' }: EventCardProps) {
  const compact = variant === 'compact';
  const dateLabel = formatEventDate(event.created_at);
  const statusLabel = statusChipLabel(event.status);
  const amountLabel = formatMoney(event.total_amount);
  const memberLabel = `${event.participant_count} ${
    event.participant_count === 1 ? 'member' : 'members'
  }`;
  const subtitle =
    event.role === 'participant' && event.creator_name
      ? `With ${event.creator_name}`
      : memberLabel;

  const accessibilityLabel = `${event.title}, ${dateLabel}, ${subtitle}, ${statusLabel}${
    event.total_amount !== null ? `, ${amountLabel}` : ''
  }`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        compact ? styles.compactCard : styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.mainRow}>
        <View style={styles.info}>
          <Text style={compact ? styles.compactTitle : styles.title} numberOfLines={1}>
            {event.title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {dateLabel} · {subtitle}
          </Text>
        </View>
        <View style={styles.trailing}>
          <View style={[styles.statusChip, compact && styles.statusChipCompact]}>
            <Text style={styles.statusChipText}>{statusLabel}</Text>
          </View>
          {!compact && event.total_amount !== null ? (
            <Text style={styles.amount}>{amountLabel}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: authColors.glass,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    padding: 16,
    marginBottom: 10,
  },
  compactCard: {
    backgroundColor: authColors.glass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  cardPressed: {
    opacity: 0.92,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: authColors.textOnDark,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: authColors.textOnDark,
  },
  meta: {
    fontSize: 11,
    color: authColors.textOnDarkMuted,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusChip: {
    alignSelf: 'flex-end',
    backgroundColor: authColors.pillOnDark,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  statusChipCompact: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: authColors.textOnDarkMuted,
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
    color: authColors.textOnDark,
  },
});
