import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
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
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      marginBottom: 12,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'stretch',
      paddingLeft: 12,
      paddingBottom: 0,
    },
    deleteButton: {
      width: 84,
      borderRadius: theme.radiusSm,
      backgroundColor: theme.bad,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 12,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 4,
    },
    deleteButtonPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.98 }],
    },
    deleteIcon: {
      fontSize: 18,
    },
    deleteLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
      fontFamily: theme.fontBody,
    },
  });
}

export function SwipeableHandleRow({
  handle,
  isDragging,
  onPress,
  onDrag,
  onDelete,
}: SwipeableHandleRowProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      <Swipeable
        overshootRight={false}
        friction={2}
        rightThreshold={48}
        renderRightActions={() => (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete payment method"
              onPress={onDelete}
              style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
            >
              <Text style={styles.deleteIcon}>🗑</Text>
              <Text style={styles.deleteLabel}>Delete</Text>
            </Pressable>
          </View>
        )}
      >
        <ProfileHandleCard
          handle={handle}
          isDragging={isDragging}
          onPress={onPress}
          onDrag={onDrag}
        />
      </Swipeable>
    </View>
  );
}
