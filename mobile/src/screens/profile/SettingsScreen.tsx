import { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { FadeSlideIn } from '../../components/auth/FadeSlideIn';
import {
  SettingRow,
  SettingSection,
  SettingToggle,
} from '../../components/settings/SettingRows';
import { useAppInsets } from '../../hooks/useAppInsets';
import type { SettingsStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useProfileStore } from '../../store/profileStore';
import { authColors } from '../../theme/colors';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const logout = useAuthStore((state) => state.logout);
  const storageMode = useAuthStore((state) => state.storageMode);
  const enrollBiometricStorage = useAuthStore((state) => state.enrollBiometricStorage);
  const skipBiometricStorage = useAuthStore((state) => state.skipBiometricStorage);
  const { user, loadProfile, updateNotificationPreferences } = useProfileStore();
  const { screenScrollBottomPadding } = useAppInsets();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const biometricEnabled = storageMode === 'biometric';
  const pushEnabled = user?.push_notifications_enabled ?? true;

  useEffect(() => {
    void loadProfile().catch(() => {
      // Profile may already be loaded from auth cache.
    });
  }, [loadProfile]);

  const handleBiometricToggle = async (enabled: boolean) => {
    if (biometricBusy) return;
    setBiometricBusy(true);
    try {
      if (enabled) {
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!enrolled) {
          Alert.alert(
            'Biometrics not set up',
            'Enable Face ID, Touch ID, or fingerprint in your device settings first.',
          );
          return;
        }
        const ok = await enrollBiometricStorage();
        if (!ok) {
          Alert.alert('Could not enable biometrics', 'Authentication was cancelled or failed.');
        }
      } else {
        await skipBiometricStorage();
      }
    } finally {
      setBiometricBusy(false);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      Alert.alert('Could not log out', 'Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <AuthGradientLayout contentStyle={styles.layout}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: screenScrollBottomPadding }]}
      >
        <FadeSlideIn delay={0}>
          <Text style={styles.title}>Settings</Text>
        </FadeSlideIn>

        <FadeSlideIn delay={60}>
          <SettingSection title="Account">
            <SettingRow
              label="Profile"
              subtitle="Name, avatar, and payment methods"
              showChevron
              onPress={() => navigation.navigate('Profile')}
            />
          </SettingSection>
        </FadeSlideIn>

        <FadeSlideIn delay={90}>
          <SettingSection title="Legal">
            <SettingRow
              label="Terms & Conditions"
              showChevron
              onPress={() => navigation.navigate('LegalDocument', { document: 'terms' })}
            />
            <SettingRow
              label="Privacy Policy"
              showChevron
              onPress={() => navigation.navigate('LegalDocument', { document: 'privacy' })}
            />
          </SettingSection>
        </FadeSlideIn>

        <FadeSlideIn delay={120}>
          <SettingSection title="Notifications">
            <SettingToggle
              label="Push notifications"
              subtitle="Allow all LetsSplyt notifications on this device"
              value={pushEnabled}
              onValueChange={(value) =>
                void updateNotificationPreferences({ push_notifications_enabled: value })
              }
            />
          </SettingSection>
        </FadeSlideIn>

        <FadeSlideIn delay={150}>
          <SettingSection title="Security">
            <SettingToggle
              label="Biometric sign-in"
              subtitle="Use Face ID or fingerprint to unlock the app"
              value={biometricEnabled}
              disabled={biometricBusy}
              onValueChange={(value) => void handleBiometricToggle(value)}
            />
          </SettingSection>
        </FadeSlideIn>

        <FadeSlideIn delay={180}>
          <Text style={styles.version}>Version {appVersion}</Text>
        </FadeSlideIn>

        <FadeSlideIn delay={210}>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={isLoggingOut}
              onPress={() => void handleLogout()}
              style={styles.logoutButton}
            >
              <Text style={styles.logoutText}>
                {isLoggingOut ? 'Logging out…' : 'Log out'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('DeleteWarn')}
              style={styles.deleteLink}
            >
              <Text style={styles.deleteText}>Delete account</Text>
            </Pressable>
          </View>
        </FadeSlideIn>
      </ScrollView>
    </AuthGradientLayout>
  );
}

const styles = StyleSheet.create({
  layout: {
    paddingHorizontal: 28,
  },
  scroll: {
    flexGrow: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: authColors.textOnDark,
    marginBottom: 20,
  },
  version: {
    fontSize: 12,
    color: authColors.textOnDarkFaint,
    textAlign: 'center',
    marginBottom: 20,
  },
  actions: {
    gap: 16,
    marginTop: 4,
  },
  logoutButton: {
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: authColors.glassBorder,
    alignItems: 'center',
    backgroundColor: authColors.glass,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: authColors.textOnDarkMuted,
  },
  deleteLink: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F87171',
  },
});
