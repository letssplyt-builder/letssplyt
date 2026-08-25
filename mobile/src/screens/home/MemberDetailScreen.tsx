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
import { ScreenTopBar } from '../../components/navigation/ScreenTopBar';
import { useAppInsets } from '../../hooks/useAppInsets';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { openEventDetail } from '../../navigation/eventNavigation';
import type { HomeStackParamList, MainTabParamList } from '../../navigation/types';
import { isApiRequestError } from '../../services/api';
import * as settlementService from '../../services/settlement.service';
import { useSettlementStore } from '../../store/settlementStore';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';
import { formatMoney } from '../../utils/events';
import { appRefreshControl } from '../../utils/refreshControl';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'MemberDetail'>,
  BottomTabScreenProps<MainTabParamList>
>;

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    layout: {
      paddingHorizontal: 0,
    },
    content: {
      paddingHorizontal: 28,
      paddingTop: 8,
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
      color: theme.ink,
      fontSize: 24,
      fontWeight: '700',
      fontFamily: theme.fontBody,
    },
    name: {
      color: theme.ink,
      fontSize: 22,
      fontWeight: '800',
      fontFamily: theme.fontDisplay,
    },
    net: {
      color: theme.ink2,
      fontSize: 18,
      fontWeight: '600',
      marginTop: 4,
      fontFamily: theme.fontBody,
    },
    amountPositive: {
      color: theme.good,
    },
    amountNegative: {
      color: theme.bad,
    },
    nudgeButton: {
      alignSelf: 'center',
      marginBottom: 12,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 100,
      backgroundColor: theme.accentSoft,
      borderWidth: 1,
      borderColor: theme.accent,
    },
    nudgeButtonDisabled: {
      opacity: 0.6,
    },
    nudgeButtonText: {
      color: theme.ink,
      fontSize: 14,
      fontWeight: '700',
      fontFamily: theme.fontBody,
    },
    empty: {
      color: theme.ink2,
      fontSize: 14,
      marginBottom: 12,
      fontFamily: theme.fontBody,
    },
    eventRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: theme.radiusSm,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
      marginBottom: 8,
    },
    eventBody: {
      flex: 1,
    },
    eventTitle: {
      color: theme.ink,
      fontSize: 15,
      fontWeight: '600',
      fontFamily: theme.fontBody,
    },
    eventMeta: {
      color: theme.ink2,
      fontSize: 12,
      marginTop: 2,
      fontFamily: theme.fontBody,
    },
    eventAmount: {
      color: theme.ink,
      fontSize: 15,
      fontWeight: '700',
      fontFamily: theme.fontBody,
    },
    seeMore: {
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 8,
    },
    seeMoreText: {
      color: theme.ink,
      fontSize: 14,
      fontWeight: '600',
      fontFamily: theme.fontBody,
    },
  });
}

export function MemberDetailScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const themed = useThemedStyles();
  const styles = useMemo(() => makeStyles(theme), [theme]);
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
    await Promise.all([loadMemberDetail(userId), loadEventLedger()]);
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

  const owedToMePending = useMemo(() => {
    if (!memberDetail) return [];
    return memberDetail.outstanding.filter(
      (row) =>
        row.direction === 'owed_to_me' &&
        row.payment_status === 'pending',
    );
  }, [memberDetail]);

  const owedToMeNudgeable = useMemo(
    () => owedToMePending.filter((row) => row.can_nudge === true),
    [owedToMePending],
  );

  const owedToMeCoolingDown = useMemo(
    () =>
      owedToMePending.filter(
        (row) => row.can_nudge === false && Boolean(row.last_nudged_at),
      ),
    [owedToMePending],
  );

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
    try {
      await settlementService.nudgeMemberOutstanding(userId);
      Alert.alert('Nudge sent', 'One reminder sent with everything they still owe.');
      await refresh();
    } catch (err) {
      if (isApiRequestError(err) && err.code === 'NUDGE_COOLDOWN') {
        Alert.alert('Nudge cooldown', 'Try again later for this member.');
      } else {
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
      <ScreenTopBar
        title={memberDetail?.counterparty.display_name ?? 'Member'}
        titleAlign="start"
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: screenScrollBottomPadding },
        ]}
        removeClippedSubviews={false}
        refreshControl={appRefreshControl({
          refreshing: refreshing,
          tintColor: theme.ink,
          onRefresh: () => {
            setRefreshing(true);
            void refresh().finally(() => setRefreshing(false));
          },
        })}
      >
        {isLoadingDetail && !memberDetail ? (
          <ActivityIndicator color={theme.ink} style={styles.loader} />
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
            ) : owedToMeCoolingDown.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Nudge cooldown"
                disabled
                style={[styles.nudgeButton, styles.nudgeButtonDisabled]}
              >
                <Text style={styles.nudgeButtonText}>Nudged</Text>
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

            <Text style={themed.sectionTitle}>Outstanding</Text>
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
