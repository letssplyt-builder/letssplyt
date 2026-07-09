import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';
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
const ACTION_BUTTON_WIDTH = 84;
const ACTION_SLOT_GAP = 8;
const ACTION_SLOT_WIDTH = ACTION_BUTTON_WIDTH + ACTION_SLOT_GAP;
const SWIPE_OPEN_THRESHOLD = 48;

type SettlementSwipeHandle = {
  close: () => void;
  openLeft: () => void;
  openRight: () => void;
};

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

const openSettlementSwipeables = new Set<SettlementSwipeHandle>();

function closeOtherSwipeables(current: SettlementSwipeHandle | null): void {
  for (const swipeable of openSettlementSwipeables) {
    if (swipeable !== current) {
      swipeable.close();
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function statusToneColor(
  theme: Theme,
  tone: 'paid' | 'pending' | 'disputed' | 'muted',
): string {
  switch (tone) {
    case 'paid':
      return theme.good;
    case 'pending':
    case 'disputed':
      return theme.warn;
    default:
      return theme.ink3;
  }
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    shell: {
      marginBottom: 8,
    },
    shrinkRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    actionSlot: {
      overflow: 'hidden',
    },
    actionSlotInnerLeft: {
      width: ACTION_SLOT_WIDTH,
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    actionSlotInnerRight: {
      width: ACTION_SLOT_WIDTH,
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    actionSlotGap: {
      width: ACTION_SLOT_GAP,
      flexShrink: 0,
    },
    card: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: theme.surface,
      borderRadius: theme.radiusSm,
      borderWidth: 1,
      borderColor: theme.line,
      gap: 10,
      overflow: 'hidden',
    },
    cardRailLeft: {
      paddingLeft: 14,
    },
    cardRailRight: {
      paddingRight: 14,
    },
    railLeft: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 5,
      backgroundColor: theme.bad,
      opacity: 0.85,
    },
    railRight: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: 5,
      backgroundColor: theme.good,
      opacity: 0.85,
    },
    selfRow: {
      borderColor: theme.accentSoft,
      backgroundColor: theme.accentSoft,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.surfaceStrong,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatarText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.accent,
      fontFamily: theme.fontBody,
    },
    info: {
      flex: 1,
      minWidth: 0,
    },
    name: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    statusMeta: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
      fontFamily: theme.fontBody,
    },
    amount: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.ink,
      flexShrink: 0,
      maxWidth: '36%',
      fontVariant: ['tabular-nums'],
      fontFamily: theme.fontDisplay,
    },
    swipeButton: {
      width: ACTION_BUTTON_WIDTH,
      flexShrink: 0,
      minHeight: 52,
      borderRadius: theme.radiusSm,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 6,
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
      color: theme.ink,
      textAlign: 'center',
      fontFamily: theme.fontBody,
    },
  });
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
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const panX = useRef(new Animated.Value(0)).current;
  const dragStartX = useRef(0);
  const swipeHandleRef = useRef<SettlementSwipeHandle | null>(null);
  const previousPaymentStatusRef = useRef(paymentStatus);
  const mountHintPlayedRef = useRef(false);

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

  const minPanX = hasPaidAction ? -ACTION_SLOT_WIDTH : 0;
  const maxPanX = hasDisputeAction ? ACTION_SLOT_WIDTH : 0;

  const animateTo = useCallback(
    (target: number, onComplete?: () => void) => {
      Animated.spring(panX, {
        toValue: target,
        useNativeDriver: false,
        friction: 8,
        tension: 140,
      }).start(({ finished }) => {
        if (finished) {
          onComplete?.();
        }
      });
    },
    [panX],
  );

  const closeSwipe = useCallback(() => {
    dragStartX.current = 0;
    animateTo(0, () => {
      if (swipeHandleRef.current) {
        openSettlementSwipeables.delete(swipeHandleRef.current);
      }
    });
  }, [animateTo]);

  const openLeft = useCallback(() => {
    if (!hasDisputeAction) {
      return;
    }
    closeOtherSwipeables(swipeHandleRef.current);
    dragStartX.current = ACTION_SLOT_WIDTH;
    animateTo(ACTION_SLOT_WIDTH, () => {
      if (swipeHandleRef.current) {
        openSettlementSwipeables.add(swipeHandleRef.current);
      }
    });
  }, [animateTo, hasDisputeAction]);

  const openRight = useCallback(() => {
    if (!hasPaidAction) {
      return;
    }
    closeOtherSwipeables(swipeHandleRef.current);
    dragStartX.current = -ACTION_SLOT_WIDTH;
    animateTo(-ACTION_SLOT_WIDTH, () => {
      if (swipeHandleRef.current) {
        openSettlementSwipeables.add(swipeHandleRef.current);
      }
    });
  }, [animateTo, hasPaidAction]);

  swipeHandleRef.current = {
    close: closeSwipe,
    openLeft,
    openRight,
  };

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

  useEffect(() => {
    if (!playMountHint || !hasSwipeActions || mountHintPlayedRef.current) {
      return undefined;
    }
    mountHintPlayedRef.current = true;
    onSwipeHintPlayed?.();

    const openTimer = setTimeout(() => {
      if (hasPaidAction) {
        openRight();
      } else if (hasDisputeAction) {
        openLeft();
      }
    }, SWIPE_HINT_OPEN_MS);

    const closeTimer = setTimeout(() => {
      closeSwipe();
    }, SWIPE_HINT_OPEN_MS + SWIPE_HINT_HOLD_MS);

    return () => {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
    };
  }, [
    playMountHint,
    hasSwipeActions,
    hasPaidAction,
    hasDisputeAction,
    onSwipeHintPlayed,
    openLeft,
    openRight,
    closeSwipe,
  ]);

  const swipeGestureRef = useRef({
    hasSwipeActions,
    minPanX,
    maxPanX,
    hasDisputeAction,
    hasPaidAction,
    animateTo,
  });
  swipeGestureRef.current = {
    hasSwipeActions,
    minPanX,
    maxPanX,
    hasDisputeAction,
    hasPaidAction,
    animateTo,
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        const config = swipeGestureRef.current;
        if (!config.hasSwipeActions) {
          return false;
        }
        return (
          Math.abs(gesture.dx) > Math.abs(gesture.dy) &&
          Math.abs(gesture.dx) > 8
        );
      },
      onPanResponderGrant: () => {
        panX.stopAnimation((value) => {
          dragStartX.current = value ?? 0;
        });
      },
      onPanResponderMove: (_, gesture) => {
        const { minPanX: minX, maxPanX: maxX } = swipeGestureRef.current;
        const next = clamp(dragStartX.current + gesture.dx, minX, maxX);
        panX.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const config = swipeGestureRef.current;
        const current = clamp(
          dragStartX.current + gesture.dx,
          config.minPanX,
          config.maxPanX,
        );
        let target = 0;

        if (
          config.hasDisputeAction &&
          (current >= SWIPE_OPEN_THRESHOLD || gesture.vx > 0.75)
        ) {
          target = ACTION_SLOT_WIDTH;
        } else if (
          config.hasPaidAction &&
          (current <= -SWIPE_OPEN_THRESHOLD || gesture.vx < -0.75)
        ) {
          target = -ACTION_SLOT_WIDTH;
        }

        dragStartX.current = target;
        config.animateTo(target, () => {
          if (!swipeHandleRef.current) {
            return;
          }
          if (target === 0) {
            openSettlementSwipeables.delete(swipeHandleRef.current);
          } else {
            closeOtherSwipeables(swipeHandleRef.current);
            openSettlementSwipeables.add(swipeHandleRef.current);
          }
        });
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderTerminate: () => {
        swipeGestureRef.current.animateTo(dragStartX.current);
      },
    }),
  ).current;

  const leftSlotWidth = panX.interpolate({
    inputRange: [0, ACTION_SLOT_WIDTH],
    outputRange: [0, ACTION_SLOT_WIDTH],
    extrapolate: 'clamp',
  });

  const rightSlotWidth = panX.interpolate({
    inputRange: [-ACTION_SLOT_WIDTH, 0],
    outputRange: [ACTION_SLOT_WIDTH, 0],
    extrapolate: 'clamp',
  });

  const rowBody = (
    <View
      style={[
        styles.card,
        isSelf && styles.selfRow,
        hasDisputeAction && styles.cardRailLeft,
        hasPaidAction && styles.cardRailRight,
      ]}
    >
      {hasDisputeAction ? <View style={styles.railLeft} /> : null}
      {hasPaidAction ? <View style={styles.railRight} /> : null}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
          {displayName}
        </Text>
        <Text
          style={[
            styles.statusMeta,
            { color: statusToneColor(theme, statusDisplay.tone) },
          ]}
          numberOfLines={1}
        >
          {statusDisplay.label}
        </Text>
      </View>
      <Text style={styles.amount} numberOfLines={1}>
        {formatMoney(amountOwed, currency)}
      </Text>
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

  return (
    <View style={styles.shell}>
      <View style={styles.shrinkRow} {...panResponder.panHandlers}>
        {hasDisputeAction ? (
          <Animated.View style={[styles.actionSlot, { width: leftSlotWidth }]}>
            <View style={styles.actionSlotInnerLeft}>
              <SwipeActionButton
                label="Dispute"
                loading={loadingAction === 'dispute'}
                backgroundColor={theme.bad}
                textColor={theme.ink}
                styles={styles}
                onPress={runDisputeAction}
              />
              <View style={styles.actionSlotGap} />
            </View>
          </Animated.View>
        ) : null}

        {rowBody}

        {hasPaidAction ? (
          <Animated.View style={[styles.actionSlot, { width: rightSlotWidth }]}>
            <View style={styles.actionSlotInnerRight}>
              <View style={styles.actionSlotGap} />
              <SwipeActionButton
                label="Mark paid"
                loading={loadingAction === 'mark-cash'}
                backgroundColor={theme.good}
                textColor={theme.accentInk}
                styles={styles}
                onPress={runPaidAction}
              />
            </View>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

function SwipeActionButton({
  label,
  onPress,
  loading,
  backgroundColor,
  textColor,
  styles,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  backgroundColor: string;
  textColor: string;
  styles: ReturnType<typeof makeStyles>;
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
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Text style={[styles.swipeButtonText, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}
