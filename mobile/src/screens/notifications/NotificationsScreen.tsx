import { useCallback } from 'react';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { useAppInsets } from '../../hooks/useAppInsets';
import { navigateFromNotification } from '../../navigation/eventNavigation';
import { useNotificationStore } from '../../store/notificationStore';
import { glassStyles } from '../../theme/glassStyles';
import { authColors } from '../../theme/colors';

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
    <AuthGradientLayout contentStyle={styles.layout}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: screenScrollBottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isLoadingList ? (
          <ActivityIndicator color={authColors.textOnDark} style={styles.loader} />
        ) : listError ? (
          <Text style={glassStyles.errorText}>{listError}</Text>
        ) : notifications.length === 0 ? (
          <Text style={styles.empty}>No notifications right now.</Text>
        ) : (
          notifications.map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              onPress={() => void handlePress(row.id, row.event_id, row.is_read)}
              style={[styles.card, !row.is_read && styles.cardUnread]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{row.title}</Text>
                {!row.is_read ? <View style={styles.unreadDot} /> : null}
              </View>
              <Text style={styles.cardBody}>{row.body}</Text>
              <Text style={styles.cardMeta}>{formatWhen(row.created_at)}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </AuthGradientLayout>
  );
}

const styles = StyleSheet.create({
  layout: {
    paddingHorizontal: 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    minWidth: 56,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: authColors.textOnDarkMuted,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: authColors.textOnDark,
  },
  topBarSpacer: {
    minWidth: 56,
  },
  content: {
    paddingHorizontal: 28,
    gap: 12,
  },
  loader: {
    marginTop: 24,
  },
  empty: {
    fontSize: 15,
    lineHeight: 22,
    color: authColors.textOnDarkMuted,
    textAlign: 'center',
    marginTop: 24,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardUnread: {
    borderColor: 'rgba(255, 255, 255, 0.28)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: authColors.textOnDark,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginLeft: 8,
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
    color: authColors.textOnDarkMuted,
    marginBottom: 8,
  },
  cardMeta: {
    fontSize: 12,
    color: authColors.textOnDarkFaint,
  },
});
