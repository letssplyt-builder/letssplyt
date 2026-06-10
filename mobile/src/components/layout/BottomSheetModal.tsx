import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { keyboardSheetLift } from '../../constants/layout';
import { useAppInsets } from '../../hooks/useAppInsets';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** When true, sheet rises with the keyboard and keeps KEYBOARD_SHEET_GAP clearance. */
  keyboardAware?: boolean;
  dismissLabel?: string;
  sheetStyle?: StyleProp<ViewStyle>;
}

/**
 * Full-screen modal with dimmed backdrop and bottom-anchored sheet.
 * Uses shared inset + keyboard lift so sheets stay above system nav and keyboard.
 */
export function BottomSheetModal({
  visible,
  onClose,
  children,
  keyboardAware = false,
  dismissLabel = 'Dismiss',
  sheetStyle,
}: BottomSheetModalProps) {
  const { bottom, rawBottom } = useAppInsets();
  const keyboardHeight = useKeyboardHeight(visible && keyboardAware);
  const sheetLift = keyboardAware ? keyboardSheetLift(keyboardHeight, rawBottom) : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel={dismissLabel}
        />
        <View style={[styles.sheetWrap, { marginBottom: sheetLift }]}>
          <View style={[styles.sheet, { paddingBottom: Math.max(bottom, 12) }, sheetStyle]}>
            {children}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 61, 69, 0.55)',
  },
  sheetWrap: {
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 24,
    paddingTop: 10,
  },
});
