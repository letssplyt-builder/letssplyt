import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { EventListItem } from '@letssplyt/shared/event.types';
import { useTheme } from '../../theme/ThemeContext';
import { ThemedSurface } from '../../theme/ThemedSurface';
import { formatEventDate, formatMoney, eventStatusVisual, statusChipLabel } from '../../utils/events';

interface EventCardProps {
  event: EventListItem;
  onPress: () => void;
  variant?: 'default' | 'compact';
}

export function EventCard({ event, onPress, variant = 'default' }: EventCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const compact = variant === 'compact';
  const dateLabel = formatEventDate(event.created_at);
  const statusLabel = statusChipLabel(event.status, {
    role: event.role,
    viewerPaymentStatus: event.viewer_payment_status,
  });
  const statusVisual = eventStatusVisual(event.status, {
    role: event.role,
    viewerPaymentStatus: event.viewer_payment_status,
  });
  const amountLabel = formatMoney(event.total_amount);
  const memberLabel = `${event.participant_count} ${
    event.participant_count === 1 ? 'member' : 'members'
  } joined`;
  const subtitle =
    event.role === 'participant' && event.creator_name
      ? `With ${event.creator_name}`
      : memberLabel;
  const isSettled = event.status === 'settled';

  const accessibilityLabel = `${event.title}, ${dateLabel}, ${subtitle}, ${statusLabel}${
    event.total_amount !== null ? `, ${amountLabel}` : ''
  }`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.cardPressed]}
    >
      <ThemedSurface
        style={[
          compact ? styles.compactCard : styles.card,
          { borderLeftColor: statusVisual.cardAccent, borderLeftWidth: 3 },
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
            {isSettled ? (
              <View style={styles.settledChip}>
                <Text style={styles.settledChipText}>✓ Settled</Text>
              </View>
            ) : (
              <>
                {event.total_amount !== null ? (
                  <Text style={[styles.amount, { color: statusVisual.chipText }]}>
                    {amountLabel}
                  </Text>
                ) : null}
                <Text style={styles.amountLabel}>{statusLabel.toLowerCase()}</Text>
              </>
            )}
          </View>
        </View>
      </ThemedSurface>
    </Pressable>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    card: {
      padding: 16,
      marginBottom: 10,
      borderRadius: theme.radius,
    },
    compactCard: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 6,
      borderRadius: theme.radiusSm,
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
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    compactTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    meta: {
      fontSize: 11,
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
    trailing: {
      alignItems: 'flex-end',
      gap: 4,
    },
    amount: {
      fontSize: 15,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
      fontFamily: theme.fontDisplay,
    },
    amountLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.ink3,
      textTransform: 'lowercase',
      fontFamily: theme.fontBody,
    },
    settledChip: {
      backgroundColor: theme.accentSoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 100,
    },
    settledChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.accent,
      fontFamily: theme.fontBody,
    },
  });
}
