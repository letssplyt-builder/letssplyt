import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { keyboardSheetLift } from '../../constants/layout';
import { useAppInsets } from '../../hooks/useAppInsets';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** When true, sheet rises with the keyboard and keeps KEYBOARD_SHEET_GAP clearance. */
  keyboardAware?: boolean;
  dismissLabel?: string;
  sheetStyle?: StyleProp<ViewStyle>;
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.68)',
    },
    sheetWrap: {
      justifyContent: 'flex-end',
    },
    sheet: {
      borderTopLeftRadius: theme.radius,
      borderTopRightRadius: theme.radius,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.modalSurface,
      paddingHorizontal: 24,
      paddingTop: 10,
    },
  });
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
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
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
