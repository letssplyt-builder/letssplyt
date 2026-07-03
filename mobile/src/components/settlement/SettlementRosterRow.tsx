import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Swipeable } from 'react-native-gesture-handler';
import { authColors } from '../../theme/colors';
import { formatMoney, isRegisteredEventParticipant } from '../../utils/events';
import { rosterPaymentStatusDisplay } from '../../utils/settlementDisplay';

interface SettlementRosterRowProps {
  displayName: string;
  paymentStatus: string;
  amountOwed: number | null;
  currency?: string;
  userId?: string | null;
  selfReportedMethod?: string | null;
  isOrganiser?: boolean;
  isSelf?: boolean;
  loadingAction?: string | null;
  /** Brief auto-peek on mount — teaches swipe without copy. */
  playMountHint?: boolean;
  onSwipeHintPlayed?: () => void;
  onDispute?: () => void;
  onMarkCash?: () => void;
}

const SWIPE_HINT_OPEN_MS = 720;
const SWIPE_HINT_HOLD_MS = 520;

export function hasSettlementSwipeActions(
  paymentStatus: string,
  userId: string | null | undefined,
  isOrganiser: boolean,
  hasHandlers: boolean,
): boolean {
  if (!hasHandlers || isOrganiser) {
    return false;
  }
  const hasPaidAction = paymentStatus === 'pending' || paymentStatus === 'disputed';
  const hasDisputeAction =
    isRegisteredEventParticipant(userId) &&
    (paymentStatus === 'confirmed' ||
      paymentStatus === 'self_reported' ||
      paymentStatus === 'payer_marked' ||
      paymentStatus === 'settled');
  return hasPaidAction || hasDisputeAction;
}

const STATUS_TONE_COLORS = {
  paid: '#34D399',
  pending: '#FBBF24',
  disputed: '#FBBF24',
  muted: authColors.textOnDarkMuted,
} as const;

const openSettlementSwipeables = new Set<Swipeable>();

function closeOtherSwipeables(current: Swipeable | null): void {
  for (const swipeable of openSettlementSwipeables) {
    if (swipeable !== current) {
      swipeable.close();
    }
  }
}

export function SettlementRosterRow({
  displayName,
  paymentStatus,
  amountOwed,
  currency = 'USD',
  userId = null,
  selfReportedMethod,
  isOrganiser = false,
  isSelf = false,
  loadingAction = null,
  playMountHint = false,
  onSwipeHintPlayed,
  onDispute,
  onMarkCash,
}: SettlementRosterRowProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const previousPaymentStatusRef = useRef(paymentStatus);
  const mountHintPlayedRef = useRef(false);

  const closeSwipe = useCallback(() => {
    swipeableRef.current?.close();
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        closeSwipe();
      };
    }, [closeSwipe]),
  );

  useEffect(() => {
    if (previousPaymentStatusRef.current !== paymentStatus) {
      previousPaymentStatusRef.current = paymentStatus;
      closeSwipe();
    }
  }, [paymentStatus, closeSwipe]);

  const initial = displayName.charAt(0).toUpperCase();
  const statusDisplay = isOrganiser
    ? { label: 'Organiser', tone: 'muted' as const }
    : rosterPaymentStatusDisplay(paymentStatus, selfReportedMethod);

  const isRegisteredMember = isRegisteredEventParticipant(userId);

  const hasPaidAction =
    !isOrganiser &&
    (paymentStatus === 'pending' || paymentStatus === 'disputed') &&
    onMarkCash;
  const hasDisputeAction =
    isRegisteredMember &&
    !isOrganiser &&
    (paymentStatus === 'confirmed' ||
      paymentStatus === 'self_reported' ||
      paymentStatus === 'payer_marked' ||
      paymentStatus === 'settled') &&
    onDispute;
  const hasSwipeActions = hasPaidAction || hasDisputeAction;

  useEffect(() => {
    if (!playMountHint || !hasSwipeActions || mountHintPlayedRef.current) {
      return undefined;
    }
    mountHintPlayedRef.current = true;
    onSwipeHintPlayed?.();

    const openTimer = setTimeout(() => {
      if (hasPaidAction) {
        swipeableRef.current?.openRight();
      } else if (hasDisputeAction) {
        swipeableRef.current?.openLeft();
      }
    }, SWIPE_HINT_OPEN_MS);

    const closeTimer = setTimeout(() => {
      swipeableRef.current?.close();
    }, SWIPE_HINT_OPEN_MS + SWIPE_HINT_HOLD_MS);

    return () => {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
    };
  }, [playMountHint, hasSwipeActions, hasPaidAction, hasDisputeAction, onSwipeHintPlayed]);

  const rowBody = (
    <View
      style={[
        styles.row,
        isSelf && styles.selfRow,
        hasDisputeAction && styles.rowRailLeft,
        hasPaidAction && styles.rowRailRight,
      ]}
    >
      {hasDisputeAction ? <View style={styles.railLeft} /> : null}
      {hasPaidAction ? <View style={styles.railRight} /> : null}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
        <Text
          style={[
            styles.statusMeta,
            { color: STATUS_TONE_COLORS[statusDisplay.tone] },
          ]}
        >
          {statusDisplay.label}
        </Text>
      </View>
      <Text style={styles.amount}>{formatMoney(amountOwed, currency)}</Text>
    </View>
  );

  if (!hasSwipeActions) {
    return <View style={styles.shell}>{rowBody}</View>;
  }

  const runPaidAction = () => {
    closeSwipe();
    onMarkCash?.();
  };

  const runDisputeAction = () => {
    closeSwipe();
    onDispute?.();
  };

  const handleSwipeableOpen = () => {
    closeOtherSwipeables(swipeableRef.current);
    if (swipeableRef.current) {
      openSettlementSwipeables.add(swipeableRef.current);
    }
  };

  const handleSwipeableClose = () => {
    if (swipeableRef.current) {
      openSettlementSwipeables.delete(swipeableRef.current);
    }
  };

  return (
    <View style={styles.shell}>
      <Swipeable
        ref={swipeableRef}
        overshootLeft={false}
        overshootRight={false}
        friction={2}
        leftThreshold={48}
        rightThreshold={48}
        containerStyle={styles.swipeableContainer}
        childrenContainerStyle={styles.swipeableChild}
        onSwipeableOpen={handleSwipeableOpen}
        onSwipeableClose={handleSwipeableClose}
        renderLeftActions={
          hasDisputeAction
            ? () => (
                <View style={styles.leftActions}>
                  <SwipeActionButton
                    label="Dispute"
                    loading={loadingAction === 'dispute'}
                    backgroundColor="#B91C1C"
                    onPress={runDisputeAction}
                  />
                </View>
              )
            : undefined
        }
        renderRightActions={
          hasPaidAction
            ? () => (
                <View style={styles.rightActions}>
                  <SwipeActionButton
                    label="Mark paid"
                    loading={loadingAction === 'mark-cash'}
                    backgroundColor="#059669"
                    onPress={runPaidAction}
                  />
                </View>
              )
            : undefined
        }
      >
        {rowBody}
      </Swipeable>
    </View>
  );
}

function SwipeActionButton({
  label,
  onPress,
  loading,
  backgroundColor,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  backgroundColor: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.swipeButton,
        { backgroundColor },
        pressed && !loading && styles.swipeButtonPressed,
        loading && styles.swipeButtonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Text style={styles.swipeButtonText}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginBottom: 8,
  },
  swipeableContainer: {
    overflow: 'hidden',
    borderRadius: 12,
  },
  swipeableChild: {
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: authColors.glass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    gap: 10,
    overflow: 'hidden',
  },
  rowRailLeft: {
    paddingLeft: 14,
  },
  rowRailRight: {
    paddingRight: 14,
  },
  railLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: 'rgba(185, 28, 28, 0.72)',
  },
  railRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: 'rgba(5, 150, 105, 0.78)',
  },
  selfRow: {
    borderColor: 'rgba(129, 140, 248, 0.45)',
    backgroundColor: 'rgba(99, 102, 241, 0.14)',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: authColors.pillOnDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: authColors.textOnDark,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: authColors.textOnDark,
  },
  statusMeta: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  amount: {
    fontSize: 13,
    fontWeight: '700',
    color: authColors.textOnDark,
    marginTop: 2,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingRight: 8,
    justifyContent: 'center',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingLeft: 8,
    justifyContent: 'center',
  },
  swipeButton: {
    width: 84,
    alignSelf: 'stretch',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    minHeight: 52,
  },
  swipeButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  swipeButtonDisabled: {
    opacity: 0.7,
  },
  swipeButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
