import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { EventListItem } from '@letssplyt/shared/event.types';
import { glassStyles } from '../../theme/glassStyles';
import { authColors } from '../../theme/colors';
import { formatEventDate, formatMoney, statusChipLabel } from '../../utils/events';

interface EventCardProps {
  event: EventListItem;
  onPress: () => void;
}

export function EventCard({ event, onPress }: EventCardProps) {
  const dateLabel = formatEventDate(event.created_at);
  const statusLabel = statusChipLabel(event.status);
  const amountLabel = formatMoney(event.total_amount);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${dateLabel}, ${event.participant_count} people, ${statusLabel}, ${amountLabel} outstanding`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.header}>
        <Text style={glassStyles.title} numberOfLines={1}>
          {event.title}
        </Text>
        <View style={glassStyles.chip}>
          <Text style={glassStyles.chipText}>{statusLabel}</Text>
        </View>
      </View>
      <Text style={glassStyles.meta}>
        {dateLabel} · {event.participant_count} {event.participant_count === 1 ? 'person' : 'people'}
      </Text>
      <View style={styles.footer}>
        <Text style={glassStyles.meta}>Total</Text>
        <Text style={styles.amount}>{amountLabel}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    ...glassStyles.card,
    marginBottom: 10,
  },
  cardPressed: {
    opacity: 0.92,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  amount: {
    fontSize: 18,
    fontWeight: '800',
    color: authColors.textOnDark,
  },
});
