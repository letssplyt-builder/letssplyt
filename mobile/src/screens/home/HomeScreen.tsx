import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Pressable,
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
import { CounterpartyRow } from '../../components/settlement/CounterpartyRow';
import { useAppInsets } from '../../hooks/useAppInsets';
import { openEventDetail } from '../../navigation/eventNavigation';
import type {
  HomeStackParamList,
  MainTabParamList,
  RootStackParamList,
} from '../../navigation/types';
import { fetchBalance, regenerateJoinToken, type BalanceSummary } from '../../services/event.service';
import { useAuthStore } from '../../store/authStore';
import { useEventStore } from '../../store/eventStore';
import { useSettlementStore } from '../../store/settlementStore';
import { glassStyles } from '../../theme/glassStyles';
import { authColors } from '../../theme/colors';
import { appRefreshControl } from '../../utils/refreshControl';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'Home'>,
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList>,
    NativeStackScreenProps<RootStackParamList>
  >
>;

type HomeSegment = 'members' | 'guests';

export function HomeScreen({ navigation }: Props) {
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
  const loadCounterparties = useSettlementStore((state) => state.loadCounterparties);

  const [segment, setSegment] = useState<HomeSegment>('members');
  const [titleDraft, setTitleDraft] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [balance, setBalance] = useState<BalanceSummary | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const loadBalance = useCallback(async () => {
    setBalanceLoading(true);
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
    await Promise.all([loadBalance(), loadCounterparties(segment)]);
  }, [loadBalance, loadCounterparties, segment]);

  useFocusEffect(
    useCallback(() => {
      void refreshData();
    }, [refreshData]),
  );

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

  const handleOpenEvent = (eventId: string) => {
    openEventDetail(navigation, eventId);
  };

  const renderMembersLists = () => {
    if (counterpartyError) {
      return (
        <Text style={glassStyles.errorText}>Couldn&apos;t load balances. Pull to retry.</Text>
      );
    }

    if (isLoadingCounterparties) {
      return <ActivityIndicator color={authColors.textOnDark} style={styles.loader} />;
    }

    const oweYouEmpty = membersOweYou.length === 0;
    const youOweEmpty = membersYouOwe.length === 0;

    if (oweYouEmpty && youOweEmpty) {
      return <Text style={styles.emptySection}>No outstanding balances with members.</Text>;
    }

    return (
      <>
        {!oweYouEmpty ? (
          <View style={styles.section}>
            <Text style={glassStyles.sectionTitle}>People who owe you</Text>
            {membersOweYou.map((row) => (
              <CounterpartyRow
                key={row.user_id}
                displayName={row.display_name}
                amount={row.net_amount}
                avatarColour={row.avatar_colour}
                directionLabel="owe you"
                amountTone="positive"
                onPress={() =>
                  navigation.navigate('MemberDetail', { userId: row.user_id })
                }
              />
            ))}
          </View>
        ) : null}

        {!youOweEmpty ? (
          <View style={styles.section}>
            <Text style={glassStyles.sectionTitle}>People you owe</Text>
            {membersYouOwe.map((row) => (
              <CounterpartyRow
                key={row.user_id}
                displayName={row.display_name}
                amount={row.net_amount}
                avatarColour={row.avatar_colour}
                directionLabel="you owe"
                amountTone="negative"
                onPress={() =>
                  navigation.navigate('MemberDetail', { userId: row.user_id })
                }
              />
            ))}
          </View>
        ) : null}
      </>
    );
  };

  const renderGuestsList = () => {
    if (counterpartyError) {
      return (
        <Text style={glassStyles.errorText}>Couldn&apos;t load balances. Pull to retry.</Text>
      );
    }

    if (isLoadingCounterparties) {
      return <ActivityIndicator color={authColors.textOnDark} style={styles.loader} />;
    }

    if (guests.length === 0) {
      return <Text style={styles.emptySection}>No guests owe you right now.</Text>;
    }

    return guests.map((guest) => (
      <CounterpartyRow
        key={guest.guest_key}
        displayName={guest.display_name}
        amount={guest.amount}
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
            void refreshData().finally(() => setRefreshing(false));
          },
        })}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={glassStyles.heading}>Hi{user ? `, ${user.display_name}` : ''}</Text>
            <Text style={glassStyles.subheading}>Your dashboard</Text>
          </View>
          <NotificationBellButton onPress={() => navigation.navigate('Notifications')} />
        </View>

        <BalanceHeroCard
          balance={balance}
          isLoading={balanceLoading}
          error={balanceError}
          onRetry={() => void loadBalance()}
        />

        <SegmentedControl
          segments={['members', 'guests'] as const}
          labels={{ members: 'Members', guests: 'Guests' }}
          value={segment}
          onChange={setSegment}
        />

        <View style={styles.listArea}>
          {segment === 'members' ? renderMembersLists() : renderGuestsList()}
        </View>

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
          onClose={dismissQrPresentation}
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
    paddingHorizontal: 28,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerText: {
    flex: 1,
    paddingRight: 8,
  },
  listArea: {
    marginTop: 16,
  },
  section: {
    marginBottom: 18,
  },
  emptySection: {
    fontSize: 13,
    color: authColors.textOnDarkMuted,
    lineHeight: 18,
    marginBottom: 4,
  },
  loader: {
    marginVertical: 16,
  },
});
