import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  type PanResponderGestureState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { PaymentHandle } from '@letssplyt/shared/profile.types';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';
import { ProfileHandleCard } from './ProfileHandleCard';

interface SwipeableHandleRowProps {
  handle: PaymentHandle;
  isDragging?: boolean;
  onPress: () => void;
  onDrag: () => void;
  onDelete: () => void;
  /** Brief auto-peek on mount — teaches swipe without copy. */
  playMountHint?: boolean;
  onSwipeHintPlayed?: () => void;
}

const SWIPE_HINT_OPEN_MS = 720;
const SWIPE_HINT_HOLD_MS = 520;
const ACTION_BUTTON_WIDTH = 84;
const ACTION_SLOT_GAP = 8;
const ACTION_SLOT_WIDTH = ACTION_BUTTON_WIDTH + ACTION_SLOT_GAP;
const SWIPE_OPEN_THRESHOLD = 48;
const SWIPE_CAPTURE_THRESHOLD = 8;

type HandleSwipeHandle = {
  close: () => void;
  openDelete: () => void;
};

const openHandleSwipeables = new Set<HandleSwipeHandle>();

function closeOtherSwipeables(current: HandleSwipeHandle | null): void {
  for (const swipeable of openHandleSwipeables) {
    if (swipeable !== current) {
      swipeable.close();
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readAnimatedValue(value: Animated.Value): number {
  const raw = (value as Animated.Value & { _value?: number })._value;
  return typeof raw === 'number' ? raw : 0;
}

function shouldCaptureHorizontalSwipe(
  isDragging: boolean,
  gesture: PanResponderGestureState,
): boolean {
  if (isDragging) {
    return false;
  }
  return (
    Math.abs(gesture.dx) > Math.abs(gesture.dy) &&
    Math.abs(gesture.dx) > SWIPE_CAPTURE_THRESHOLD
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    shell: {
      marginBottom: 12,
    },
    shrinkRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    card: {
      flex: 1,
      minWidth: 0,
    },
    actionSlot: {
      overflow: 'hidden',
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
    deleteButton: {
      width: ACTION_BUTTON_WIDTH,
      flexShrink: 0,
      minHeight: 52,
      borderRadius: theme.radiusSm,
      backgroundColor: theme.bad,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 6,
    },
    deleteButtonPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.98 }],
    },
    deleteButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.ink,
      textAlign: 'center',
      fontFamily: theme.fontBody,
    },
  });
}

export function SwipeableHandleRow({
  handle,
  isDragging = false,
  onPress,
  onDrag,
  onDelete,
  playMountHint = false,
  onSwipeHintPlayed,
}: SwipeableHandleRowProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const panX = useRef(new Animated.Value(0)).current;
  const dragStartX = useRef(0);
  const swipeHandleRef = useRef<HandleSwipeHandle | null>(null);
  const mountHintPlayedRef = useRef(false);
  const isSwipeActiveRef = useRef(false);

  const minPanX = -ACTION_SLOT_WIDTH;
  const maxPanX = 0;

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
    isSwipeActiveRef.current = false;
    animateTo(0, () => {
      if (swipeHandleRef.current) {
        openHandleSwipeables.delete(swipeHandleRef.current);
      }
    });
  }, [animateTo]);

  const openDelete = useCallback(() => {
    closeOtherSwipeables(swipeHandleRef.current);
    dragStartX.current = -ACTION_SLOT_WIDTH;
    isSwipeActiveRef.current = true;
    animateTo(-ACTION_SLOT_WIDTH, () => {
      if (swipeHandleRef.current) {
        openHandleSwipeables.add(swipeHandleRef.current);
      }
    });
  }, [animateTo]);

  swipeHandleRef.current = {
    close: closeSwipe,
    openDelete,
  };

  useFocusEffect(
    useCallback(() => {
      return () => {
        closeSwipe();
      };
    }, [closeSwipe]),
  );

  useEffect(() => {
    if (isDragging) {
      closeSwipe();
    }
  }, [isDragging, closeSwipe]);

  useEffect(() => {
    if (!playMountHint || mountHintPlayedRef.current || isDragging) {
      return undefined;
    }
    mountHintPlayedRef.current = true;
    onSwipeHintPlayed?.();

    const openTimer = setTimeout(() => {
      openDelete();
    }, SWIPE_HINT_OPEN_MS);

    const closeTimer = setTimeout(() => {
      closeSwipe();
    }, SWIPE_HINT_OPEN_MS + SWIPE_HINT_HOLD_MS);

    return () => {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
    };
  }, [playMountHint, isDragging, onSwipeHintPlayed, openDelete, closeSwipe]);

  const swipeGestureRef = useRef({
    isDragging,
    minPanX,
    maxPanX,
    animateTo,
  });
  swipeGestureRef.current = {
    isDragging,
    minPanX,
    maxPanX,
    animateTo,
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        shouldCaptureHorizontalSwipe(swipeGestureRef.current.isDragging, gesture),
      onMoveShouldSetPanResponder: (_, gesture) =>
        shouldCaptureHorizontalSwipe(swipeGestureRef.current.isDragging, gesture),
      onPanResponderGrant: () => {
        isSwipeActiveRef.current = true;
        panX.stopAnimation();
        dragStartX.current = readAnimatedValue(panX);
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

        if (current <= -SWIPE_OPEN_THRESHOLD || gesture.vx < -0.75) {
          target = -ACTION_SLOT_WIDTH;
        }

        dragStartX.current = target;
        isSwipeActiveRef.current = target !== 0;
        config.animateTo(target, () => {
          if (!swipeHandleRef.current) {
            return;
          }
          if (target === 0) {
            openHandleSwipeables.delete(swipeHandleRef.current);
          } else {
            closeOtherSwipeables(swipeHandleRef.current);
            openHandleSwipeables.add(swipeHandleRef.current);
          }
        });
      },
      onPanResponderTerminationRequest: () => !isSwipeActiveRef.current,
      onPanResponderTerminate: () => {
        isSwipeActiveRef.current = false;
        swipeGestureRef.current.animateTo(dragStartX.current);
      },
    }),
  ).current;

  const rightSlotWidth = panX.interpolate({
    inputRange: [-ACTION_SLOT_WIDTH, 0],
    outputRange: [ACTION_SLOT_WIDTH, 0],
    extrapolate: 'clamp',
  });

  const runDelete = () => {
    closeSwipe();
    onDelete();
  };

  return (
    <View style={styles.shell}>
      <View style={styles.shrinkRow} {...panResponder.panHandlers}>
        <View style={styles.card}>
          <ProfileHandleCard
            handle={handle}
            isDragging={isDragging}
            onPress={onPress}
            onDrag={onDrag}
            showDeleteRail
          />
        </View>

        <Animated.View style={[styles.actionSlot, { width: rightSlotWidth }]}>
          <View style={styles.actionSlotInnerRight}>
            <View style={styles.actionSlotGap} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete payment method"
              onPress={runDelete}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && styles.deleteButtonPressed,
              ]}
            >
              <Text style={styles.deleteButtonText}>Delete</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
