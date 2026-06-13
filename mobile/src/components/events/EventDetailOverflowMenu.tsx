import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { authColors } from '../../theme/colors';

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
                  <ActivityIndicator color={authColors.textOnDarkMuted} size="small" />
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
                  <ActivityIndicator color={authColors.errorOnDark} size="small" />
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
                  <ActivityIndicator color={authColors.errorOnDark} size="small" />
                ) : null}
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    minWidth: 36,
    minHeight: 36,
  },
  trigger: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: authColors.glass,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
  },
  triggerPressed: {
    backgroundColor: authColors.glassStrong,
  },
  triggerIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: authColors.textOnDarkMuted,
    lineHeight: 20,
    marginTop: -2,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 61, 69, 0.35)',
  },
  dropdown: {
    position: 'absolute',
    top: 56,
    right: 20,
    alignItems: 'flex-end',
  },
  menuCard: {
    minWidth: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(11, 61, 69, 0.08)',
    shadowColor: '#0B3D45',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
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
    backgroundColor: '#F8F7FF',
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E1B3A',
  },
  menuLabelDestructive: {
    fontSize: 15,
    fontWeight: '600',
    color: '#DC2626',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E0DDFF',
  },
});
