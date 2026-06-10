import { StyleSheet, View } from 'react-native';
import type { EventSplitActionMode } from '../../utils/eventSplitFooter';
import { PrimaryButton } from '../PrimaryButton';

interface EventSplitActionBarProps {
  mode: EventSplitActionMode;
  canResetExpenses: boolean;
  onScanReceipt: () => void;
  onEnterTotal: () => void;
  onReviewItems: () => void;
  onEditShare: () => void;
  onResetExpenses: () => void;
}

/** Split CTAs shown after the group is locked (creator only). Render in AuthGradientLayout footer. */
export function EventSplitActionBar({
  mode,
  canResetExpenses,
  onScanReceipt,
  onEnterTotal,
  onReviewItems,
  onEditShare,
  onResetExpenses,
}: EventSplitActionBarProps) {
  if (mode === 'parsing') {
    return (
      <View style={styles.container} pointerEvents="box-none">
        <PrimaryButton
          label="Reading receipt…"
          disabled
          accessibilityLabel="Reading receipt"
          style={styles.fullWidth}
        />
      </View>
    );
  }

  if (mode === 'review') {
    return (
      <View style={styles.container} pointerEvents="box-none">
        <PrimaryButton
          label="Review items"
          onPress={onReviewItems}
          accessibilityLabel="Review receipt items"
          style={styles.fullWidth}
        />
      </View>
    );
  }

  if (mode === 'edit') {
    return (
      <View style={styles.container} pointerEvents="box-none">
        <PrimaryButton
          label="Edit share"
          onPress={onEditShare}
          accessibilityLabel="Edit split"
          style={styles.button}
        />
        {canResetExpenses ? (
          <PrimaryButton
            label="Reset expenses"
            variant="inverse"
            onPress={onResetExpenses}
            accessibilityLabel="Reset expenses"
            style={styles.button}
          />
        ) : null}
      </View>
    );
  }

  if (mode === 'failed') {
    return (
      <View style={styles.container} pointerEvents="box-none">
        <PrimaryButton
          label="Scan receipt"
          onPress={onScanReceipt}
          accessibilityLabel="Scan receipt again"
          style={styles.fullWidth}
        />
        <PrimaryButton
          label="Enter total"
          variant="inverse"
          onPress={onEnterTotal}
          accessibilityLabel="Enter total for custom split"
          style={styles.fullWidth}
        />
      </View>
    );
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      <PrimaryButton
        label="Scan receipt"
        onPress={onScanReceipt}
        accessibilityLabel="Scan receipt for itemised split"
        style={styles.button}
      />
      <PrimaryButton
        label="Enter total"
        variant="inverse"
        onPress={onEnterTotal}
        accessibilityLabel="Enter total for custom split"
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  button: {
    flex: 1,
  },
  fullWidth: {
    flex: 1,
    alignSelf: 'stretch',
  },
});
