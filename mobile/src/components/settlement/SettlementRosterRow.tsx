import { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
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
  onDispute?: () => void;
  onMarkCash?: () => void;
}

const ACTION_WIDTH = 96;
const CARD_RADIUS = 16;

const STATUS_TONE = {
  paid: {
    text: '#6EE7B7',
    pillBg: 'rgba(16, 185, 129, 0.18)',
    pillBorder: 'rgba(52, 211, 153, 0.35)',
    avatarRing: 'rgba(52, 211, 153, 0.55)',
  },
  pending: {
    text: '#FCD34D',
    pillBg: 'rgba(245, 158, 11, 0.16)',
    pillBorder: 'rgba(251, 191, 36, 0.35)',
    avatarRing: 'rgba(251, 191, 36, 0.5)',
  },
  disputed: {
    text: '#FCA5A5',
    pillBg: 'rgba(239, 68, 68, 0.16)',
    pillBorder: 'rgba(248, 113, 113, 0.35)',
    avatarRing: 'rgba(248, 113, 113, 0.5)',
  },
  muted: {
    text: authColors.textOnDarkMuted,
    pillBg: authColors.pillOnDark,
    pillBorder: authColors.glassBorder,
    avatarRing: authColors.glassBorder,
  },
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
  const toneStyle = STATUS_TONE[statusDisplay.tone];

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

  const cardBody = (
    <View style={[styles.card, isSelf && styles.selfCard]}>
      {hasDisputeAction ? <View style={styles.edgeAccentLeft} /> : null}
      {hasPaidAction ? <View style={styles.edgeAccentRight} /> : null}

      <View style={[styles.avatarRing, { borderColor: toneStyle.avatarRing }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      </View>

      <View style={styles.main}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.amount}>{formatMoney(amountOwed, currency)}</Text>
        </View>

        <View style={styles.metaRow}>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: toneStyle.pillBg,
                borderColor: toneStyle.pillBorder,
              },
            ]}
          >
            <Text style={[styles.statusPillText, { color: toneStyle.text }]}>
              {statusDisplay.label}
            </Text>
          </View>

          {hasSwipeActions ? (
            <View style={styles.swipeHintRow}>
              {hasDisputeAction ? (
                <Text style={styles.swipeHintLeft}>Dispute</Text>
              ) : (
                <View />
              )}
              {hasPaidAction ? <Text style={styles.swipeHintRight}>Mark paid</Text> : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );

  if (!hasSwipeActions) {
    return <View style={styles.shell}>{cardBody}</View>;
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
        friction={2.2}
        leftThreshold={ACTION_WIDTH * 0.45}
        rightThreshold={ACTION_WIDTH * 0.45}
        containerStyle={styles.swipeableContainer}
        childrenContainerStyle={styles.swipeableChild}
        onSwipeableOpen={handleSwipeableOpen}
        onSwipeableClose={handleSwipeableClose}
        renderLeftActions={
          hasDisputeAction
            ? (progress) => (
                <SwipeActionLane
                  side="left"
                  progress={progress}
                  label="Dispute"
                  icon="!"
                  loading={loadingAction === 'dispute'}
                  colors={['#991B1B', '#DC2626']}
                  onPress={runDisputeAction}
                />
              )
            : undefined
        }
        renderRightActions={
          hasPaidAction
            ? (progress) => (
                <SwipeActionLane
                  side="right"
                  progress={progress}
                  label="Mark paid"
                  icon="✓"
                  loading={loadingAction === 'mark-cash'}
                  colors={['#047857', '#10B981']}
                  onPress={runPaidAction}
                />
              )
            : undefined
        }
      >
        {cardBody}
      </Swipeable>
    </View>
  );
}

function SwipeActionLane({
  side,
  progress,
  label,
  icon,
  loading,
  colors,
  onPress,
}: {
  side: 'left' | 'right';
  progress?: Animated.AnimatedInterpolation<number>;
  label: string;
  icon: string;
  loading?: boolean;
  colors: [string, string];
  onPress: () => void;
}) {
  const animatedStyle =
    progress != null
      ? {
          opacity: progress.interpolate({
            inputRange: [0, 0.35, 1],
            outputRange: [0, 0.75, 1],
            extrapolate: 'clamp',
          }),
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.86, 1],
                extrapolate: 'clamp',
              }),
            },
          ],
        }
      : undefined;

  const radiusStyle: StyleProp<ViewStyle> =
    side === 'left'
      ? {
          borderTopRightRadius: CARD_RADIUS,
          borderBottomRightRadius: CARD_RADIUS,
        }
      : {
          borderTopLeftRadius: CARD_RADIUS,
          borderBottomLeftRadius: CARD_RADIUS,
        };

  return (
    <Animated.View
      style={[
        styles.actionLane,
        side === 'left' ? styles.actionLaneLeft : styles.actionLaneRight,
        animatedStyle,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={loading}
        onPress={onPress}
        style={({ pressed }) => [
          styles.actionPressable,
          pressed && !loading && styles.actionPressablePressed,
        ]}
      >
        <LinearGradient colors={colors} style={[styles.actionGradient, radiusStyle]}>
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <View style={styles.actionIconCircle}>
                <Text style={styles.actionIcon}>{icon}</Text>
              </View>
              <Text style={styles.actionLabel}>{label}</Text>
            </>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginBottom: 10,
  },
  swipeableContainer: {
    overflow: 'hidden',
    borderRadius: CARD_RADIUS,
  },
  swipeableChild: {
    backgroundColor: 'transparent',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: authColors.glassStrong,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    gap: 12,
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 3,
  },
  selfCard: {
    borderColor: 'rgba(129, 140, 248, 0.45)',
    backgroundColor: 'rgba(99, 102, 241, 0.14)',
  },
  edgeAccentLeft: {
    position: 'absolute',
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 999,
    backgroundColor: '#F87171',
  },
  edgeAccentRight: {
    position: 'absolute',
    right: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 999,
    backgroundColor: '#34D399',
  },
  avatarRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: authColors.pillOnDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: authColors.textOnDark,
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: authColors.textOnDark,
  },
  amount: {
    fontSize: 15,
    fontWeight: '800',
    color: authColors.textOnDark,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusPill: {
    flexShrink: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  swipeHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  swipeHintLeft: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: '#FCA5A5',
    textTransform: 'uppercase',
  },
  swipeHintRight: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: '#6EE7B7',
    textTransform: 'uppercase',
  },
  actionLane: {
    width: ACTION_WIDTH,
    justifyContent: 'center',
  },
  actionLaneLeft: {
    marginRight: 0,
  },
  actionLaneRight: {
    marginLeft: 0,
  },
  actionPressable: {
    flex: 1,
    alignSelf: 'stretch',
  },
  actionPressablePressed: {
    opacity: 0.92,
  },
  actionGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    minHeight: 76,
  },
  actionIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
