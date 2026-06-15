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
import type { EventsStackParamList, MainTabParamList } from '../../navigation/types';
import { fetchEvents, regenerateJoinToken } from '../../services/event.service';
import type { EventListItem } from '@letssplyt/shared/event.types';
import { useEventStore } from '../../store/eventStore';
import { glassStyles } from '../../theme/glassStyles';
import { authColors } from '../../theme/colors';
import { filterEventsBySegment } from '../../utils/events';

type Props = CompositeScreenProps<
  NativeStackScreenProps<EventsStackParamList, 'Events'>,
  BottomTabScreenProps<MainTabParamList>
>;

type Segment = 'active' | 'settled';

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

  const [segment, setSegment] = useState<Segment>('active');
  const [createdEvents, setCreatedEvents] = useState<EventListItem[]>([]);
  const [joinedEvents, setJoinedEvents] = useState<EventListItem[]>([]);
  const [titleDraft, setTitleDraft] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const createdForSegment = useMemo(
    () => filterEventsBySegment(createdEvents, segment),
    [createdEvents, segment],
  );
  const joinedForSegment = useMemo(
    () => filterEventsBySegment(joinedEvents, segment),
    [joinedEvents, segment],
  );

  const createdEmptyMessage =
    segment === 'active'
      ? "You haven't created any active events yet. Tap + to split your first bill."
      : "No settled events you've created yet.";
  const joinedEmptyMessage =
    segment === 'active'
      ? "You haven't joined any active events yet."
      : "No settled events you've joined yet.";

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
    }, []),
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
            segments={['active', 'settled'] as const}
            labels={{ active: 'Active', settled: 'Settled' }}
            value={segment}
            onChange={setSegment}
          />
          {listError ? (
            <Text style={glassStyles.errorText}>Something went wrong. Pull to retry.</Text>
          ) : null}
        </View>

        {isLoading ? (
          <ActivityIndicator color={authColors.textOnDark} style={styles.loader} />
        ) : (
          <>
            <EventRoleSection
              title="Events you created"
              events={createdForSegment}
              emptyMessage={createdEmptyMessage}
              onEventPress={(eventId) =>
                navigation.navigate('EventDetail', { eventId })
              }
            />
            <EventRoleSection
              title="Events you joined"
              events={joinedForSegment}
              emptyMessage={joinedEmptyMessage}
              onEventPress={(eventId) =>
                navigation.navigate('EventDetail', { eventId })
              }
            />
          </>
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
});
