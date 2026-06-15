import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePushToastStore } from '../store/pushToastStore';
import { colors } from '../theme/colors';

const DISMISS_MS = 4000;

export function Toast() {
  const insets = useSafeAreaInsets();
  const toast = usePushToastStore((state) => state.toast);
  const clearPushToast = usePushToastStore((state) => state.clearPushToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => clearPushToast(), DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast, clearPushToast]);

  if (!toast) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Dismiss notification"
      onPress={() => clearPushToast()}
      style={[styles.wrapper, { top: insets.top + 8 }]}
    >
      <View style={styles.toast}>
        <Text style={styles.title}>{toast.title}</Text>
        {toast.body ? <Text style={styles.body}>{toast.body}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
    elevation: 8,
  },
  toast: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
});
