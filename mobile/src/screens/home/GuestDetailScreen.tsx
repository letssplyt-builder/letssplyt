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
  NativeStackScreenProps<HomeStackParamList, 'GuestDetail'>,
  BottomTabScreenProps<MainTabParamList>
>;

export function GuestDetailScreen({ navigation, route }: Props) {
  const { phoneHash } = route.params;
  const { screenScrollBottomPadding } = useAppInsets();
  const guestDetail = useSettlementStore((state) => state.guestDetail);
  const isLoadingDetail = useSettlementStore((state) => state.isLoadingDetail);
  const loadGuestDetail = useSettlementStore((state) => state.loadGuestDetail);
  const clearDetail = useSettlementStore((state) => state.clearDetail);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    await loadGuestDetail(phoneHash);
  }, [loadGuestDetail, phoneHash]);

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

        {isLoadingDetail && !guestDetail ? (
          <ActivityIndicator color={authColors.textOnDark} style={styles.loader} />
        ) : null}

        {guestDetail ? (
          <>
            <View style={styles.header}>
              <Text style={styles.name}>{guestDetail.display_name}</Text>
              <Text style={styles.net}>{formatMoney(guestDetail.amount)}</Text>
            </View>

            <Text style={glassStyles.sectionTitle}>Outstanding</Text>
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
