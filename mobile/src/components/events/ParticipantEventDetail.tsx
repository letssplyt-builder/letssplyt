import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type {
  EventDetailResponse,
  EventParticipantSummary,
  ParticipantAssignedItem,
} from '@letssplyt/shared/event.types';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';
import { EventMemberRow } from './EventMemberRow';
import {
  formatEventDate,
  formatMoney,
} from '../../utils/events';
import {
  participantEventStatusLabel,
  resolveParticipantShareHero,
  splitModeDescription,
} from '../../utils/participantEventView';

interface ParticipantEventDetailProps {
  detail: EventDetailResponse;
  onViewReceipt?: () => void;
}

type DetailStyles = ReturnType<typeof makeStyles>;

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      gap: 4,
    },
    headerMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 16,
    },
    hostLine: {
      flex: 1,
      fontSize: 13,
      color: theme.ink2,
      lineHeight: 18,
      fontFamily: theme.fontBody,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
    },
    receiptHeaderIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    receiptHeaderIconPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.97 }],
    },
    receiptHeaderIconGlyph: {
      fontSize: 16,
    },
    statusChip: {
      backgroundColor: theme.surface,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 100,
    },
    statusChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
    shareHero: {
      backgroundColor: theme.surfaceStrong,
      borderRadius: theme.radius,
      borderWidth: 1,
      borderColor: theme.line,
      padding: 22,
      alignItems: 'center',
      marginBottom: 16,
    },
    shareLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.ink2,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
      fontFamily: theme.fontBody,
    },
    shareAmount: {
      fontSize: 36,
      fontWeight: '800',
      color: theme.ink,
      letterSpacing: -0.5,
      marginBottom: 8,
      fontFamily: theme.fontDisplay,
    },
    sharePending: {
      fontSize: 28,
      fontWeight: '800',
      color: theme.ink2,
      marginBottom: 8,
      fontFamily: theme.fontDisplay,
    },
    shareStatus: {
      fontSize: 13,
      color: theme.ink2,
      textAlign: 'center',
      lineHeight: 19,
      fontFamily: theme.fontBody,
    },
    shareStatusPaid: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.good,
      textAlign: 'center',
      lineHeight: 19,
      fontFamily: theme.fontBody,
    },
    sectionCard: {
      backgroundColor: theme.surface,
      borderRadius: theme.radius,
      borderWidth: 1,
      borderColor: theme.line,
      padding: 16,
      marginBottom: 16,
      gap: 10,
    },
    splitBody: {
      fontSize: 13,
      color: theme.ink2,
      lineHeight: 19,
      fontFamily: theme.fontBody,
    },
    itemList: {
      gap: 2,
      marginTop: 4,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.line,
    },
    itemInfo: {
      flex: 1,
      minWidth: 0,
      paddingRight: 12,
    },
    itemName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    itemMeta: {
      fontSize: 11,
      color: theme.ink2,
      marginTop: 2,
      fontFamily: theme.fontBody,
    },
    itemAmount: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    memberList: {
      marginBottom: 8,
    },
  });
}

function AssignedItemsSection({
  items,
  currency,
  styles,
}: {
  items: ParticipantAssignedItem[];
  currency: string;
  styles: DetailStyles;
}) {
  if (items.length === 0) {
    return (
      <Text style={styles.splitBody}>
        Your assigned items will appear here once the split is finalised.
      </Text>
    );
  }

  return (
    <View style={styles.itemList}>
      {items.map((item) => (
        <View key={item.id} style={styles.itemRow}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.name}</Text>
            {item.is_shared ? (
              <Text style={styles.itemMeta}>Shared item</Text>
            ) : null}
          </View>
          <Text style={styles.itemAmount}>{formatMoney(item.share_amount, currency)}</Text>
        </View>
      ))}
    </View>
  );
}

function SplitBreakdownSection({
  splitMode,
  myItems,
  currency,
  styles,
  sectionTitleStyle,
}: {
  splitMode: EventDetailResponse['event']['split_mode'];
  myItems?: ParticipantAssignedItem[];
  currency: string;
  styles: DetailStyles;
  sectionTitleStyle: object;
}) {
  if (!splitMode) {
    return null;
  }

  const modeDescription = splitModeDescription(splitMode);

  return (
    <View style={styles.sectionCard}>
      <Text style={sectionTitleStyle}>How your share was calculated</Text>
      {modeDescription ? <Text style={styles.splitBody}>{modeDescription}</Text> : null}
      {splitMode === 'itemised' ? (
        <AssignedItemsSection items={myItems ?? []} currency={currency} styles={styles} />
      ) : null}
    </View>
  );
}

export function ParticipantEventDetail({ detail, onViewReceipt }: ParticipantEventDetailProps) {
  const { theme } = useTheme();
  const themed = useThemedStyles();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { event, participants, my_items: myItems } = detail;
  const selfParticipant = participants.find((participant) => participant.is_self);
  const hero = resolveParticipantShareHero(
    event,
    selfParticipant?.amount_owed,
    event.payer.display_name,
    selfParticipant?.payment_status,
  );
  const amountReady = hero.amount !== null;
  const statusLabel = participantEventStatusLabel(
    event,
    selfParticipant?.payment_status,
  );
  const eventDate = formatEventDate(event.created_at);

  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.is_self) return -1;
    if (b.is_self) return 1;
    if (a.is_organiser) return -1;
    if (b.is_organiser) return 1;
    return 0;
  });

  return (
    <View style={styles.container}>
      <View style={styles.headerMeta}>
        <Text style={styles.hostLine}>
          Hosted by {event.payer.display_name}
          {eventDate ? ` · ${eventDate}` : ''}
        </Text>
        <View style={styles.headerActions}>
          {onViewReceipt ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View receipt"
              accessibilityHint="Opens a read-only summary of scanned receipt lines"
              onPress={onViewReceipt}
              style={({ pressed }) => [
                styles.receiptHeaderIcon,
                pressed && styles.receiptHeaderIconPressed,
              ]}
            >
              <Text style={styles.receiptHeaderIconGlyph}>🧾</Text>
            </Pressable>
          ) : null}
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>{statusLabel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.shareHero}>
        <Text style={styles.shareLabel}>{hero.label}</Text>
        {hero.amount !== null ? (
          <Text style={styles.shareAmount}>{formatMoney(hero.amount, event.currency)}</Text>
        ) : (
          <Text style={styles.sharePending}>Pending</Text>
        )}
        <Text style={hero.paid ? styles.shareStatusPaid : styles.shareStatus}>
          {hero.statusLine}
        </Text>
      </View>

      <SplitBreakdownSection
        splitMode={event.split_mode}
        myItems={myItems}
        currency={event.currency}
        styles={styles}
        sectionTitleStyle={themed.sectionTitle}
      />

      <Text style={themed.sectionTitle}>Members · {participants.length}</Text>
      <View style={styles.memberList}>
        {sortedParticipants.map((participant: EventParticipantSummary) => (
          <EventMemberRow
            key={participant.id}
            variant="participant"
            displayName={participant.is_self ? 'You' : participant.display_name}
            isOrganiser={participant.is_organiser}
            amountOwed={participant.amount_owed}
            currency={event.currency}
            isSelf={participant.is_self}
            showAmount={amountReady}
          />
        ))}
      </View>
    </View>
  );
}
