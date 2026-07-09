import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

interface EventDetailOverflowMenuProps {
  showReopen?: boolean;
  reopenLoading?: boolean;
  onReopen?: () => void;
  showReset?: boolean;
  resetLoading?: boolean;
  onReset?: () => void;
  showDelete?: boolean;
  deleteLoading?: boolean;
  onDelete?: () => void;
}

function makeStyles(theme: Theme) {
  const iconRadius = theme.id === 'aurora' ? 20 : theme.radiusSm;

  return StyleSheet.create({
    placeholder: {
      minWidth: 40,
      minHeight: 40,
    },
    trigger: {
      minWidth: 40,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: iconRadius,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
    },
    triggerPressed: {
      backgroundColor: theme.surfaceStrong,
      transform: [{ scale: 0.96 }],
    },
    triggerIcon: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.ink2,
      lineHeight: 20,
      marginTop: -2,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.68)',
    },
    dropdown: {
      position: 'absolute',
      top: 56,
      right: 20,
      alignItems: 'flex-end',
    },
    menuCard: {
      minWidth: 220,
      backgroundColor: theme.modalSurface,
      borderRadius: theme.radiusSm,
      borderWidth: 1,
      borderColor: theme.line,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 8,
      overflow: 'hidden',
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    menuItemPressed: {
      backgroundColor: theme.modalInset,
    },
    menuLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    menuLabelDestructive: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.bad,
      fontFamily: theme.fontBody,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.line,
    },
  });
}

/** Compact ⋮ menu for infrequent payer actions on Event Detail. */
export function EventDetailOverflowMenu({
  showReopen,
  reopenLoading,
  onReopen,
  showReset,
  resetLoading,
  onReset,
  showDelete,
  deleteLoading,
  onDelete,
}: EventDetailOverflowMenuProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [open, setOpen] = useState(false);

  if (!showReopen && !showReset && !showDelete) {
    return <View style={styles.placeholder} />;
  }

  const close = () => setOpen(false);

  const handleReopen = () => {
    close();
    onReopen?.();
  };

  const handleReset = () => {
    close();
    onReset?.();
  };

  const handleDelete = () => {
    close();
    onDelete?.();
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="More options"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
      >
        <Text style={styles.triggerIcon}>⋮</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close menu" />
        <View style={styles.dropdown} pointerEvents="box-none">
          <View style={styles.menuCard}>
            {showReopen ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Reopen join window"
                disabled={reopenLoading}
                onPress={handleReopen}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && !reopenLoading && styles.menuItemPressed,
                ]}
              >
                <Text style={styles.menuLabel}>Reopen join window</Text>
                {reopenLoading ? (
                  <ActivityIndicator color={theme.ink3} size="small" />
                ) : null}
              </Pressable>
            ) : null}

            {showReopen && showReset ? <View style={styles.divider} /> : null}

            {showReset ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Reset expenses"
                disabled={resetLoading}
                onPress={handleReset}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && !resetLoading && styles.menuItemPressed,
                ]}
              >
                <Text style={styles.menuLabelDestructive}>Reset expenses</Text>
                {resetLoading ? (
                  <ActivityIndicator color={theme.bad} size="small" />
                ) : null}
              </Pressable>
            ) : null}

            {(showReset || showReopen) && showDelete ? <View style={styles.divider} /> : null}

            {showDelete ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete event"
                disabled={deleteLoading}
                onPress={handleDelete}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && !deleteLoading && styles.menuItemPressed,
                ]}
              >
                <Text style={styles.menuLabelDestructive}>Delete event</Text>
                {deleteLoading ? (
                  <ActivityIndicator color={theme.bad} size="small" />
                ) : null}
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}
