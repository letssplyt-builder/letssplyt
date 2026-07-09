import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

interface CenteredCardModalProps {
  visible: boolean;
  onClose: () => void;
  dismissLabel?: string;
  children: ReactNode;
}

/** Theme-aware centered card over a dimmed backdrop. */
export function makeCenteredCardModalStyles(theme: Theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.68)',
    },
    card: {
      backgroundColor: theme.modalSurface,
      borderRadius: theme.radius,
      borderWidth: 1,
      borderColor: theme.line,
      padding: 20,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: theme.id === 'aurora' ? 0.28 : 0.4,
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
      color: theme.ink,
      marginBottom: 4,
      fontFamily: theme.fontDisplay,
    },
    titleAccent: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.accent,
      fontFamily: theme.fontDisplay,
    },
    closeBtn: {
      padding: 4,
    },
    closeIcon: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.ink3,
    },
    subtitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.ink,
      marginBottom: 4,
      fontFamily: theme.fontBody,
    },
    hint: {
      fontSize: 13,
      color: theme.ink2,
      marginBottom: 14,
      lineHeight: 18,
      fontFamily: theme.fontBody,
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
      borderRadius: theme.radiusSm,
      borderWidth: 1.5,
      borderColor: theme.line,
      backgroundColor: theme.modalInset,
    },
    optionRowSelected: {
      borderColor: theme.accent,
      backgroundColor: theme.accentSoft,
    },
    optionLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    optionLabelFlex: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    optionMeta: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.ink2,
      marginTop: 2,
      fontFamily: theme.fontBody,
    },
    check: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.line,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.modalInset,
    },
    checkSelected: {
      borderColor: theme.accent,
      backgroundColor: theme.accent,
    },
    checkMark: {
      color: theme.accentInk,
      fontSize: 14,
      fontWeight: '800',
    },
    okBtn: {
      height: 48,
      borderRadius: theme.radiusSm,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    okBtnDisabled: {
      opacity: 0.55,
    },
    okText: {
      color: theme.accentInk,
      fontSize: 17,
      fontWeight: '800',
      fontFamily: theme.fontBody,
    },
    empty: {
      fontSize: 14,
      color: theme.ink2,
      lineHeight: 20,
      marginBottom: 8,
      fontFamily: theme.fontBody,
    },
  });
}

export function CenteredCardModal({
  visible,
  onClose,
  dismissLabel = 'Close',
  children,
}: CenteredCardModalProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeCenteredCardModalStyles(theme), [theme]);

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
