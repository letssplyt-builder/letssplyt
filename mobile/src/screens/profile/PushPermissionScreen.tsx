import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { RootStackParamList } from '../../navigation/types';
import { registerPushToken } from '../../services/profile.service';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'PushPermission'>;

function resolveDeviceId(): string {
  return Device.modelId ?? Device.osBuildId ?? `${Platform.OS}-device`;
}

export function PushPermissionScreen({ navigation }: Props) {
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
        const tokenResult = await Notifications.getExpoPushTokenAsync();
        await registerPushToken({
          device_id: resolveDeviceId(),
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
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
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 32,
    maxWidth: 320,
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
    color: colors.textMuted,
  },
});
