import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Alert,
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
import { EventMemberRow } from '../../components/events/EventMemberRow';
import { EventSplitActionBar } from '../../components/events/EventSplitActionBar';
import { ParticipantEventDetail } from '../../components/events/ParticipantEventDetail';
import { QRDisplayModal } from '../../components/events/QRDisplayModal';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { BottomToast } from '../../components/BottomToast';
import { PrimaryButton } from '../../components/PrimaryButton';
import {
  screenScrollBottomPadding,
  splitActionBarFooterPadding,
} from '../../constants/layout';
import { getSupabase } from '../../lib/supabase';
import type { EventsStackParamList } from '../../navigation/types';
import { getApiErrorCode, isApiRequestError } from '../../services/api';
import * as eventService from '../../services/event.service';
import { useAuthStore } from '../../store/authStore';
import { useEventStore } from '../../store/eventStore';
import { glassStyles } from '../../theme/glassStyles';
import { authColors } from '../../theme/colors';
import { receiptReviewToParseResult } from '../receipts/itemReview.utils';
import { formatMoney, isPayerParticipant } from '../../utils/events';
import { resolveEventSplitActionMode } from '../../utils/eventSplitFooter';

type Props = NativeStackScreenProps<EventsStackParamList, 'EventDetail'>;

function isTokenExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) return true;
  const expires = new Date(expiresAt).getTime();
  return Number.isFinite(expires) && expires <= Date.now();
}

function isJoiningPhase(status: string): boolean {
  return status === 'open';
}

function lockGroupErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'MINIMUM_PARTICIPANTS_REQUIRED':
    case 'MIN_PARTICIPANTS':
      return 'Add at least 2 members before locking the group.';
    case 'ALREADY_LOCKED':
      return 'Group is already locked. Pull down to refresh.';
    default:
      return 'Could not lock group. Try again.';
  }
}

function removeParticipantErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'CANNOT_REMOVE_ACTIVE_PARTICIPANT':
      return 'Only pending members can be removed.';
    case 'GROUP_IS_LOCKED':
      return 'Group is locked — reopen the join window to make changes.';
    default:
      return 'Could not remove member. Try again.';
  }
}

export function EventDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { eventId } = route.params;
  const authUser = useAuthStore((state) => state.user);
  const {
    currentEvent,
    isLoadingDetail,
    isLocking,
    loadEventDetail,
    lockEvent,
    removeParticipant,
    reopenEvent,
  } = useEventStore();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [qrFullscreen, setQrFullscreen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [removingParticipantId, setRemovingParticipantId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState(false);

  const refreshDetail = useCallback(async () => {
    setFetchError(false);
    try {
      await loadEventDetail(eventId);
    } catch {
      setFetchError(true);
    }
  }, [eventId, loadEventDetail]);

  useFocusEffect(
    useCallback(() => {
      void refreshDetail();
    }, [refreshDetail]),
  );

  useEffect(() => {
    return () => useEventStore.getState().resetCurrentEvent();
  }, []);

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
  const lockEnabled = memberCount >= 2;
  const isPayer = Boolean(authUser && event && authUser.id === event.payer_id);
  const showSplitActions = isPayer && event?.status === 'locked';
  const splitActionMode = event
    ? resolveEventSplitActionMode(event.ai_stage, Boolean(currentEvent?.receipt_review))
    : 'initial';

  const openItemReview = () => {
    const review = currentEvent?.receipt_review;
    if (!review) {
      setToast('Receipt data is not ready yet. Pull to refresh.');
      return;
    }
    navigation.navigate('ItemReview', {
      eventId,
      storagePath: '',
      parseResult: receiptReviewToParseResult(review),
    });
  };

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
    } catch (err: unknown) {
      const code = isApiRequestError(err) ? err.code : getApiErrorCode(err);
      setLockError(lockGroupErrorMessage(code));
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

  const handleRemoveParticipant = (participantId: string, displayName: string) => {
    Alert.alert(
      `Remove ${displayName} from this event?`,
      'They will need to scan the QR or use the link again to rejoin.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setRemovingParticipantId(participantId);
            void removeParticipant(eventId, participantId)
              .then(() => {
                setToast(`✓ ${displayName} removed`);
              })
              .catch((err: unknown) => {
                const code = isApiRequestError(err) ? err.code : getApiErrorCode(err);
                setToast(removeParticipantErrorMessage(code));
              })
              .finally(() => {
                setRemovingParticipantId(null);
              });
          },
        },
      ],
    );
  };

  const handleReopen = async () => {
    setIsReopening(true);
    try {
      await reopenEvent(eventId);
      setToast('Join window reopened');
    } catch {
      setToast('Could not reopen join window. Try again.');
    } finally {
      setIsReopening(false);
    }
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
    <AuthGradientLayout
      contentStyle={styles.layout}
      footer={
        showSplitActions ? (
          <EventSplitActionBar
            mode={splitActionMode}
            onScanReceipt={() => navigation.navigate('ReceiptScan', { eventId })}
            onEnterTotal={() =>
              navigation.navigate('SplitEntry', { eventId, mode: 'manual' })
            }
            onReviewItems={openItemReview}
            onEditShare={openItemReview}
          />
        ) : undefined
      }
      footerStyle={
        showSplitActions
          ? {
              paddingHorizontal: 20,
              paddingTop: 8,
              paddingBottom: splitActionBarFooterPadding(),
            }
          : undefined
      }
    >
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
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: showSplitActions
              ? 24
              : screenScrollBottomPadding(insets.bottom),
          },
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

        {!isPayer && currentEvent ? (
          <ParticipantEventDetail detail={currentEvent} />
        ) : null}

        {isPayer && joining ? (
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
            <View style={styles.memberList}>
              {participants.map((participant) => (
                <EventMemberRow
                  key={participant.id}
                  variant="joining"
                  displayName={participant.display_name}
                  joinMethod={participant.join_method}
                  isOrganiser={participant.is_organiser}
                  showRemove={
                    Boolean(isPayer && event && !isPayerParticipant(participant, event.payer))
                  }
                  isRemoving={removingParticipantId === participant.id}
                  onRemove={() =>
                    handleRemoveParticipant(participant.id, participant.display_name)
                  }
                />
              ))}
            </View>

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
            {memberCount < 2 ? (
              <Text style={styles.lockHint}>
                Add at least one more member besides you to lock the group.
              </Text>
            ) : null}
            {lockError ? <Text style={glassStyles.errorText}>{lockError}</Text> : null}
          </>
        ) : isPayer ? (
          <View style={styles.settlementPhase}>
            {event?.status === 'locked' && isPayer ? (
              <View style={styles.reopenSection}>
                <PrimaryButton
                  label="Reopen join window"
                  variant="inverse"
                  loading={isReopening}
                  disabled={isReopening}
                  onPress={() => void handleReopen()}
                  style={styles.reopenButton}
                />
                <Text style={styles.reopenHelper}>
                  Reopens QR and link for 24 hours for latecomers.
                </Text>
              </View>
            ) : null}

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
            <View style={styles.memberList}>
              {participants.map((participant) => (
                <EventMemberRow
                  key={participant.id}
                  variant="settlement"
                  displayName={participant.display_name}
                  paymentStatus={participant.payment_status}
                  amountOwed={participant.amount_owed}
                  currency={event?.currency ?? 'USD'}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <AddParticipantModal
        visible={isPayer && addModalOpen}
        isSubmitting={isAdding}
        error={addError}
        onClose={() => {
          setAddModalOpen(false);
          setAddError(null);
        }}
        onSubmit={(input) => void handleAddParticipant(input)}
      />

      {isPayer && event && joinUrl ? (
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
  scroll: {
    flex: 1,
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
  memberList: {
    marginBottom: 4,
  },
  addButton: {
    marginTop: 8,
    marginBottom: 12,
  },
  lockButton: {
    marginTop: 4,
  },
  lockHint: {
    fontSize: 12,
    color: authColors.textOnDarkMuted,
    marginTop: 8,
    lineHeight: 17,
  },
  reopenSection: {
    marginBottom: 20,
    gap: 8,
  },
  reopenButton: {
    alignSelf: 'stretch',
  },
  reopenHelper: {
    fontSize: 13,
    color: authColors.textOnDarkMuted,
    lineHeight: 18,
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
