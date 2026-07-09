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
  NativeStackScreenProps<HomeStackParamList, 'GuestDetail'>,
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
      marginBottom: 24,
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
    nudgeButton: {
      alignSelf: 'center',
      marginBottom: 16,
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

export function GuestDetailScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const themed = useThemedStyles();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { phoneHash } = route.params;
  const { screenScrollBottomPadding } = useAppInsets();
  const guestDetail = useSettlementStore((state) => state.guestDetail);
  const isLoadingDetail = useSettlementStore((state) => state.isLoadingDetail);
  const loadGuestDetail = useSettlementStore((state) => state.loadGuestDetail);
  const clearDetail = useSettlementStore((state) => state.clearDetail);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nudgeLoading, setNudgeLoading] = useState(false);

  const refresh = useCallback(async () => {
    await loadGuestDetail(phoneHash);
  }, [loadGuestDetail, phoneHash]);

  useEffect(() => {
    void refresh();
    return () => clearDetail();
  }, [refresh, clearDetail]);

  const openEvent = (eventId: string) => {
    openEventDetail(navigation, eventId);
  };

  const nudgeableOutstanding =
    guestDetail?.outstanding.filter((row) => row.payment_status === 'pending') ?? [];

  const handleNudge = async () => {
    if (nudgeableOutstanding.length === 0) return;
    setNudgeLoading(true);
    let sentCount = 0;
    try {
      for (const row of nudgeableOutstanding) {
        try {
          await settlementService.nudgeParticipant(row.event_id, row.participant_id);
          sentCount += 1;
        } catch (err) {
          if (isApiRequestError(err) && err.code === 'NUDGE_COOLDOWN') {
            Alert.alert('Nudge cooldown', 'Try again later for this guest.');
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
      } else if (nudgeableOutstanding.length > 0) {
        Alert.alert('Could not nudge', 'Try again in a moment.');
      }
    } finally {
      setNudgeLoading(false);
    }
  };

  return (
    <AuthGradientLayout contentStyle={styles.layout}>
      <StatusBar style="light" />
      <ScreenTopBar
        title={guestDetail?.display_name ?? 'Guest'}
        titleAlign="start"
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: screenScrollBottomPadding },
        ]}
        refreshControl={appRefreshControl({
          refreshing: refreshing,
          tintColor: theme.ink,
          onRefresh: () => {
            setRefreshing(true);
            void refresh().finally(() => setRefreshing(false));
          },
        })}
      >
        {isLoadingDetail && !guestDetail ? (
          <ActivityIndicator color={theme.ink} style={styles.loader} />
        ) : null}

        {guestDetail ? (
          <>
            <View style={styles.header}>
              <Text style={styles.name}>{guestDetail.display_name}</Text>
              <Text style={styles.net}>{formatMoney(guestDetail.amount)}</Text>
            </View>

            {nudgeableOutstanding.length > 0 ? (
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

            <Text style={themed.sectionTitle}>Outstanding</Text>
            {guestDetail.outstanding.length === 0 ? (
              <Text style={styles.empty}>No outstanding balances.</Text>
            ) : (
              guestDetail.outstanding.map((row) => (
                <Pressable
                  key={row.participant_id}
                  accessibilityRole="button"
                  onPress={() => openEvent(row.event_id)}
                  style={styles.eventRow}
                >
                  <View style={styles.eventBody}>
                    <Text style={styles.eventTitle}>{row.event_title}</Text>
                  </View>
                  <Text style={styles.eventAmount}>{formatMoney(row.amount)}</Text>
                </Pressable>
              ))
            )}

            {guestDetail.history.length > 0 ? (
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
                  ? guestDetail.history.map((row) => (
                      <Pressable
                        key={`history-${row.participant_id}`}
                        accessibilityRole="button"
                        onPress={() => openEvent(row.event_id)}
                        style={styles.eventRow}
                      >
                        <View style={styles.eventBody}>
                          <Text style={styles.eventTitle}>{row.event_title}</Text>
                          <Text style={styles.eventMeta}>Settled</Text>
                        </View>
                        <Text style={styles.eventAmount}>{formatMoney(row.amount)}</Text>
                      </Pressable>
                    ))
                  : null}
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </AuthGradientLayout>
  );
}
