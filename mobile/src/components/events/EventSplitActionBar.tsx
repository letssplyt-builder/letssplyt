import { StyleSheet, View } from 'react-native';
import { PrimaryButton } from '../PrimaryButton';

interface EventSplitActionBarProps {
  onScanReceipt: () => void;
  onEnterTotal: () => void;
}

/** Split CTAs shown after the group is locked (creator only). Render in AuthGradientLayout footer. */
export function EventSplitActionBar({ onScanReceipt, onEnterTotal }: EventSplitActionBarProps) {
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
});
