import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import type { PaymentHandle } from '@letssplyt/shared/profile.types';
import { ProfileHandleCard } from './ProfileHandleCard';

interface SwipeableHandleRowProps {
  handle: PaymentHandle;
  isDragging?: boolean;
  onPress: () => void;
  onDrag: () => void;
  onDelete: () => void;
}

export function SwipeableHandleRow({
  handle,
  isDragging,
  onPress,
  onDrag,
  onDelete,
}: SwipeableHandleRowProps) {
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

const styles = StyleSheet.create({
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
    borderRadius: 18,
    backgroundColor: '#B91C1C',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    shadowColor: '#7F1D1D',
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
  },
});
