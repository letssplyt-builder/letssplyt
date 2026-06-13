import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AllPaidSheet } from '../../components/settlement/AllPaidSheet';
import { PayHandlesSheet } from '../../components/settlement/PayHandlesSheet';
import { ParticipantPayActions } from '../../components/settlement/ParticipantPayActions';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { useAppInsets } from '../../hooks/useAppInsets';
import { openEventDetail } from '../../navigation/eventNavigation';
import type { HomeStackParamList, MainTabParamList } from '../../navigation/types';
import { isApiRequestError } from '../../services/api';
import * as settlementService from '../../services/settlement.service';
import { useSettlementStore } from '../../store/settlementStore';
import { glassStyles } from '../../theme/glassStyles';
import { authColors } from '../../theme/colors';
import { formatMoney } from '../../utils/events';
import { appRefreshControl } from '../../utils/refreshControl';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'MemberDetail'>,
  BottomTabScreenProps<MainTabParamList>
>;

export function MemberDetailScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const { screenScrollBottomPadding } = useAppInsets();
  const memberDetail = useSettlementStore((state) => state.memberDetail);
  const iOweRows = useSettlementStore((state) => state.iOweRows);
  const isLoadingDetail = useSettlementStore((state) => state.isLoadingDetail);
  const loadMemberDetail = useSettlementStore((state) => state.loadMemberDetail);
  const loadCounterparties = useSettlementStore((state) => state.loadCounterparties);
  const loadEventLedger = useSettlementStore((state) => state.loadEventLedger);
  const clearDetail = useSettlementStore((state) => state.clearDetail);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const [allPaidSheetOpen, setAllPaidSheetOpen] = useState(false);
  const [allPaidLoading, setAllPaidLoading] = useState(false);
  const [nudgeLoading, setNudgeLoading] = useState(false);

  const refresh = useCallback(async () => {
    await loadMemberDetail(userId);
    await loadEventLedger();
  }, [loadMemberDetail, loadEventLedger, userId]);

  useEffect(() => {
    void refresh();
    return () => clearDetail();
  }, [refresh, clearDetail]);

  const iOweOutstanding = useMemo(() => {
    if (!memberDetail) return [];
    return memberDetail.outstanding.filter(
      (row) =>
        row.direction === 'i_owe' &&
        (row.payment_status === 'pending' || row.payment_status === 'disputed'),
    );
  }, [memberDetail]);

  const owedToMeNudgeable = useMemo(() => {
    if (!memberDetail) return [];
    return memberDetail.outstanding.filter(
      (row) =>
        row.direction === 'owed_to_me' &&
        row.payment_status === 'pending' &&
        row.can_nudge !== false,
    );
  }, [memberDetail]);

  const payAllContext = useMemo(() => {
    if (iOweOutstanding.length === 0) return null;

    const ledgerForEvents = iOweRows.filter((row) =>
      iOweOutstanding.some((outstanding) => outstanding.event_id === row.event_id),
    );
    const firstLedger = ledgerForEvents[0];
    const totalFromLedger = ledgerForEvents.reduce(
      (sum, row) => sum + row.amount_minor_units,
      0,
    );
    const totalFromDetail = iOweOutstanding.reduce((sum, row) => sum + row.amount, 0);
    const payerName =
      firstLedger?.payer_display_name ?? memberDetail?.counterparty.display_name ?? 'Organiser';

    return {
      amount: totalFromLedger > 0 ? totalFromLedger : totalFromDetail,
      currency: firstLedger?.currency ?? memberDetail?.currency ?? 'USD',
      payerDisplayName: payerName,
      handles: firstLedger?.creator_payment_handles ?? [],
      eventTitleForLink: `All events with ${payerName}`,
    };
  }, [iOweOutstanding, iOweRows, memberDetail]);

  const showPayActions =
    memberDetail !== null &&
    memberDetail.net_amount <= 0 &&
    iOweOutstanding.length > 0 &&
    payAllContext !== null;

  const openEvent = (eventId: string) => {
    openEventDetail(navigation, eventId);
  };

  const handleNudge = async () => {
    if (owedToMeNudgeable.length === 0) return;
    setNudgeLoading(true);
    let sentCount = 0;
    try {
      for (const row of owedToMeNudgeable) {
        try {
          await settlementService.nudgeParticipant(row.event_id, row.participant_id);
          sentCount += 1;
        } catch (err) {
          if (isApiRequestError(err) && err.code === 'NUDGE_COOLDOWN') {
            Alert.alert('Nudge cooldown', 'Try again later for this member.');
            break;
          }
        }
      }
      if (sentCount > 0) {
        Alert.alert(
          'Nudge sent',
          sentCount === 1 ? 'Reminder sent.' : `${sentCount} reminder(s) sent.`,
        );
        await refresh();
      } else if (owedToMeNudgeable.length > 0) {
        Alert.alert('Could not nudge', 'Try again in a moment.');
      }
    } finally {
      setNudgeLoading(false);
    }
  };

  const submitAllPaid = async (method: settlementService.SelfReportPaymentMethod) => {
    setAllPaidLoading(true);
    try {
      const result = await settlementService.memberSelfReportAll(userId, method);
      setAllPaidSheetOpen(false);
      await Promise.all([
        refresh(),
        loadCounterparties('members'),
        loadEventLedger(),
      ]);
      Alert.alert('Updated', `${result.updated_count} payment(s) reported.`);
    } catch {
      Alert.alert('Could not report payments', 'Try again in a moment.');
    } finally {
      setAllPaidLoading(false);
    }
  };

  const netTone =
    memberDetail && memberDetail.net_amount > 0
      ? styles.amountPositive
      : memberDetail && memberDetail.net_amount < 0
        ? styles.amountNegative
        : undefined;

  return (
    <AuthGradientLayout contentStyle={styles.layout}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: screenScrollBottomPadding },
        ]}
        removeClippedSubviews={false}
        refreshControl={appRefreshControl({
          refreshing: refreshing,
          tintColor: authColors.textOnDark,
          onRefresh: () => {
            setRefreshing(true);
            void refresh().finally(() => setRefreshing(false));
          },
        })}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        {isLoadingDetail && !memberDetail ? (
          <ActivityIndicator color={authColors.textOnDark} style={styles.loader} />
        ) : null}

        {memberDetail ? (
          <>
            <View style={styles.header}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: memberDetail.counterparty.avatar_colour },
                ]}
              >
                <Text style={styles.avatarText}>
                  {memberDetail.counterparty.display_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.name}>{memberDetail.counterparty.display_name}</Text>
              <Text style={[styles.net, netTone]}>
                {formatMoney(memberDetail.net_amount, memberDetail.currency)}
              </Text>
            </View>

            {owedToMeNudgeable.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Nudge"
                disabled={nudgeLoading}
                onPress={() => void handleNudge()}
                style={[styles.nudgeButton, nudgeLoading && styles.nudgeButtonDisabled]}
              >
                <Text style={styles.nudgeButtonText}>
                  {nudgeLoading ? 'Sending…' : 'Nudge'}
                </Text>
              </Pressable>
            ) : null}

            {showPayActions ? (
              <ParticipantPayActions
                payNowLabel="Pay all"
                onPayNow={() => setPaySheetOpen(true)}
                onAllPaid={() => setAllPaidSheetOpen(true)}
                allPaidLoading={allPaidLoading}
              />
            ) : null}

            <Text style={glassStyles.sectionTitle}>Outstanding</Text>
            {memberDetail.outstanding.length === 0 ? (
              <Text style={styles.empty}>No outstanding balances.</Text>
            ) : (
              memberDetail.outstanding.map((row) => (
                <Pressable
                  key={`${row.event_id}-${row.participant_id}`}
                  accessibilityRole="button"
                  onPress={() => openEvent(row.event_id)}
                  style={styles.eventRow}
                >
                  <View style={styles.eventBody}>
                    <Text style={styles.eventTitle}>{row.event_title}</Text>
                    <Text style={styles.eventMeta}>
                      {row.direction === 'owed_to_me' ? 'They owe you' : 'You owe'}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.eventAmount,
                      row.direction === 'owed_to_me' ? styles.amountPositive : styles.amountNegative,
                    ]}
                  >
                    {formatMoney(row.amount, memberDetail.currency)}
                  </Text>
                </Pressable>
              ))
            )}

            {memberDetail.history.length > 0 ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setHistoryExpanded((value) => !value)}
                  style={styles.seeMore}
                >
                  <Text style={styles.seeMoreText}>
                    {historyExpanded ? 'Hide settled events' : 'See more events'}
                  </Text>
                </Pressable>
                {historyExpanded
                  ? memberDetail.history.map((row) => (
                      <Pressable
                        key={`history-${row.event_id}-${row.participant_id}`}
                        accessibilityRole="button"
                        onPress={() => openEvent(row.event_id)}
                        style={styles.eventRow}
                      >
                        <View style={styles.eventBody}>
                          <Text style={styles.eventTitle}>{row.event_title}</Text>
                          <Text style={styles.eventMeta}>Settled</Text>
                        </View>
                        <Text style={styles.eventAmount}>
                          {formatMoney(row.amount, memberDetail.currency)}
                        </Text>
                      </Pressable>
                    ))
                  : null}
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {showPayActions && payAllContext ? (
        <PayHandlesSheet
          visible={paySheetOpen}
          onClose={() => setPaySheetOpen(false)}
          title="Pay all"
          subtitle={payAllContext.eventTitleForLink}
          amount={payAllContext.amount}
          currency={payAllContext.currency}
          payerDisplayName={payAllContext.payerDisplayName}
          eventTitleForLink={payAllContext.eventTitleForLink}
          handles={payAllContext.handles}
        />
      ) : null}

      {showPayActions && payAllContext ? (
        <AllPaidSheet
          visible={allPaidSheetOpen}
          onClose={() => setAllPaidSheetOpen(false)}
          title="All paid"
          description="Which payment method did you use for all outstanding events?"
          handles={payAllContext.handles}
          loading={allPaidLoading}
          onConfirm={(method) => void submitAllPaid(method)}
        />
      ) : null}
    </AuthGradientLayout>
  );
}

const styles = StyleSheet.create({
  layout: {
    paddingHorizontal: 0,
  },
  content: {
    paddingHorizontal: 28,
    paddingTop: 8,
  },
  backButton: {
    marginBottom: 12,
  },
  backText: {
    color: authColors.textOnDark,
    fontSize: 16,
    fontWeight: '600',
  },
  loader: {
    marginTop: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: authColors.textOnDark,
    fontSize: 24,
    fontWeight: '700',
  },
  name: {
    color: authColors.textOnDark,
    fontSize: 22,
    fontWeight: '800',
  },
  net: {
    color: authColors.textOnDarkMuted,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  amountPositive: {
    color: '#6EE7B7',
  },
  amountNegative: {
    color: authColors.errorOnDark,
  },
  nudgeButton: {
    alignSelf: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: 'rgba(99, 102, 241, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.5)',
  },
  nudgeButtonDisabled: {
    opacity: 0.6,
  },
  nudgeButtonText: {
    color: authColors.textOnDark,
    fontSize: 14,
    fontWeight: '700',
  },
  empty: {
    color: authColors.textOnDarkMuted,
    fontSize: 14,
    marginBottom: 12,
  },
  eventRow: {
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
  eventBody: {
    flex: 1,
  },
  eventTitle: {
    color: authColors.textOnDark,
    fontSize: 15,
    fontWeight: '600',
  },
  eventMeta: {
    color: authColors.textOnDarkMuted,
    fontSize: 12,
    marginTop: 2,
  },
  eventAmount: {
    color: authColors.textOnDark,
    fontSize: 15,
    fontWeight: '700',
  },
  seeMore: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  seeMoreText: {
    color: authColors.textOnDark,
    fontSize: 14,
    fontWeight: '600',
  },
});
