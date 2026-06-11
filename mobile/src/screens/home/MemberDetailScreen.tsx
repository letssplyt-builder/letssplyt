import { useCallback, useEffect, useState } from 'react';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { useAppInsets } from '../../hooks/useAppInsets';
import type { HomeStackParamList, MainTabParamList } from '../../navigation/types';
import { useSettlementStore } from '../../store/settlementStore';
import { glassStyles } from '../../theme/glassStyles';
import { authColors } from '../../theme/colors';
import { formatMoney } from '../../utils/events';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'MemberDetail'>,
  BottomTabScreenProps<MainTabParamList>
>;

export function MemberDetailScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const { screenScrollBottomPadding } = useAppInsets();
  const memberDetail = useSettlementStore((state) => state.memberDetail);
  const isLoadingDetail = useSettlementStore((state) => state.isLoadingDetail);
  const loadMemberDetail = useSettlementStore((state) => state.loadMemberDetail);
  const clearDetail = useSettlementStore((state) => state.clearDetail);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    await loadMemberDetail(userId);
  }, [loadMemberDetail, userId]);

  useEffect(() => {
    void refresh();
    return () => clearDetail();
  }, [refresh, clearDetail]);

  const openEvent = (eventId: string) => {
    navigation.navigate('EventDetail', { eventId });
  };

  return (
    <AuthGradientLayout contentStyle={styles.layout}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: screenScrollBottomPadding },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={authColors.textOnDark}
            onRefresh={() => {
              setRefreshing(true);
              void refresh().finally(() => setRefreshing(false));
            }}
          />
        }
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
              <Text style={styles.net}>{formatMoney(memberDetail.net_amount)}</Text>
            </View>

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
                  <Text style={styles.eventAmount}>{formatMoney(row.amount)}</Text>
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
    marginBottom: 24,
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
