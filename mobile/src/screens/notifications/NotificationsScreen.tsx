import { useCallback } from 'react';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import { ThemedScreenLayout } from '../../components/layout/ThemedScreenLayout';
import { useAppInsets } from '../../hooks/useAppInsets';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useTheme } from '../../theme/ThemeContext';
import { navigateFromNotification } from '../../navigation/eventNavigation';
import { useNotificationStore } from '../../store/notificationStore';

type Props = {
  navigation: NavigationProp<ParamListBase>;
};

function formatWhen(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function NotificationsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const themed = useThemedStyles();
  const { screenScrollBottomPadding } = useAppInsets();
  const notifications = useNotificationStore((state) => state.notifications);
  const isLoadingList = useNotificationStore((state) => state.isLoadingList);
  const listError = useNotificationStore((state) => state.listError);
  const loadNotifications = useNotificationStore((state) => state.loadNotifications);
  const markRead = useNotificationStore((state) => state.markRead);

  useFocusEffect(
    useCallback(() => {
      void loadNotifications();
    }, [loadNotifications]),
  );

  const handlePress = async (
    notificationId: string,
    eventId: string | null,
    isRead: boolean,
  ) => {
    if (!isRead) {
      await markRead(notificationId);
    }
    if (eventId) {
      navigateFromNotification(navigation, eventId);
    }
  };

  return (
    <ThemedScreenLayout
      topBar={{
        title: 'Notifications',
        onBack: () => navigation.goBack(),
      }}
      scrollContentContainerStyle={{ paddingBottom: screenScrollBottomPadding }}
    >
      {isLoadingList ? (
        <ActivityIndicator color={theme.ink} style={styles.loader} />
      ) : listError ? (
        <Text style={themed.errorText}>{listError}</Text>
      ) : notifications.length === 0 ? (
        <Text style={[themed.emptyText, styles.empty]}>No notifications right now.</Text>
      ) : (
        notifications.map((row) => (
          <Pressable
            key={row.id}
            accessibilityRole="button"
            onPress={() => void handlePress(row.id, row.event_id, row.is_read)}
            style={[styles.row, !row.is_read && styles.rowUnread]}
          >
            <Text style={[styles.rowTitle, { color: theme.ink }]}>{row.title}</Text>
            <Text style={[styles.rowBody, { color: theme.ink2 }]}>{row.body}</Text>
            <Text style={[styles.rowWhen, { color: theme.ink3 }]}>{formatWhen(row.created_at)}</Text>
          </Pressable>
        ))
      )}
    </ThemedScreenLayout>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginTop: 24,
  },
  empty: {
    marginTop: 8,
  },
  row: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  rowUnread: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginHorizontal: -4,
    paddingHorizontal: 4,
    borderRadius: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  rowBody: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  rowWhen: {
    fontSize: 11,
    marginTop: 6,
  },
});
