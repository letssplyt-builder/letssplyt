import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
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
import type { EventStatus } from '@letssplyt/shared/event.types';
import {
  AddMembersSheet,
  type AddMembersBatchResult,
} from '../../components/events/AddMembersSheet';
import type { GroupBuilderSubmitPayload } from '../../components/events/groupBuilder.utils';
import { EventDetailOverflowMenu } from '../../components/events/EventDetailOverflowMenu';
import { EventMemberRow } from '../../components/events/EventMemberRow';
import { AllPaidSheet } from '../../components/settlement/AllPaidSheet';
import { PayHandlesSheet } from '../../components/settlement/PayHandlesSheet';
import { ParticipantPayActions } from '../../components/settlement/ParticipantPayActions';
import { SettlementProgressBar } from '../../components/settlement/SettlementProgressBar';
import { SettlementRosterRow } from '../../components/settlement/SettlementRosterRow';
import { EventSplitActionBar } from '../../components/events/EventSplitActionBar';
import { ParticipantEventDetail } from '../../components/events/ParticipantEventDetail';
import { QRDisplayModal } from '../../components/events/QRDisplayModal';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { BottomToast } from '../../components/BottomToast';
import { PrimaryButton } from '../../components/PrimaryButton';
import { splitActionBarFooterStyle } from '../../constants/layout';
import { useAppInsets } from '../../hooks/useAppInsets';
import { getSupabase } from '../../lib/supabase';
import { navigateInEventFlow } from '../../navigation/eventFlowNavigation';
import type { EventsStackParamList, MainTabParamList } from '../../navigation/types';
import { getApiErrorCode, isApiRequestError } from '../../services/api';
import * as eventService from '../../services/event.service';
import * as settlementService from '../../services/settlement.service';
import { useAuthStore } from '../../store/authStore';
import { useEventStore } from '../../store/eventStore';
import { useSettlementStore } from '../../store/settlementStore';
import { useSplitStore } from '../../store/splitStore';
import { glassStyles } from '../../theme/glassStyles';
import { authColors } from '../../theme/colors';
import { receiptReviewToParseResult } from '../receipts/itemReview.utils';
import { formatMoney, isPayerParticipant, statusChipLabel } from '../../utils/events';
import { openMessagePreviewOrComplete } from '../../utils/messageFlow';
import {
  canEditEventShare,
  canOrganiserNudgeOrMarkCash,
  canParticipantPayShare,
  canResetEventExpenses,
  canDeleteEvent,
  canSendEventMessages,
  resolveEventSplitActionMode,
  resolveSplitEntryMode,
} from '../../utils/eventSplitFooter';

type Props = CompositeScreenProps<
  NativeStackScreenProps<EventsStackParamList, 'EventDetail'>,
  BottomTabScreenProps<MainTabParamList>
>;

function isTokenExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) return true;
  const expires = new Date(expiresAt).getTime();
  return Number.isFinite(expires) && expires <= Date.now();
}

function isJoiningPhase(status: string): boolean {
  return status === 'open';
}

const SETTLEMENT_EVENT_STATUSES: EventStatus[] = ['locked', 'calculating', 'sent', 'settled'];

function isSettlementEventStatus(status: EventStatus): boolean {
  return SETTLEMENT_EVENT_STATUSES.includes(status);
}

function lockEventErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'MINIMUM_PARTICIPANTS_REQUIRED':
    case 'MIN_PARTICIPANTS':
      return 'Add at least 2 members before locking this event.';
    case 'ALREADY_LOCKED':
      return 'This event is already locked. Pull down to refresh.';
    default:
      return 'Could not lock this event. Try again.';
  }
}

function removeParticipantErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'CANNOT_REMOVE_ACTIVE_PARTICIPANT':
      return 'Only pending members can be removed.';
    case 'GROUP_IS_LOCKED':
      return 'This event is locked — reopen joining to make changes.';
    default:
      return 'Could not remove member. Try again.';
  }
}

export function EventDetailScreen({ navigation, route }: Props) {
  const { eventId } = route.params;
  const { rawBottom, screenScrollBottomPadding } = useAppInsets();
  const authUser = useAuthStore((state) => state.user);
  const {
    currentEvent,
    isLoadingDetail,
    isLocking,
    loadEventDetail,
    lockEvent,
    removeParticipant,
    reopenEvent,
    deleteEvent: deleteEventFromStore,
  } = useEventStore();

  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [qrFullscreen, setQrFullscreen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [removingParticipantId, setRemovingParticipantId] = useState<string | null>(null);
  const [isResettingExpenses, setIsResettingExpenses] = useState(false);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [settlementActionLoading, setSettlementActionLoading] = useState<Record<string, string>>(
    {},
  );
  const [selfReportLoading, setSelfReportLoading] = useState(false);
  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const [allPaidSheetOpen, setAllPaidSheetOpen] = useState(false);
  const loadEventLedger = useSettlementStore((state) => state.loadEventLedger);
  const getIOweForEvent = useSettlementStore((state) => state.getIOweForEvent);
  const skipFocusRefreshRef = useRef(false);
  const isFocused = useIsFocused();

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
      if (skipFocusRefreshRef.current) {
        skipFocusRefreshRef.current = false;
        return;
      }
      void refreshDetail();
    }, [refreshDetail]),
  );

  useEffect(() => {
    if (!isFocused) return undefined;

    const event = currentEvent?.event;
    if (!event) return undefined;

    const subscribeSettlement = isSettlementEventStatus(event.status);
    if (!isJoiningPhase(event.status) && !subscribeSettlement) return undefined;

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
          void loadEventDetail(eventId).catch(() => {
            // Realtime refresh failures must not surface as unhandled rejections (red screen).
          });
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [isFocused, currentEvent?.event?.status, eventId, loadEventDetail]);

  const participants = currentEvent?.participants ?? [];
  const event = currentEvent?.event;

  const runSettlementAction = async (
    participantId: string,
    actionKey: string,
    action: () => Promise<unknown>,
    successMessage?: string,
  ): Promise<void> => {
    setSettlementActionLoading((prev) => ({ ...prev, [participantId]: actionKey }));
    try {
      await action();
      if (successMessage) setToast(successMessage);
      await loadEventDetail(eventId);
    } catch (err: unknown) {
      const code = isApiRequestError(err) ? err.code : getApiErrorCode(err);
      if (code === 'NUDGE_COOLDOWN') {
        setToast('Nudge cooldown — try again later');
      } else {
        setToast('Could not update payment. Try again.');
      }
    } finally {
      setSettlementActionLoading((prev) => {
        const next = { ...prev };
        delete next[participantId];
        return next;
      });
    }
  };

  const submitSelfReport = async (
    participantId: string,
    method: settlementService.SelfReportPaymentMethod,
  ): Promise<void> => {
    setSelfReportLoading(true);
    try {
      await settlementService.selfReportPayment(eventId, participantId, method);
      setAllPaidSheetOpen(false);
      setToast('Payment recorded');
      await loadEventDetail(eventId);
    } catch {
      setToast('Could not report payment. Try again.');
    } finally {
      setSelfReportLoading(false);
    }
  };

  const joinUrl = currentEvent?.join_token?.join_url ?? '';
  const tokenExpiresAt = currentEvent?.join_token?.expires_at ?? '';
  const expired = isTokenExpired(tokenExpiresAt);
  const joining = event ? isJoiningPhase(event.status) : true;
  const memberCount = participants.length;
  const lockEnabled = memberCount >= 2;
  const isPayer = Boolean(authUser && event && authUser.id === event.payer_id);
  const splitActionMode = event
    ? resolveEventSplitActionMode(event.ai_stage, Boolean(currentEvent?.receipt_review))
    : 'initial';
  const showResetExpenses = event
    ? canResetEventExpenses(event.ai_stage, event.messages_sent_at)
    : false;
  const showDeleteEvent = event ? canDeleteEvent(event.messages_sent_at) : false;
  const showSendMessages = event
    ? canSendEventMessages(event.ai_stage, event.messages_sent_at)
    : false;
  const showSplitActions = Boolean(isPayer && event && isSettlementEventStatus(event.status));
  const canEditShare = Boolean(
    event && canEditEventShare(event.messages_sent_at, participants),
  );
  const showOverflowMenu = Boolean(
    isPayer &&
      event &&
      (showDeleteEvent || (!joining && (event.status === 'locked' || showResetExpenses))),
  );
  const selfParticipant = participants.find((row) => row.is_self);
  const showOrganiserCollectionActions = canOrganiserNudgeOrMarkCash(event?.messages_sent_at);
  const showParticipantPayActions = Boolean(
    !isPayer &&
      event &&
      isSettlementEventStatus(event.status) &&
      selfParticipant &&
      canParticipantPayShare(
        event.messages_sent_at,
        selfParticipant.amount_owed,
        selfParticipant.payment_status,
      ),
  );

  const iOweEntry = getIOweForEvent(eventId);

  const participantPayContext = useMemo(() => {
    if (!showParticipantPayActions || !selfParticipant || !event) return null;
    const amount =
      iOweEntry?.amount_minor_units ?? selfParticipant.amount_owed ?? 0;
    const handles = iOweEntry?.creator_payment_handles ?? [];
    const payerName =
      iOweEntry?.payer_display_name ?? event.payer?.display_name ?? 'Organiser';
    return {
      amount,
      currency: iOweEntry?.currency ?? event.currency,
      payerDisplayName: payerName,
      eventTitleForLink: event.title,
      handles,
      participantId: selfParticipant.id,
    };
  }, [showParticipantPayActions, selfParticipant, event, iOweEntry, eventId]);

  useEffect(() => {
    if (showParticipantPayActions) {
      void loadEventLedger();
    }
  }, [showParticipantPayActions, loadEventLedger]);
  const settlementRosterParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      if (a.is_organiser) return -1;
      if (b.is_organiser) return 1;
      if (a.is_self) return -1;
      if (b.is_self) return 1;
      return 0;
    });
  }, [participants]);

  const openItemReview = () => {
    const review = currentEvent?.receipt_review;
    if (!review) {
      setToast('Receipt data is not ready yet. Pull to refresh.');
      return;
    }
    navigateInEventFlow(navigation, 'ItemReview', {
      eventId,
      storagePath: '',
      parseResult: receiptReviewToParseResult(review),
    });
  };

  const openEditShare = async () => {
    if (currentEvent?.event?.messages_sent_at && !canEditShare) {
      setToast('Split is locked — resolve self-reported or confirmed payments first.');
      return;
    }

    let detail = currentEvent;
    if (!detail?.receipt_review) {
      try {
        await loadEventDetail(eventId);
        detail = useEventStore.getState().currentEvent;
      } catch {
        setToast('Could not load event. Try again.');
        return;
      }
    }

    const event = detail?.event;
    if (!event) {
      setToast('Could not load event. Try again.');
      return;
    }

    const mode = resolveSplitEntryMode(
      event.split_mode,
      event.ai_stage,
      Boolean(detail?.receipt_review),
    );
    navigateInEventFlow(navigation, 'SplitEntry', { eventId, mode });
  };

  const openMessagePreview = () => {
    void openMessagePreviewOrComplete(navigation, eventId, participants).catch(() => {
      setToast('Could not open messages. Try again.');
    });
  };

  const confirmReopenJoinWindow = () => {
    Alert.alert(
      'Reopen join window?',
      'The event will be open again for 24 hours so a latecomer can scan the QR or use the link. Lock the event again after they join.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reopen',
          onPress: () => {
            void handleReopen();
          },
        },
      ],
    );
  };

  const confirmResetExpenses = () => {
    Alert.alert(
      'Reset expenses?',
      'All receipt scans, line items, and manually entered amounts for this event will be deleted. You can scan again or enter a new total.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            void handleResetExpenses();
          },
        },
      ],
    );
  };

  const confirmDeleteEvent = () => {
    Alert.alert(
      'Delete event?',
      'This permanently removes the event, members, and any receipt data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void handleDeleteEvent();
          },
        },
      ],
    );
  };

  const handleDeleteEvent = async () => {
    setIsDeletingEvent(true);
    try {
      await deleteEventFromStore(eventId);
      if (useSplitStore.getState().eventId === eventId) {
        useSplitStore.getState().clear();
      }
      navigation.navigate('Events');
    } catch (err) {
      const code = isApiRequestError(err) ? getApiErrorCode(err) : undefined;
      if (code === 'EVENT_MESSAGES_ALREADY_SENT') {
        Alert.alert(
          'Cannot delete',
          'Payment messages were already sent for this event.',
        );
        await refreshDetail();
      } else {
        Alert.alert('Could not delete event', 'Try again in a moment.');
      }
    } finally {
      setIsDeletingEvent(false);
    }
  };

  const handleResetExpenses = async () => {
    skipFocusRefreshRef.current = true;
    setIsResettingExpenses(true);
    try {
      await eventService.resetEventExpenses(eventId);
      useEventStore.getState().applyExpensesResetLocal(eventId);
      if (useSplitStore.getState().eventId === eventId) {
        useSplitStore.getState().clear();
      }
      await loadEventDetail(eventId);
      setToast('Expenses reset — choose how to split again');
    } catch (err: unknown) {
      const code = isApiRequestError(err) ? err.code : getApiErrorCode(err);
      if (code === 'MESSAGES_ALREADY_SENT') {
        setToast('Cannot reset after messages have been sent');
      } else if (code === 'NOTHING_TO_RESET') {
        setToast('Nothing to reset for this event');
      } else if (code === 'RESET_FAILED' || code === 'DB_WRITE_FAILED') {
        const detail = isApiRequestError(err) ? err.message : undefined;
        setToast(detail ?? 'Could not reset expenses. Try again.');
      } else {
        const detail = isApiRequestError(err) ? err.message : undefined;
        setToast(detail ?? 'Could not reset expenses. Try again.');
      }
    } finally {
      setIsResettingExpenses(false);
    }
  };

  const settlementSummary = useMemo(() => {
    if (!currentEvent?.summary) {
      return { total: 0, collected: 0, outstanding: 0 };
    }
    return currentEvent.summary;
  }, [currentEvent?.summary]);

  const handleAddParticipantsBatch = async (
    entries: GroupBuilderSubmitPayload[],
  ): Promise<AddMembersBatchResult> => {
    setIsAdding(true);
    setAddError(null);

    const added: GroupBuilderSubmitPayload[] = [];
    const failed: AddMembersBatchResult['failed'] = [];

    try {
      for (const entry of entries) {
        try {
          await eventService.addManualParticipant(eventId, entry);
          added.push(entry);
        } catch (err: unknown) {
          const code = isApiRequestError(err) ? err.code : getApiErrorCode(err);
          const message =
            code === 'DUPLICATE_PHONE'
              ? 'Already on this event'
              : `Failed to add ${entry.display_name}`;
          failed.push({ entry, message });
        }
      }

      if (added.length > 0) {
        const label =
          failed.length > 0
            ? `✓ Added ${added.length} members · ${failed.length} could not be added`
            : added.length === 1
              ? `✓ ${added[0]!.display_name} added`
              : `✓ Added ${added.length} members`;
        setToast(label);
        await loadEventDetail(eventId);
      }

      if (failed.length > 0 && added.length === 0) {
        setAddError(failed.map((item) => item.message).join(' · '));
      }
    } finally {
      setIsAdding(false);
    }

    return { added, failed };
  };

  const handleLock = async () => {
    setLockError(null);
    try {
      await lockEvent(eventId);
    } catch (err: unknown) {
      const code = isApiRequestError(err) ? err.code : getApiErrorCode(err);
      setLockError(lockEventErrorMessage(code));
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
            canSendMessages={showSendMessages}
            canEditShare={canEditShare}
            onScanReceipt={() => navigateInEventFlow(navigation, 'ReceiptScan', { eventId })}
            onEnterTotal={() =>
              navigateInEventFlow(navigation, 'SplitEntry', { eventId, mode: 'manual' })
            }
            onReviewItems={openItemReview}
            onEditShare={() => void openEditShare()}
            onSendMessages={openMessagePreview}
          />
        ) : undefined
      }
      footerStyle={showSplitActions ? splitActionBarFooterStyle(rawBottom) : undefined}
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
        {showOverflowMenu ? (
          <EventDetailOverflowMenu
            showReopen={event?.status === 'locked'}
            reopenLoading={isReopening}
            onReopen={confirmReopenJoinWindow}
            showReset={showResetExpenses}
            resetLoading={isResettingExpenses}
            onReset={confirmResetExpenses}
            showDelete={showDeleteEvent}
            deleteLoading={isDeletingEvent}
            onDelete={confirmDeleteEvent}
          />
        ) : (
          <View style={styles.topBarPlaceholder} />
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: showSplitActions
              ? 24
              : screenScrollBottomPadding,
          },
        ]}
        removeClippedSubviews={false}
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
          <>
            <ParticipantEventDetail detail={currentEvent} />
            {participantPayContext ? (
              <ParticipantPayActions
                onPayNow={() => setPaySheetOpen(true)}
                onAllPaid={() => setAllPaidSheetOpen(true)}
                allPaidLoading={selfReportLoading}
              />
            ) : null}
          </>
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
              onPress={() => setAddMembersOpen(true)}
              style={styles.addButton}
            />

            <PrimaryButton
              label={`Lock event → · ${memberCount} ${memberCount === 1 ? 'member' : 'members'}`}
              loading={isLocking}
              disabled={!lockEnabled || isLocking}
              onPress={() => void handleLock()}
              accessibilityLabel={`Lock event, ${memberCount} members`}
              style={styles.lockButton}
            />
            {memberCount < 2 ? (
              <Text style={styles.lockHint}>
                Add at least one more member besides you to lock this event.
              </Text>
            ) : null}
            {lockError ? <Text style={glassStyles.errorText}>{lockError}</Text> : null}
          </>
        ) : isPayer ? (
          <View style={styles.settlementPhase}>
            <View style={styles.settlementHeader}>
              <Text style={glassStyles.heading}>Settlement phase</Text>
              {event ? (
                <View style={styles.organiserStatusChip}>
                  <Text style={styles.organiserStatusChipText}>
                    {statusChipLabel(event.status, { role: 'creator' })}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.summaryCard}>
              <View style={styles.summaryColumns}>
                <View style={[styles.summaryColumn, styles.summaryColumnTotal]}>
                  <Text style={[styles.summaryAmount, styles.summaryAmountTotal]}>
                    {formatMoney(settlementSummary.total, event?.currency ?? 'USD')}
                  </Text>
                  <Text style={styles.summaryLabel}>Total bill</Text>
                </View>
                <View style={[styles.summaryColumn, styles.summaryColumnCollected]}>
                  <Text style={[styles.summaryAmount, styles.summaryAmountCollected]}>
                    {formatMoney(settlementSummary.collected, event?.currency ?? 'USD')}
                  </Text>
                  <Text style={styles.summaryLabel}>Collected</Text>
                </View>
                <View style={[styles.summaryColumn, styles.summaryColumnOutstanding]}>
                  <Text style={[styles.summaryAmount, styles.summaryAmountOutstanding]}>
                    {formatMoney(settlementSummary.outstanding, event?.currency ?? 'USD')}
                  </Text>
                  <Text style={styles.summaryLabel}>Outstanding</Text>
                </View>
              </View>
            </View>

            <SettlementProgressBar
              collected={settlementSummary.collected}
              total={
                settlementSummary.collected + settlementSummary.outstanding > 0
                  ? settlementSummary.collected + settlementSummary.outstanding
                  : settlementSummary.total
              }
            />

            <Text style={glassStyles.sectionTitle}>
              Members · {settlementRosterParticipants.length}
            </Text>
            <View style={styles.memberList}>
              {settlementRosterParticipants.map((participant) => {
                const isOrganiserRow = Boolean(participant.is_organiser);
                return (
                  <SettlementRosterRow
                    key={participant.id}
                    displayName={
                      participant.is_self ? 'You' : participant.display_name
                    }
                    paymentStatus={participant.payment_status}
                    amountOwed={participant.amount_owed}
                    currency={event?.currency ?? 'USD'}
                    userId={participant.user_id}
                    selfReportedMethod={participant.self_reported_method}
                    isOrganiser={isOrganiserRow}
                    isSelf={participant.is_self}
                    loadingAction={settlementActionLoading[participant.id]}
                    onDispute={
                      isOrganiserRow || !showOrganiserCollectionActions
                        ? undefined
                        : () =>
                            void runSettlementAction(
                              participant.id,
                              'dispute',
                              () => settlementService.disputePayment(eventId, participant.id),
                              'Payment disputed',
                            )
                    }
                    onMarkCash={
                      isOrganiserRow || !showOrganiserCollectionActions
                        ? undefined
                        : () =>
                            void runSettlementAction(
                              participant.id,
                              'mark-cash',
                              () =>
                                settlementService.markParticipantPaid(
                                  eventId,
                                  participant.id,
                                  'cash',
                                ),
                              'Marked as paid',
                            )
                    }
                  />
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <AddMembersSheet
        visible={isPayer && addMembersOpen}
        isSubmitting={isAdding}
        submitError={addError}
        existingParticipants={participants.map((participant) => ({
          display_name: participant.display_name,
        }))}
        onClose={() => {
          setAddMembersOpen(false);
          setAddError(null);
        }}
        onSubmitBatch={handleAddParticipantsBatch}
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

      {participantPayContext ? (
        <PayHandlesSheet
          visible={paySheetOpen}
          onClose={() => setPaySheetOpen(false)}
          title="Pay now"
          subtitle={participantPayContext.eventTitleForLink}
          amount={participantPayContext.amount}
          currency={participantPayContext.currency}
          payerDisplayName={participantPayContext.payerDisplayName}
          eventTitleForLink={participantPayContext.eventTitleForLink}
          handles={participantPayContext.handles}
        />
      ) : null}

      {participantPayContext ? (
        <AllPaidSheet
          visible={allPaidSheetOpen}
          onClose={() => setAllPaidSheetOpen(false)}
          title="All paid"
          description="Which payment method did you use?"
          handles={participantPayContext.handles}
          loading={selfReportLoading}
          onConfirm={(method) =>
            void submitSelfReport(participantPayContext.participantId, method)
          }
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
  topBarPlaceholder: {
    minWidth: 36,
    minHeight: 36,
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
  settlementPhase: {
    marginTop: 8,
  },
  settlementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  organiserStatusChip: {
    backgroundColor: authColors.pillOnDark,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  organiserStatusChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: authColors.textOnDarkMuted,
  },
  summaryCard: {
    ...glassStyles.cardStrong,
    marginBottom: 20,
  },
  summaryColumns: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryColumn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    minWidth: 0,
  },
  summaryColumnTotal: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  summaryColumnCollected: {
    backgroundColor: 'rgba(110, 231, 183, 0.14)',
  },
  summaryColumnOutstanding: {
    backgroundColor: 'rgba(252, 165, 165, 0.14)',
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  summaryAmountTotal: {
    color: authColors.textOnDark,
  },
  summaryAmountCollected: {
    color: '#6EE7B7',
  },
  summaryAmountOutstanding: {
    color: authColors.errorOnDark,
  },
  summaryLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: authColors.textOnDarkMuted,
    textAlign: 'center',
    flexShrink: 0,
  },
});
