import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { CreateEventModal } from '../../components/events/CreateEventModal';
import { EventCard } from '../../components/events/EventCard';
import { EventFab } from '../../components/events/EventFab';
import { QRDisplayModal } from '../../components/events/QRDisplayModal';
import { SegmentedControl } from '../../components/events/SegmentedControl';
import { screenScrollBottomPadding } from '../../constants/layout';
import type { EventsStackParamList, MainTabParamList } from '../../navigation/types';
import { regenerateJoinToken } from '../../services/event.service';
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
  const insets = useSafeAreaInsets();
  const {
    events,
    isLoadingEvents,
    hasMore,
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

  const [segment, setSegment] = useState<Segment>('active');
  const [titleDraft, setTitleDraft] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const filteredEvents = useMemo(
    () => filterEventsBySegment(events, segment),
    [events, segment],
  );

  const refreshList = useCallback(async () => {
    setListError(false);
    try {
      await loadEvents(true);
    } catch {
      setListError(true);
    }
  }, [loadEvents]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

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

  const emptyMessage =
    segment === 'active'
      ? 'No events yet. Tap + to split your first bill.'
      : 'No settled events yet.';

  const listHeader = (
    <View style={styles.header}>
      <Text style={styles.title}>Events</Text>
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
  );

  return (
    <AuthGradientLayout contentStyle={styles.layout}>
      <StatusBar style="light" />
      <FlatList
        data={filteredEvents}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: screenScrollBottomPadding(insets.bottom) },
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
        ListEmptyComponent={
          !isLoadingEvents && !listError ? (
            <Text style={glassStyles.emptyText}>{emptyMessage}</Text>
          ) : null
        }
        ListFooterComponent={
          isLoadingEvents ? (
            <ActivityIndicator color={authColors.textOnDark} style={styles.loader} />
          ) : null
        }
        onEndReached={() => {
          if (hasMore && !isLoadingEvents) {
            void loadEvents(false);
          }
        }}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <EventCard
            event={item}
            onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
          />
        )}
      />

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
  header: {
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: authColors.textOnDark,
  },
  list: {
    paddingHorizontal: 28,
    flexGrow: 1,
  },
  loader: {
    marginVertical: 16,
  },
});
