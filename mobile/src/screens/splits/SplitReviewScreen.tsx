import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { PrimaryButton } from '../../components/PrimaryButton';
import { splitActionBarFooterStyle } from '../../constants/layout';
import { useAppInsets } from '../../hooks/useAppInsets';
import type { EventsStackParamList } from '../../navigation/types';
import { confirmEventSplit } from '../../services/messages.service';
import { isApiRequestError } from '../../services/api';
import { useEventStore } from '../../store/eventStore';
import { useSplitStore } from '../../store/splitStore';
import { authColors, colors } from '../../theme/colors';
import {
  avatarColorFromName,
  formatSplitMoney,
  isWithinMoneyTolerance,
} from './splitEntry.utils';
import {
  continueMessagingAfterSplitConfirm,
  eventHasSmsRecipients,
} from '../../utils/messageFlow';

type Props = NativeStackScreenProps<EventsStackParamList, 'SplitReview'>;

export function SplitReviewScreen({ navigation, route }: Props) {
  const { eventId } = route.params;
  const { rawBottom } = useAppInsets();
  const eventTitle = useEventStore((s) =>
    s.currentEvent?.event.id === eventId ? s.currentEvent.event.title : null,
  );
  const participants = useEventStore((s) =>
    s.currentEvent?.event.id === eventId ? s.currentEvent.participants : [],
  );
  const messagesSentAt = useEventStore((s) =>
    s.currentEvent?.event.id === eventId ? s.currentEvent.event.messages_sent_at : null,
  );
  const isPostSendRevision = Boolean(messagesSentAt);
  const hasSmsRecipients = useMemo(
    () => eventHasSmsRecipients(participants),
    [participants],
  );

  const splits = useSplitStore((s) => s.splits);
  const billTotal = useSplitStore((s) => s.billTotal);
  const currency = useSplitStore((s) => s.currency);
  const totalCheck = useSplitStore((s) => s.totalCheck);

  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const sumBalanced = useMemo(
    () => isWithinMoneyTolerance(totalCheck, billTotal, currency),
    [billTotal, currency, totalCheck],
  );

  const allHaveAmounts = splits.every((row) => row.amount_owed > 0);
  const canSend = sumBalanced && allHaveAmounts && splits.length > 0;

  const primaryLabel = isPostSendRevision
    ? 'Save and notify →'
    : hasSmsRecipients
      ? 'Preview messages →'
      : 'Complete event →';

  return (
    <AuthGradientLayout
      footerStyle={splitActionBarFooterStyle(rawBottom)}
      footer={
        <View style={styles.footerWrap}>
          <View style={styles.footerMeta}>
            <Text style={styles.footerMetaLabel}>
              {sumBalanced ? 'All amounts confirmed' : 'Total must match the bill'}
            </Text>
            <View style={[styles.balancePill, sumBalanced ? styles.balancePillOk : styles.balancePillBad]}>
              <Text
                style={[
                  styles.balancePillText,
                  sumBalanced ? styles.balancePillTextOk : styles.balancePillTextBad,
                ]}
              >
                {sumBalanced ? '✓ Balanced' : 'Unbalanced'}
              </Text>
            </View>
          </View>
          <PrimaryButton
            label={primaryLabel}
            loading={confirming}
            disabled={!canSend || confirming}
            onPress={() => {
              void (async () => {
                setConfirmError(null);
                setConfirming(true);
                try {
                  await confirmEventSplit(
                    eventId,
                    splits.map((row) => ({
                      participant_id: row.participant_id,
                      amount_owed: row.amount_owed,
                    })),
                  );

                  await continueMessagingAfterSplitConfirm(navigation, eventId, {
                    isPostSendRevision,
                  });
                } catch (err) {
                  setConfirmError(
                    isApiRequestError(err)
                      ? err.message
                      : "Couldn't confirm split. Try again.",
                  );
                } finally {
                  setConfirming(false);
                }
              })();
            }}
            accessibilityLabel={
              isPostSendRevision
                ? 'Save split and notify affected members'
                : hasSmsRecipients
                  ? 'Preview messages'
                  : 'Complete event without sending SMS'
            }
            variant="inverse"
          />
        </View>
      }
    >
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 24 }]}>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>

        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Review split</Text>
            {eventTitle ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                {eventTitle}
              </Text>
            ) : null}
          </View>
          <View style={styles.totalPill}>
            <Text style={styles.totalPillText}>{formatSplitMoney(billTotal, currency)} total</Text>
          </View>
        </View>

        <Text style={styles.hintMuted}>
          {splits.length} {splits.length === 1 ? 'person' : 'people'}
        </Text>

        <View style={styles.ledgerCard} accessibilityRole="summary">
          <View style={styles.ledgerHeader}>
            <Text style={styles.ledgerHeaderName}>Member</Text>
            <Text style={styles.ledgerHeaderAmount}>Owes</Text>
          </View>

          {splits.map((row, index) => {
            const avatarColor = avatarColorFromName(row.display_name);
            const isLast = index === splits.length - 1;
            const itemsLabel =
              row.item_names.length > 0 ? row.item_names.join(', ') : null;

            return (
              <View
                key={row.participant_id}
                accessibilityLabel={`${row.display_name}, owes ${formatSplitMoney(row.amount_owed, currency)}`}
                style={[styles.ledgerRow, isLast && styles.ledgerRowLast]}
              >
                <View style={styles.ledgerNameCol}>
                  <View style={styles.ledgerIdentity}>
                    <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                      <Text style={styles.avatarText}>
                        {row.display_name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.ledgerNameWrap}>
                      <Text style={styles.name} numberOfLines={1}>
                        {row.display_name}
                      </Text>
                      {itemsLabel ? (
                        <Text style={styles.items} numberOfLines={1}>
                          {itemsLabel}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                <Text style={styles.amount}>
                  {formatSplitMoney(row.amount_owed, currency)}
                </Text>
              </View>
            );
          })}

          <View style={[styles.ledgerFooter, sumBalanced ? styles.ledgerFooterOk : styles.ledgerFooterBad]}>
            <Text style={styles.ledgerFooterLabel}>Split total</Text>
            <Text
              style={[
                styles.ledgerFooterValue,
                sumBalanced ? styles.totalTextOk : styles.totalTextBad,
              ]}
            >
              {formatSplitMoney(totalCheck, currency)}
              {sumBalanced ? ' ✓' : ''}
            </Text>
          </View>
        </View>

        {!canSend ? (
          <Text style={styles.hintError}>
            Go back to adjust the split before continuing.
          </Text>
        ) : null}
        {!hasSmsRecipients && canSend && !isPostSendRevision ? (
          <Text style={styles.hintMuted}>
            No phone numbers on file — you&apos;ll complete the event without sending SMS.
          </Text>
        ) : null}
        {confirmError ? <Text style={styles.hintError}>{confirmError}</Text> : null}
      </ScrollView>
    </AuthGradientLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  back: {
    color: authColors.ctaSurface,
    fontWeight: '600',
    fontSize: 15,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: authColors.ctaSurface,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: authColors.textOnDark,
    lineHeight: 20,
  },
  totalPill: {
    backgroundColor: authColors.glassStrong,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    marginTop: 4,
  },
  totalPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: authColors.textOnDark,
  },
  hintMuted: {
    fontSize: 13,
    color: authColors.textOnDarkMuted,
    marginBottom: 12,
    lineHeight: 18,
  },
  ledgerCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E6F0',
    overflow: 'hidden',
  },
  ledgerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E6F0',
  },
  ledgerHeaderName: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  ledgerHeaderAmount: {
    minWidth: 88,
    textAlign: 'right',
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0EEF8',
    minHeight: 44,
  },
  ledgerRowLast: {
    borderBottomWidth: 0,
  },
  ledgerNameCol: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  ledgerIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ledgerNameWrap: {
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  items: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
    lineHeight: 14,
  },
  amount: {
    minWidth: 88,
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
  },
  ledgerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8E6F0',
  },
  ledgerFooterOk: {
    backgroundColor: '#F0FDF4',
  },
  ledgerFooterBad: {
    backgroundColor: '#FEF2F2',
  },
  ledgerFooterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  ledgerFooterValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  totalTextOk: {
    color: '#047857',
  },
  totalTextBad: {
    color: '#B91C1C',
  },
  hintError: {
    marginTop: 12,
    fontSize: 14,
    color: '#FEE2E2',
    fontWeight: '600',
    lineHeight: 20,
  },
  footerWrap: {
    gap: 12,
  },
  footerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerMetaLabel: {
    flex: 1,
    fontSize: 12,
    color: authColors.textOnDarkMuted,
  },
  balancePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  balancePillOk: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
  },
  balancePillBad: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
  },
  balancePillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  balancePillTextOk: {
    color: '#6EE7B7',
  },
  balancePillTextBad: {
    color: '#FCA5A5',
  },
});
