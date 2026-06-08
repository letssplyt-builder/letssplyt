import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PaymentHandle } from '@letssplyt/shared/profile.types';
import { providerLabel, providerVisual } from '../../utils/profile';
import { authColors } from '../../theme/colors';

interface ProfileHandleCardProps {
  handle: PaymentHandle;
  isDragging?: boolean;
  onPress: () => void;
  onDrag: () => void;
}

export function ProfileHandleCard({
  handle,
  isDragging,
  onPress,
  onDrag,
}: ProfileHandleCardProps) {
  const visual = providerVisual(handle.provider);

  return (
    <View style={[styles.card, isDragging && styles.cardDragging]}>
      <Pressable
        onLongPress={onDrag}
        delayLongPress={160}
        style={styles.dragHandle}
        accessibilityRole="button"
        accessibilityLabel="Drag to reorder"
        hitSlop={8}
      >
        <View style={styles.gripColumn}>
          <View style={styles.gripDot} />
          <View style={styles.gripDot} />
          <View style={styles.gripDot} />
        </View>
        <View style={styles.gripColumn}>
          <View style={styles.gripDot} />
          <View style={styles.gripDot} />
          <View style={styles.gripDot} />
        </View>
      </Pressable>

      <Pressable
        onPress={onPress}
        style={styles.tapArea}
        accessibilityRole="button"
        accessibilityLabel={`${providerLabel(handle.provider)}, ${handle.handle_value}. Tap to edit.`}
      >
        <View style={[styles.providerBadge, { backgroundColor: visual.color }]}>
          <Text style={styles.providerBadgeText}>{visual.badge}</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.providerName}>{providerLabel(handle.provider)}</Text>
          <Text style={styles.handleValue} numberOfLines={1}>
            {handle.handle_value}
          </Text>
        </View>

        <View style={styles.editAffordance}>
          <Text style={styles.editIcon}>✎</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
    backgroundColor: authColors.glassStrong,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: authColors.glassBorder,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  cardDragging: {
    opacity: 0.96,
    transform: [{ scale: 1.02 }],
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  dragHandle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 4,
    alignSelf: 'center',
  },
  tapArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  gripColumn: {
    gap: 4,
  },
  gripDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: authColors.textOnDarkFaint,
  },
  providerBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  body: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  providerName: {
    fontSize: 14,
    fontWeight: '700',
    color: authColors.textOnDark,
  },
  handleValue: {
    fontSize: 12,
    color: authColors.textOnDarkMuted,
  },
  editAffordance: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: authColors.glass,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
  },
  editIcon: {
    fontSize: 13,
    color: authColors.textOnDarkMuted,
  },
});
