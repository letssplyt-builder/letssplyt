import { useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { RootStackParamList } from '../../navigation/types';
import { getDeviceId } from '../../services/deviceId';
import { registerPushToken } from '../../services/profile.service';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PushPermission'>;

function resolveProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    content: {
      flex: 1,
      padding: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: {
      fontSize: 56,
      marginBottom: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: theme.ink,
      marginBottom: 12,
      textAlign: 'center',
      fontFamily: theme.fontDisplay,
    },
    body: {
      fontSize: 16,
      lineHeight: 24,
      color: theme.ink2,
      textAlign: 'center',
      marginBottom: 32,
      maxWidth: 320,
      fontFamily: theme.fontBody,
    },
    allowButton: {
      alignSelf: 'stretch',
      marginBottom: 16,
    },
    skipButton: {
      paddingVertical: 12,
    },
    skipText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
  });
}

export function PushPermissionScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const dismissPushPermission = useAuthStore((state) => state.dismissPushPermission);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const goHome = () => {
    dismissPushPermission();
    navigation.replace('MainTabs');
  };

  const handleAllow = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      const { status } =
        existing === 'granted'
          ? { status: existing }
          : await Notifications.requestPermissionsAsync();

      if (status === 'granted') {
        const projectId = resolveProjectId();
        const tokenResult = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        const deviceId = await getDeviceId();
        await registerPushToken({
          device_id: deviceId,
          token: tokenResult.data,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
        });
      }
    } catch {
      // User denied or token unavailable — still proceed to Home.
    } finally {
      setIsSubmitting(false);
      goHome();
    }
  };

  return (
    <AuthGradientLayout contentStyle={styles.content}>
      <Text style={styles.icon}>🔔</Text>
      <Text style={styles.title}>Stay in the loop</Text>
      <Text style={styles.body}>
        Enable notifications to get payment reminders and confirmations
      </Text>

      <PrimaryButton
        label={isSubmitting ? 'Setting up…' : 'Allow'}
        onPress={() => void handleAllow()}
        disabled={isSubmitting}
        style={styles.allowButton}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Not now"
        onPress={goHome}
        style={styles.skipButton}
      >
        <Text style={styles.skipText}>Not now</Text>
      </Pressable>
    </AuthGradientLayout>
  );
}
