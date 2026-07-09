import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePushToastStore } from '../store/pushToastStore';
import { useTheme } from '../theme/ThemeContext';
import type { Theme } from '../theme/types';

const DISMISS_MS = 4000;

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    wrapper: {
      position: 'absolute',
      left: 16,
      right: 16,
      zIndex: 1000,
      elevation: 8,
    },
    toast: {
      backgroundColor: theme.modalSurface,
      borderRadius: theme.radiusSm,
      borderWidth: 1,
      borderColor: theme.line,
      paddingHorizontal: 16,
      paddingVertical: 12,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 8,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.ink,
      marginBottom: 2,
      fontFamily: theme.fontBody,
    },
    body: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
  });
}

export function Toast() {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
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
