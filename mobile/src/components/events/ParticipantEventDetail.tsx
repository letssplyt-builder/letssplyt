import { StyleSheet, Text, View } from 'react-native';
import type {
  EventDetailResponse,
  EventParticipantSummary,
  ParticipantAssignedItem,
} from '@letssplyt/shared/event.types';
import { EventMemberRow } from './EventMemberRow';
import { authColors } from '../../theme/colors';
import { glassStyles } from '../../theme/glassStyles';
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
}

function AssignedItemsSection({
  items,
  currency,
}: {
  items: ParticipantAssignedItem[];
  currency: string;
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
  amountReady,
}: {
  splitMode: EventDetailResponse['event']['split_mode'];
  myItems?: ParticipantAssignedItem[];
  currency: string;
  amountReady: boolean;
}) {
  if (!splitMode) {
    return null;
  }

  const modeDescription = splitModeDescription(splitMode);

  return (
    <View style={styles.sectionCard}>
      <Text style={glassStyles.sectionTitle}>How your share was calculated</Text>
      {modeDescription ? <Text style={styles.splitBody}>{modeDescription}</Text> : null}
      {splitMode === 'itemised' ? (
        <AssignedItemsSection items={myItems ?? []} currency={currency} />
      ) : null}
    </View>
  );
}

export function ParticipantEventDetail({ detail }: ParticipantEventDetailProps) {
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
        <View style={styles.statusChip}>
          <Text style={styles.statusChipText}>{statusLabel}</Text>
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
        amountReady={amountReady}
      />

      <Text style={glassStyles.sectionTitle}>Group · {participants.length}</Text>
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

const styles = StyleSheet.create({
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
    color: authColors.textOnDarkMuted,
    lineHeight: 18,
  },
  statusChip: {
    backgroundColor: authColors.pillOnDark,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: authColors.textOnDarkMuted,
  },
  shareHero: {
    backgroundColor: authColors.glassStrong,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    padding: 22,
    alignItems: 'center',
    marginBottom: 16,
  },
  shareLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: authColors.textOnDarkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  shareAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: authColors.textOnDark,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  sharePending: {
    fontSize: 28,
    fontWeight: '800',
    color: authColors.textOnDarkMuted,
    marginBottom: 8,
  },
  shareStatus: {
    fontSize: 13,
    color: authColors.textOnDarkMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  shareStatusPaid: {
    fontSize: 13,
    fontWeight: '700',
    color: '#34D399',
    textAlign: 'center',
    lineHeight: 19,
  },
  sectionCard: {
    ...glassStyles.card,
    marginBottom: 16,
    gap: 10,
  },
  splitBody: {
    fontSize: 13,
    color: authColors.textOnDarkMuted,
    lineHeight: 19,
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
    borderBottomColor: authColors.glassBorder,
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: authColors.textOnDark,
  },
  itemMeta: {
    fontSize: 11,
    color: authColors.textOnDarkMuted,
    marginTop: 2,
  },
  itemAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: authColors.textOnDark,
  },
  memberList: {
    marginBottom: 8,
  },
});
