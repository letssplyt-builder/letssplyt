import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddParticipantModal } from '../../components/events/AddParticipantModal';
import { QRDisplayModal } from '../../components/events/QRDisplayModal';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { BottomToast } from '../../components/BottomToast';
import { PrimaryButton } from '../../components/PrimaryButton';
import { screenScrollBottomPadding } from '../../constants/layout';
import { getSupabase } from '../../lib/supabase';
import type { EventsStackParamList } from '../../navigation/types';
import * as eventService from '../../services/event.service';
import { useEventStore } from '../../store/eventStore';
import { glassStyles } from '../../theme/glassStyles';
import { authColors } from '../../theme/colors';
import { formatMoney, joinMethodLabel } from '../../utils/events';

type Props = NativeStackScreenProps<EventsStackParamList, 'EventDetail'>;

function isTokenExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) return true;
  const expires = new Date(expiresAt).getTime();
  return Number.isFinite(expires) && expires <= Date.now();
}

function isJoiningPhase(status: string): boolean {
  return status === 'open';
}

export function EventDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { eventId } = route.params;
  const { currentEvent, isLoadingDetail, isLocking, loadEventDetail, lockEvent } = useEventStore();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [qrFullscreen, setQrFullscreen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const refreshDetail = useCallback(async () => {
    setFetchError(false);
    try {
      await loadEventDetail(eventId);
    } catch {
      setFetchError(true);
    }
  }, [eventId, loadEventDetail]);

  useEffect(() => {
    void refreshDetail();
    return () => useEventStore.getState().resetCurrentEvent();
  }, [refreshDetail]);

  useEffect(() => {
    const event = currentEvent?.event;
    if (!event || !isJoiningPhase(event.status)) return undefined;

    const supabase = getSupabase();
    if (!supabase) return undefined;

    const channel = supabase
      .channel(`event-members:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'participants',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          void loadEventDetail(eventId);
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [currentEvent?.event.status, eventId, loadEventDetail]);

  const participants = currentEvent?.participants ?? [];
  const event = currentEvent?.event;
  const joinUrl = currentEvent?.join_token?.join_url ?? '';
  const tokenExpiresAt = currentEvent?.join_token?.expires_at ?? '';
  const expired = isTokenExpired(tokenExpiresAt);
  const joining = event ? isJoiningPhase(event.status) : true;
  const memberCount = participants.length;
  const lockEnabled = memberCount >= 1;

  const settlementSummary = useMemo(() => {
    if (!currentEvent?.summary) {
      return { total: 0, collected: 0, outstanding: 0 };
    }
    return currentEvent.summary;
  }, [currentEvent?.summary]);

  const handleAddParticipant = async (input: {
    display_name: string;
    join_method: 'manual_phone' | 'manual_name_only';
    phone_e164?: string;
  }) => {
    setIsAdding(true);
    setAddError(null);
    try {
      await eventService.addManualParticipant(eventId, input);
      setAddModalOpen(false);
      setToast(`✓ ${input.display_name} added`);
      await loadEventDetail(eventId);
    } catch {
      setAddError(`Failed to add ${input.display_name} — try again.`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleLock = async () => {
    setLockError(null);
    try {
      await lockEvent(eventId);
    } catch {
      setLockError('Could not lock group. Add more members or try again.');
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      await eventService.regenerateJoinToken(eventId);
      await loadEventDetail(eventId);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!joinUrl) return;
    await Clipboard.setStringAsync(joinUrl);
    setToast('Link copied');
  };

  const handleShareLink = async () => {
    if (!joinUrl) return;
    await Share.share({ message: joinUrl, url: joinUrl });
  };

  if (isLoadingDetail && !currentEvent) {
    return (
      <AuthGradientLayout contentStyle={styles.loadingLayout}>
        <StatusBar style="light" />
        <ActivityIndicator color={authColors.textOnDark} style={styles.centerLoader} />
      </AuthGradientLayout>
    );
  }

  return (
    <AuthGradientLayout contentStyle={styles.layout}>
      <StatusBar style="light" />

      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={styles.back}
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.screenTitle} numberOfLines={1}>
          {event?.title ?? 'Event'}
        </Text>
        <View style={styles.backPlaceholder} />
      </View>

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
              void refreshDetail().finally(() => setRefreshing(false));
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {fetchError ? (
          <Text style={styles.bannerError}>Couldn&apos;t load member list. Pull to retry.</Text>
        ) : null}

        {joining ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`QR code for ${event?.title ?? 'event'}. Tap to view fullscreen.`}
              onPress={() => setQrFullscreen(true)}
              style={[styles.qrCard, expired && styles.qrExpired]}
            >
              {expired ? (
                <Text style={styles.expiredLabel}>Expired — tap to regenerate</Text>
              ) : joinUrl ? (
                <QRCode
                  value={joinUrl}
                  size={160}
                  backgroundColor="transparent"
                  color={authColors.textOnDark}
                />
              ) : (
                <Text style={styles.expiredLabel}>No join link</Text>
              )}
            </Pressable>

            <View style={styles.linkActions}>
              <PrimaryButton
                label="Copy link"
                variant="inverse"
                onPress={() => void handleCopyLink()}
                style={styles.linkButton}
              />
              <PrimaryButton
                label="Share link"
                onPress={() => void handleShareLink()}
                style={styles.linkButton}
              />
            </View>

            <Text style={glassStyles.sectionTitle}>Members · {memberCount}</Text>
            {participants.map((participant) => (
              <View key={participant.id} style={styles.memberRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {participant.display_name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={glassStyles.title}>{participant.display_name}</Text>
                  <View style={glassStyles.chip}>
                    <Text style={glassStyles.chipText}>
                      {joinMethodLabel(participant.join_method)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}

            <PrimaryButton
              label="+ Add manually"
              variant="inverse"
              onPress={() => setAddModalOpen(true)}
              style={styles.addButton}
            />

            <PrimaryButton
              label={`Lock group → · ${memberCount} ${memberCount === 1 ? 'member' : 'members'}`}
              loading={isLocking}
              disabled={!lockEnabled || isLocking}
              onPress={() => void handleLock()}
              accessibilityLabel={`Lock group, ${memberCount} members`}
              style={styles.lockButton}
            />
            {lockError ? <Text style={glassStyles.errorText}>{lockError}</Text> : null}
          </>
        ) : (
          <View style={styles.settlementPhase}>
            <Text style={glassStyles.heading}>Settlement phase</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={glassStyles.meta}>Total</Text>
                <Text style={styles.summaryValue}>
                  {formatMoney(settlementSummary.total, event?.currency ?? 'USD')}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={glassStyles.meta}>Collected</Text>
                <Text style={[styles.summaryValue, styles.collected]}>
                  {formatMoney(settlementSummary.collected, event?.currency ?? 'USD')}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={glassStyles.meta}>Outstanding</Text>
                <Text style={[styles.summaryValue, styles.outstanding]}>
                  {formatMoney(settlementSummary.outstanding, event?.currency ?? 'USD')}
                </Text>
              </View>
            </View>

            <Text style={glassStyles.sectionTitle}>Roster</Text>
            {participants.map((participant) => (
              <View key={participant.id} style={styles.memberRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {participant.display_name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={glassStyles.title}>{participant.display_name}</Text>
                  <Text style={glassStyles.meta}>{participant.payment_status}</Text>
                </View>
                <Text style={styles.amountOwed}>
                  {formatMoney(participant.amount_owed, event?.currency ?? 'USD')}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <AddParticipantModal
        visible={addModalOpen}
        isSubmitting={isAdding}
        error={addError}
        onClose={() => {
          setAddModalOpen(false);
          setAddError(null);
        }}
        onSubmit={(input) => void handleAddParticipant(input)}
      />

      {event && joinUrl ? (
        <QRDisplayModal
          visible={qrFullscreen}
          title={event.title}
          joinUrl={joinUrl}
          tokenExpiresAt={tokenExpiresAt}
          isRegenerating={isRegenerating}
          onClose={() => setQrFullscreen(false)}
          onRegenerate={() => void handleRegenerate()}
        />
      ) : null}

      <BottomToast message={toast} onDismiss={() => setToast(null)} />
    </AuthGradientLayout>
  );
}

const styles = StyleSheet.create({
  layout: {
    paddingHorizontal: 0,
  },
  loadingLayout: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerLoader: {
    marginTop: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 8,
    gap: 8,
  },
  back: {
    minWidth: 72,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: authColors.textOnDarkMuted,
  },
  backPlaceholder: {
    minWidth: 72,
  },
  screenTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: authColors.textOnDark,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 28,
  },
  bannerError: {
    fontSize: 13,
    color: authColors.errorOnDark,
    backgroundColor: authColors.errorBgOnDark,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  qrCard: {
    alignSelf: 'center',
    backgroundColor: authColors.glassStrong,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    marginBottom: 16,
    minHeight: 200,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrExpired: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  expiredLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FCD34D',
    textAlign: 'center',
  },
  linkActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  linkButton: {
    flex: 1,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    ...glassStyles.card,
    marginBottom: 8,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: authColors.pillOnDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: authColors.textOnDark,
  },
  memberInfo: {
    flex: 1,
    gap: 4,
  },
  amountOwed: {
    fontSize: 14,
    fontWeight: '700',
    color: authColors.textOnDark,
  },
  addButton: {
    marginTop: 8,
    marginBottom: 12,
  },
  lockButton: {
    marginTop: 4,
  },
  settlementPhase: {
    marginTop: 8,
  },
  summaryCard: {
    ...glassStyles.cardStrong,
    marginBottom: 20,
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: authColors.textOnDark,
  },
  collected: {
    color: '#6EE7B7',
  },
  outstanding: {
    color: authColors.errorOnDark,
  },
});
