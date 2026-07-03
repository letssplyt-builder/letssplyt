import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { CreateEventModal } from '../../components/events/CreateEventModal';
import { EventFab } from '../../components/events/EventFab';
import { EventRoleSection } from '../../components/events/EventRoleSection';
import { NotificationBellButton } from '../../components/notifications/NotificationBellButton';
import { QRDisplayModal } from '../../components/events/QRDisplayModal';
import { SegmentedControl } from '../../components/events/SegmentedControl';
import { useAppInsets } from '../../hooks/useAppInsets';
import { closePostCreateQrAndOpenEventDetail } from '../../navigation/eventNavigation';
import type { EventsStackParamList, MainTabParamList } from '../../navigation/types';
import { fetchEvents, regenerateJoinToken } from '../../services/event.service';
import type { EventListItem } from '@letssplyt/shared/event.types';
import { useEventStore } from '../../store/eventStore';
import { glassStyles } from '../../theme/glassStyles';
import { authColors } from '../../theme/colors';
import {
  filterEventsBySegment,
  groupEventsByStatus,
  eventStatusVisual,
  sortEventsByDateDesc,
} from '../../utils/events';

type Props = CompositeScreenProps<
  NativeStackScreenProps<EventsStackParamList, 'Events'>,
  BottomTabScreenProps<MainTabParamList>
>;

type EventsTab = 'created' | 'participated' | 'settled';

const EVENTS_TABS = ['created', 'participated', 'settled'] as const;

const EVENTS_TAB_LABELS: Record<EventsTab, string> = {
  created: 'You created',
  participated: 'You participated',
  settled: 'Settled',
};

const EMPTY_MESSAGES: Record<Exclude<EventsTab, 'settled'>, string> = {
  created: "You haven't created any active events yet. Tap + to split your first bill.",
  participated: "You haven't joined any active events yet.",
};

const SETTLED_EMPTY_MESSAGE = 'No settled events yet.';

const SETTLED_CREATED_SECTION = {
  title: 'Events you created',
  subtitle: 'All settled — everyone has paid their share',
  emptyMessage: "No settled events you've created yet.",
} as const;

const SETTLED_JOINED_SECTION = {
  title: 'Events you joined',
  subtitle: 'Settled — your share is paid',
  emptyMessage: "No settled events you've joined yet.",
} as const;

function renderActiveEventsByStatus(
  events: EventListItem[],
  emptyMessage: string,
  onEventPress: (eventId: string) => void,
) {
  if (events.length === 0) {
    return <Text style={styles.emptyTab}>{emptyMessage}</Text>;
  }

  return groupEventsByStatus(events).map((group) => (
    <EventRoleSection
      key={group.visualKey}
      title={group.label}
      titleAccentColor={eventStatusVisual(group.events[0]!.status, {
        role: group.events[0]!.role,
        viewerPaymentStatus: group.events[0]!.viewer_payment_status,
      }).cardAccent}
      events={group.events}
      emptyMessage=""
      onEventPress={onEventPress}
    />
  ));
}

export function EventsScreen({ navigation }: Props) {
  const { screenScrollBottomPadding } = useAppInsets();
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

  const [tab, setTab] = useState<EventsTab>('created');
  const [createdEvents, setCreatedEvents] = useState<EventListItem[]>([]);
  const [joinedEvents, setJoinedEvents] = useState<EventListItem[]>([]);
  const [titleDraft, setTitleDraft] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const activeCreatedEvents = useMemo(
    () => filterEventsBySegment(createdEvents, 'active'),
    [createdEvents],
  );
  const activeJoinedEvents = useMemo(
    () => filterEventsBySegment(joinedEvents, 'active'),
    [joinedEvents],
  );
  const settledCreatedEvents = useMemo(
    () => sortEventsByDateDesc(filterEventsBySegment(createdEvents, 'settled')),
    [createdEvents],
  );
  const settledJoinedEvents = useMemo(
    () => sortEventsByDateDesc(filterEventsBySegment(joinedEvents, 'settled')),
    [joinedEvents],
  );
  const settledTabIsEmpty =
    settledCreatedEvents.length === 0 && settledJoinedEvents.length === 0;

  const handleEventPress = useCallback(
    (eventId: string) => {
      navigation.navigate('EventDetail', { eventId });
    },
    [navigation],
  );

  const refreshList = useCallback(async () => {
    setListError(false);
    setIsLoading(true);
    try {
      const [createdPage, joinedPage] = await Promise.all([
        fetchEvents(undefined, { role: 'creator' }),
        fetchEvents(undefined, { role: 'participant' }),
      ]);
      setCreatedEvents(createdPage.events);
      setJoinedEvents(joinedPage.events);
    } catch {
      setListError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useFocusEffect(
    useCallback(() => {
      useEventStore.getState().resetCurrentEvent();
      void refreshList();
    }, [refreshList]),
  );

  const handleCreate = async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed) return;
    setCreateError(null);
    try {
      await createEvent(trimmed);
      setTitleDraft('');
      await refreshList();
    } catch {
      setCreateError("Couldn't create event. Try again.");
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
              void refreshList().finally(() => setRefreshing(false));
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={glassStyles.heading}>Events</Text>
            <NotificationBellButton onPress={() => navigation.navigate('Notifications')} />
          </View>
          <SegmentedControl
            compact
            segments={EVENTS_TABS}
            labels={EVENTS_TAB_LABELS}
            value={tab}
            onChange={setTab}
          />
          {listError ? (
            <Text style={glassStyles.errorText}>Something went wrong. Pull to retry.</Text>
          ) : null}
        </View>

        {isLoading ? (
          <ActivityIndicator color={authColors.textOnDark} style={styles.loader} />
        ) : tab === 'settled' ? (
          settledTabIsEmpty ? (
            <Text style={styles.emptyTab}>{SETTLED_EMPTY_MESSAGE}</Text>
          ) : (
            <>
              <EventRoleSection
                title={SETTLED_CREATED_SECTION.title}
                subtitle={SETTLED_CREATED_SECTION.subtitle}
                events={settledCreatedEvents}
                emptyMessage={SETTLED_CREATED_SECTION.emptyMessage}
                onEventPress={handleEventPress}
              />
              <EventRoleSection
                title={SETTLED_JOINED_SECTION.title}
                subtitle={SETTLED_JOINED_SECTION.subtitle}
                events={settledJoinedEvents}
                emptyMessage={SETTLED_JOINED_SECTION.emptyMessage}
                onEventPress={handleEventPress}
              />
            </>
          )
        ) : tab === 'created' ? (
          renderActiveEventsByStatus(
            activeCreatedEvents,
            EMPTY_MESSAGES.created,
            handleEventPress,
          )
        ) : tab === 'participated' ? (
          renderActiveEventsByStatus(
            activeJoinedEvents,
            EMPTY_MESSAGES.participated,
            handleEventPress,
          )
        ) : null}
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
    paddingHorizontal: 28,
    paddingTop: 8,
  },
  header: {
    marginBottom: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  loader: {
    marginVertical: 16,
  },
  emptyTab: {
    fontSize: 13,
    color: authColors.textOnDarkMuted,
    lineHeight: 18,
  },
});
