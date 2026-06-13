import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
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
  onDispute?: () => void;
  onMarkCash?: () => void;
}

const STATUS_TONE_COLORS = {
  paid: '#34D399',
  pending: '#FBBF24',
  disputed: '#FBBF24',
  muted: authColors.textOnDarkMuted,
} as const;

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
  onDispute,
  onMarkCash,
}: SettlementRosterRowProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const previousPaymentStatusRef = useRef(paymentStatus);

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

  const rowBody = (
    <View style={[styles.row, isSelf && styles.selfRow]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
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

  if (!hasPaidAction && !hasDisputeAction) {
    return (
      <View style={styles.shell}>
        {rowBody}
      </View>
    );
  }

  const runPaidAction = () => {
    closeSwipe();
    onMarkCash?.();
  };

  const runDisputeAction = () => {
    closeSwipe();
    onDispute?.();
  };

  return (
    <View style={styles.shell}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <Swipeable
          ref={swipeableRef}
          overshootLeft={false}
          overshootRight={false}
          friction={2}
          leftThreshold={48}
          rightThreshold={48}
          containerStyle={styles.swipeableContainer}
          childrenContainerStyle={styles.swipeableChild}
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
                      label="Paid"
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
      </GestureHandlerRootView>
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
  gestureRoot: {
    flexGrow: 0,
    flexShrink: 0,
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
