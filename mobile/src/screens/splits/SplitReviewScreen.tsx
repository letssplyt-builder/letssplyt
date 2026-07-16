import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { ScreenTopBar } from '../../components/navigation/ScreenTopBar';
import { PrimaryButton } from '../../components/PrimaryButton';
import { splitActionBarFooterStyle } from '../../constants/layout';
import { useAppInsets } from '../../hooks/useAppInsets';
import type { EventsStackParamList } from '../../navigation/types';
import { confirmEventSplit } from '../../services/messages.service';
import { isApiRequestError } from '../../services/api';
import { useEventStore } from '../../store/eventStore';
import { useSplitStore } from '../../store/splitStore';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';
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

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    layout: {
      paddingHorizontal: 0,
    },
    scroll: {
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 8,
    },
    totalPill: {
      backgroundColor: theme.surface,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: theme.line,
      marginTop: 4,
    },
    totalPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    hintMuted: {
      fontSize: 13,
      color: theme.ink2,
      marginBottom: 12,
      lineHeight: 18,
      fontFamily: theme.fontBody,
    },
    ledgerCard: {
      backgroundColor: theme.surfaceStrong,
      borderRadius: theme.radius,
      borderWidth: 1,
      borderColor: theme.line,
      overflow: 'hidden',
    },
    ledgerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.line,
    },
    ledgerHeaderName: {
      flex: 1,
      fontSize: 10,
      fontWeight: '700',
      color: theme.ink3,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontFamily: theme.fontBody,
    },
    ledgerHeaderAmount: {
      minWidth: 88,
      textAlign: 'right',
      fontSize: 10,
      fontWeight: '700',
      color: theme.ink3,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontFamily: theme.fontBody,
    },
    ledgerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.line,
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
      color: theme.ink,
      fontWeight: '800',
      fontSize: 12,
    },
    name: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    items: {
      fontSize: 11,
      color: theme.ink3,
      marginTop: 1,
      lineHeight: 14,
      fontFamily: theme.fontBody,
    },
    explainerBlock: {
      marginTop: 4,
      gap: 2,
    },
    explainerLine: {
      fontSize: 11,
      color: theme.ink2,
      lineHeight: 15,
      fontFamily: theme.fontBody,
    },
    explainerName: {
      fontWeight: '700',
      color: theme.ink3,
    },
    discountFootnote: {
      marginTop: 12,
      fontSize: 12,
      color: theme.ink3,
      lineHeight: 17,
      fontFamily: theme.fontBody,
    },
    amount: {
      minWidth: 88,
      fontSize: 15,
      fontWeight: '800',
      color: theme.ink,
      textAlign: 'right',
      fontFamily: theme.fontDisplay,
      paddingTop: 4,
    },
    ledgerFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.line,
    },
    ledgerFooterOk: {
      backgroundColor: theme.accentSoft,
    },
    ledgerFooterBad: {
      backgroundColor: theme.warnSoft,
    },
    ledgerFooterLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
    ledgerFooterValue: {
      fontSize: 16,
      fontWeight: '800',
      fontFamily: theme.fontDisplay,
    },
    totalTextOk: {
      color: theme.good,
    },
    totalTextBad: {
      color: theme.bad,
    },
    hintError: {
      marginTop: 12,
      fontSize: 14,
      color: theme.bad,
      fontWeight: '600',
      lineHeight: 20,
      fontFamily: theme.fontBody,
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
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
    balancePill: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    balancePillOk: {
      backgroundColor: theme.accentSoft,
    },
    balancePillBad: {
      backgroundColor: theme.warnSoft,
    },
    balancePillText: {
      fontSize: 11,
      fontWeight: '800',
      fontFamily: theme.fontBody,
    },
    balancePillTextOk: {
      color: theme.good,
    },
    balancePillTextBad: {
      color: theme.bad,
    },
  });
}

export function SplitReviewScreen({ navigation, route }: Props) {
  const { eventId } = route.params;
  const { rawBottom } = useAppInsets();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
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
  const personExplainers = useSplitStore((s) => s.personExplainers);
  const hasItemDiscounts = useSplitStore((s) => s.hasItemDiscounts);

  const explainerByParticipant = useMemo(() => {
    const map = new Map(personExplainers.map((row) => [row.participant_id, row.lines]));
    return map;
  }, [personExplainers]);

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
      contentStyle={styles.layout}
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
      <ScreenTopBar
        title="Review split"
        subtitle={eventTitle ?? undefined}
        titleAlign="start"
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 24 }]}>
        <View style={styles.headerRow}>
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
            const explainLines = explainerByParticipant.get(row.participant_id);
            const itemsLabel =
              !explainLines && row.item_names.length > 0
                ? row.item_names.join(', ')
                : null;

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
                      {explainLines && explainLines.length > 0 ? (
                        <View style={styles.explainerBlock}>
                          {explainLines.map((line) => (
                            <Text
                              key={`${row.participant_id}-${line.name}-${line.detail}`}
                              style={styles.explainerLine}
                              numberOfLines={2}
                            >
                              <Text style={styles.explainerName}>{line.name}</Text>
                              {'  '}
                              {line.detail}
                            </Text>
                          ))}
                        </View>
                      ) : itemsLabel ? (
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

        {hasItemDiscounts ? (
          <Text style={styles.discountFootnote}>
            Item discounts are applied to that product before tax and tip.
          </Text>
        ) : null}

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
