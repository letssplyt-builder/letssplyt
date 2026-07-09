import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationStore } from '../../store/notificationStore';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

interface NotificationBellButtonProps {
  onPress: () => void;
}

function makeStyles(theme: Theme) {
  const iconRadius = theme.id === 'aurora' ? 20 : theme.radiusSm;

  return StyleSheet.create({
    button: {
      width: 40,
      height: 40,
      borderRadius: iconRadius,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonPressed: {
      backgroundColor: theme.surfaceStrong,
      transform: [{ scale: 0.96 }],
    },
    icon: {
      marginTop: 1,
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: theme.bad,
      borderWidth: 1.5,
      borderColor: theme.headerBar,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    badgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: theme.ink,
      lineHeight: 11,
    },
  });
}

export function NotificationBellButton({ onPress }: NotificationBellButtonProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const unreadCount = useNotificationStore((state) => state.unreadCount);

  const badgeLabel =
    unreadCount > 99 ? '99+' : unreadCount > 0 ? String(unreadCount) : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        unreadCount > 0
          ? `Notifications, ${unreadCount} unread`
          : 'Notifications'
      }
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <Ionicons
        name="notifications-outline"
        size={19}
        color={theme.ink}
        style={styles.icon}
      />
      {badgeLabel ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
