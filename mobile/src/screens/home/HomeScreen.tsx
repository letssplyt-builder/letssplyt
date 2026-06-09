import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { BalanceHeroCard } from '../../components/events/BalanceHeroCard';
import { CreateEventModal } from '../../components/events/CreateEventModal';
import { EventCard } from '../../components/events/EventCard';
import { EventFab } from '../../components/events/EventFab';
import { QRDisplayModal } from '../../components/events/QRDisplayModal';
import { screenScrollBottomPadding } from '../../constants/layout';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { fetchBalance, regenerateJoinToken, type BalanceSummary } from '../../services/event.service';
import { useAuthStore } from '../../store/authStore';
import { useEventStore } from '../../store/eventStore';
import { DevJoinTestPanel } from '../../components/dev/DevJoinTestPanel';
import { glassStyles } from '../../theme/glassStyles';
import { authColors } from '../../theme/colors';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'HomeTab'>,
  NativeStackScreenProps<RootStackParamList>
>;

const RECENT_EVENTS_LIMIT = 4;

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const {
    events,
    isLoadingEvents,
    createModalOpen,
    qrPresentation,
    isCreating,
    loadEvents,
    createEvent,
    openCreateModal,
    closeCreateModal,
    dismissQrPresentation,
    updateJoinUrl,
  } = useEventStore();

  const [titleDraft, setTitleDraft] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [balance, setBalance] = useState<BalanceSummary | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [listError, setListError] = useState(false);

  const loadBalance = useCallback(async () => {
    setBalanceLoading(true);
    setBalanceError(false);
    try {
      const result = await fetchBalance();
      setBalance(result);
      if (result.unavailable) {
        setBalanceError(false);
      }
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
    setListError(false);
    try {
      await Promise.all([loadBalance(), loadEvents(true)]);
    } catch {
      setListError(true);
    }
  }, [loadBalance, loadEvents]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const createdEvents = useMemo(
    () => events.filter((event) => event.role === 'creator').slice(0, RECENT_EVENTS_LIMIT),
    [events],
  );

  const memberEvents = useMemo(
    () => events.filter((event) => event.role === 'participant').slice(0, RECENT_EVENTS_LIMIT),
    [events],
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

  const openEvent = (eventId: string) => {
    navigation.navigate('EventsTab', {
      screen: 'EventDetail',
      params: { eventId },
    });
  };

  const renderEventSection = (
    title: string,
    items: typeof events,
    emptyMessage: string,
  ) => (
    <View style={styles.section}>
      <Text style={glassStyles.sectionTitle}>{title}</Text>
      {!listError && !isLoadingEvents && items.length === 0 ? (
        <Text style={styles.emptySection}>{emptyMessage}</Text>
      ) : null}
      {items.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          variant="compact"
          onPress={() => openEvent(event.id)}
        />
      ))}
    </View>
  );

  return (
    <AuthGradientLayout contentStyle={styles.layout}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: screenScrollBottomPadding(insets.bottom) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={authColors.textOnDark}
            onRefresh={() => {
              setRefreshing(true);
              void refreshData().finally(() => setRefreshing(false));
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={glassStyles.heading}>Hi{user ? `, ${user.display_name}` : ''}</Text>
            <Text style={glassStyles.subheading}>Your dashboard</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => navigation.navigate('Profile')}
            style={glassStyles.ghostButton}
          >
            <Text style={glassStyles.ghostButtonText}>Profile</Text>
          </Pressable>
        </View>

        <BalanceHeroCard
          balance={balance}
          isLoading={balanceLoading}
          error={balanceError}
          onRetry={() => void loadBalance()}
        />

        <DevJoinTestPanel navigation={navigation} />

        {listError ? (
          <Text style={glassStyles.errorText}>Couldn&apos;t load events. Pull to retry.</Text>
        ) : null}

        {renderEventSection(
          'Events you created',
          createdEvents,
          'No events yet. Tap + to split your first bill.',
        )}

        {renderEventSection(
          'Events you joined',
          memberEvents,
          'When someone adds you to a group, it shows up here.',
        )}
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
    alignItems: 'center',
    marginBottom: 16,
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
});
