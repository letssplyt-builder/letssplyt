import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { BalanceHeroCard } from '../../components/events/BalanceHeroCard';
import { CreateEventModal } from '../../components/events/CreateEventModal';
import { EventFab } from '../../components/events/EventFab';
import { QRDisplayModal } from '../../components/events/QRDisplayModal';
import { SegmentedControl } from '../../components/events/SegmentedControl';
import { NotificationBellButton } from '../../components/notifications/NotificationBellButton';
import { ScreenTopBar } from '../../components/navigation/ScreenTopBar';
import { CounterpartyRow } from '../../components/settlement/CounterpartyRow';
import { SCREEN_HORIZONTAL_PADDING } from '../../constants/layout';
import { useAppInsets } from '../../hooks/useAppInsets';
import { closePostCreateQrAndOpenEventDetail, openEventDetail } from '../../navigation/eventNavigation';
import type {
  HomeStackParamList,
  MainTabParamList,
  RootStackParamList,
} from '../../navigation/types';
import { fetchBalance, regenerateJoinToken, type BalanceSummary } from '../../services/event.service';
import { useAuthStore } from '../../store/authStore';
import { useEventStore } from '../../store/eventStore';
import { useSettlementStore } from '../../store/settlementStore';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useTheme } from '../../theme/ThemeContext';
import { appRefreshControl } from '../../utils/refreshControl';
import { pickDefaultHomeSegment, type HomeSegment } from '../../utils/dashboardSegments';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'Home'>,
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList>,
    NativeStackScreenProps<RootStackParamList>
  >
>;

const HOME_SEGMENTS = ['collect', 'pay', 'guests'] as const;

const HOME_SEGMENT_LABELS: Record<HomeSegment, string> = {
  collect: 'Collect from',
  pay: 'Pay to',
  guests: 'Guests',
};

export function HomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const themed = useThemedStyles();
  const { screenScrollBottomPadding } = useAppInsets();
  const user = useAuthStore((state) => state.user);
  const {
    createModalOpen,
    qrPresentation,
    isCreating,
    createEvent,
    openCreateModal,
    closeCreateModal,
    dismissQrPresentation,
    updateJoinUrl,
  } = useEventStore();

  const membersOweYou = useSettlementStore((state) => state.membersOweYou);
  const membersYouOwe = useSettlementStore((state) => state.membersYouOwe);
  const guests = useSettlementStore((state) => state.guests);
  const isLoadingCounterparties = useSettlementStore((state) => state.isLoadingCounterparties);
  const counterpartyError = useSettlementStore((state) => state.counterpartyError);
  const loadDashboardCounterparties = useSettlementStore(
    (state) => state.loadDashboardCounterparties,
  );

  const [segment, setSegment] = useState<HomeSegment>('pay');
  const [segmentPinned, setSegmentPinned] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [balance, setBalance] = useState<BalanceSummary | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const loadBalance = useCallback(async () => {
    setBalanceError(false);
    try {
      const result = await fetchBalance();
      setBalance(result);
    } catch {
      setBalance({
        net_balance: 0,
        currency: 'USD',
        owed_to_you: 0,
        you_owe: 0,
        unavailable: true,
      });
      setBalanceError(true);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  const refreshData = useCallback(async () => {
    await Promise.all([loadBalance(), loadDashboardCounterparties()]);
  }, [loadBalance, loadDashboardCounterparties]);

  useFocusEffect(
    useCallback(() => {
      setSegmentPinned(false);
      void refreshData();
    }, [refreshData]),
  );

  useEffect(() => {
    if (segmentPinned || isLoadingCounterparties) {
      return;
    }
    setSegment(pickDefaultHomeSegment(membersYouOwe, membersOweYou, guests));
  }, [
    segmentPinned,
    isLoadingCounterparties,
    membersYouOwe,
    membersOweYou,
    guests,
  ]);

  const handleCreate = async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed) return;
    setCreateError(null);
    try {
      await createEvent(trimmed);
      setTitleDraft('');
    } catch {
      setCreateError("Couldn't create event. Try again.");
    }
  };

  const handleRegenerate = async () => {
    if (!qrPresentation) return;
    setIsRegenerating(true);
    try {
      const result = await regenerateJoinToken(qrPresentation.eventId);
      updateJoinUrl(result.join_url, result.expires_at);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleClosePostCreateQr = useCallback(() => {
    if (!qrPresentation) return;
    closePostCreateQrAndOpenEventDetail(
      navigation,
      qrPresentation.eventId,
      dismissQrPresentation,
    );
  }, [navigation, qrPresentation, dismissQrPresentation]);

  const handleOpenEvent = (eventId: string) => {
    openEventDetail(navigation, eventId);
  };

  const renderCounterpartyLoadingOrError = () => {
    if (counterpartyError) {
      return (
        <Text style={themed.errorText}>Couldn&apos;t load balances. Pull to retry.</Text>
      );
    }

    if (isLoadingCounterparties) {
      return <ActivityIndicator color={theme.ink} style={styles.loader} />;
    }

    return null;
  };

  const renderOweYouList = () => {
    const loadingOrError = renderCounterpartyLoadingOrError();
    if (loadingOrError) {
      return loadingOrError;
    }

    if (membersOweYou.length === 0) {
      return <Text style={styles.emptySection}>No members owe you right now.</Text>;
    }

    return membersOweYou.map((row) => (
      <CounterpartyRow
        key={row.user_id}
        displayName={row.display_name}
        amount={row.net_amount}
        avatarColour={row.avatar_colour}
        directionLabel="owe you"
        amountTone="positive"
        onPress={() => navigation.navigate('MemberDetail', { userId: row.user_id })}
      />
    ));
  };

  const renderYouOweList = () => {
    const loadingOrError = renderCounterpartyLoadingOrError();
    if (loadingOrError) {
      return loadingOrError;
    }

    if (membersYouOwe.length === 0) {
      return <Text style={styles.emptySection}>You don&apos;t owe any members right now.</Text>;
    }

    return membersYouOwe.map((row) => (
      <CounterpartyRow
        key={row.user_id}
        displayName={row.display_name}
        amount={row.net_amount}
        avatarColour={row.avatar_colour}
        directionLabel="you owe"
        amountTone="negative"
        onPress={() => navigation.navigate('MemberDetail', { userId: row.user_id })}
      />
    ));
  };

  const renderGuestsList = () => {
    const loadingOrError = renderCounterpartyLoadingOrError();
    if (loadingOrError) {
      return loadingOrError;
    }

    if (guests.length === 0) {
      return <Text style={styles.emptySection}>No guests owe you right now.</Text>;
    }

    return guests.map((guest) => (
      <CounterpartyRow
        key={guest.guest_key}
        displayName={guest.display_name}
        amount={guest.amount}
        directionLabel="to collect from"
        amountTone="positive"
        onPress={() => {
          if (guest.kind === 'name_only' && guest.event_id) {
            handleOpenEvent(guest.event_id);
            return;
          }
          navigation.navigate('GuestDetail', { phoneHash: guest.guest_key });
        }}
      />
    ));
  };

  const renderSegmentList = () => {
    switch (segment) {
      case 'pay':
        return renderYouOweList();
      case 'collect':
        return renderOweYouList();
      case 'guests':
        return renderGuestsList();
      default:
        return null;
    }
  };

  return (
    <AuthGradientLayout contentStyle={styles.layout}>
      <StatusBar style="light" />
      <ScreenTopBar
        leading={
          <View>
            <Text style={themed.heading}>Hi{user ? `, ${user.display_name}` : ''}</Text>
            <Text style={themed.subheading}>Your dashboard</Text>
          </View>
        }
        trailing={
          <NotificationBellButton onPress={() => navigation.navigate('Notifications')} />
        }
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
            void refreshData().finally(() => setRefreshing(false));
          },
        })}
        showsVerticalScrollIndicator={false}
      >
        <BalanceHeroCard
          balance={balance}
          isLoading={balanceLoading}
          error={balanceError}
          onRetry={() => void loadBalance()}
        />

        <SegmentedControl
          segments={HOME_SEGMENTS}
          labels={HOME_SEGMENT_LABELS}
          value={segment}
          onChange={(value) => {
            setSegmentPinned(true);
            setSegment(value);
          }}
          compact
        />

        <View style={styles.listArea}>{renderSegmentList()}</View>

      </ScrollView>

      <EventFab onPress={openCreateModal} />

      <CreateEventModal
        visible={createModalOpen}
        title={titleDraft}
        isCreating={isCreating}
        error={createError}
        onTitleChange={setTitleDraft}
        onClose={() => {
          closeCreateModal();
          setCreateError(null);
        }}
        onCreate={() => void handleCreate()}
      />

      {qrPresentation ? (
        <QRDisplayModal
          visible
          title={qrPresentation.title}
          joinUrl={qrPresentation.joinUrl}
          tokenExpiresAt={qrPresentation.tokenExpiresAt}
          isRegenerating={isRegenerating}
          onClose={handleClosePostCreateQr}
          onRegenerate={() => void handleRegenerate()}
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
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingTop: 16,
  },
  listArea: {
    marginTop: 16,
  },
  emptySection: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 18,
    marginBottom: 4,
  },
  loader: {
    marginVertical: 16,
  },
});
