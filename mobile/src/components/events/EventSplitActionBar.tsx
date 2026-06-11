import { StyleSheet, View } from 'react-native';
import type { EventSplitActionMode } from '../../utils/eventSplitFooter';
import { PrimaryButton } from '../PrimaryButton';

interface EventSplitActionBarProps {
  mode: EventSplitActionMode;
  canSendMessages: boolean;
  onScanReceipt: () => void;
  onEnterTotal: () => void;
  onReviewItems: () => void;
  onEditShare: () => void;
  onSendMessages: () => void;
}

/** Split CTAs shown after the group is locked (creator only). Render in AuthGradientLayout footer. */
export function EventSplitActionBar({
  mode,
  canSendMessages,
  onScanReceipt,
  onEnterTotal,
  onReviewItems,
  onEditShare,
  onSendMessages,
}: EventSplitActionBarProps) {
  if (mode === 'parsing') {
    return (
      <View style={styles.container} pointerEvents="box-none">
        <PrimaryButton
          label="Reading receipt…"
          disabled
          accessibilityLabel="Reading receipt"
          style={styles.stacked}
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
          style={styles.stacked}
        />
      </View>
    );
  }

  if (mode === 'edit') {
    if (canSendMessages) {
      return (
        <View style={[styles.container, styles.row]} pointerEvents="box-none">
          <PrimaryButton
            label="Edit share"
            onPress={onEditShare}
            accessibilityLabel="Edit split"
            style={styles.button}
          />
          <PrimaryButton
            label="Send messages"
            onPress={onSendMessages}
            accessibilityLabel="Preview and send messages"
            style={styles.button}
          />
        </View>
      );
    }

    return (
      <View style={styles.container} pointerEvents="box-none">
        <PrimaryButton
          label="Edit share"
          onPress={onEditShare}
          accessibilityLabel="Edit split"
          style={styles.stacked}
        />
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
          style={styles.stacked}
        />
        <PrimaryButton
          label="Enter total"
          variant="inverse"
          onPress={onEnterTotal}
          accessibilityLabel="Enter total for custom split"
          style={styles.stacked}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.row]} pointerEvents="box-none">
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
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  button: {
    flex: 1,
  },
  stacked: {
    alignSelf: 'stretch',
  },
});
