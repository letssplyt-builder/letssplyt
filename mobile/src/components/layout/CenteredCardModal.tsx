import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../../theme/colors';

interface CenteredCardModalProps {
  visible: boolean;
  onClose: () => void;
  dismissLabel?: string;
  children: ReactNode;
}

/**
 * Centered white card over a dimmed backdrop — same shell as ItemAssignPopup (Fair Play).
 */
export function CenteredCardModal({
  visible,
  onClose,
  dismissLabel = 'Close',
  children,
}: CenteredCardModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          onPress={onClose}
        />
        <View style={styles.card}>{children}</View>
      </View>
    </Modal>
  );
}

export const centeredCardModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 61, 69, 0.55)',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#0B3D45',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  titleAccent: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  closeBtn: {
    padding: 4,
  },
  closeIcon: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textMuted,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 14,
    lineHeight: 18,
  },
  optionList: {
    gap: 8,
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  optionRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  optionLabelFlex: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  optionMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  okBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okBtnDisabled: {
    opacity: 0.55,
  },
  okText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  empty: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 8,
  },
});

const styles = centeredCardModalStyles;
