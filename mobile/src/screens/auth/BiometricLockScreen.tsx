import { useCallback, useEffect, useRef, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { FadeSlideIn } from '../../components/auth/FadeSlideIn';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { authColors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'BiometricLock'>;

export function BiometricLockScreen({ navigation }: Props) {
  const unlockApp = useAuthStore((state) => state.unlockApp);
  const clearSession = useAuthStore((state) => state.clearSession);
  const user = useAuthStore((state) => state.user);
  const storageMode = useAuthStore((state) => state.storageMode);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const attemptedRef = useRef(false);

  const attemptUnlock = useCallback(async () => {
    if (isUnlocking) return;
    setIsUnlocking(true);
    try {
      const ok = await unlockApp();
      if (!ok) return;
    } finally {
      setIsUnlocking(false);
    }
  }, [isUnlocking, unlockApp]);

  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;
    void attemptUnlock();
  }, [attemptUnlock]);

  const handleUsePhone = async () => {
    await clearSession();
    navigation.replace('PhoneEntry', {});
  };

  const title =
    storageMode === 'biometric'
      ? 'Sign in with Face ID or fingerprint'
      : 'Unlock LetsSplyt';

  return (
    <AuthGradientLayout
      bottomSafeArea="system"
      contentStyle={styles.content}
      footer={
        <FadeSlideIn delay={100}>
          <View style={styles.footer}>
            <PrimaryButton
              accessibilityLabel="Unlock LetsSplyt"
              label={isUnlocking ? 'Unlocking…' : 'Unlock'}
              variant="inverse"
              loading={isUnlocking}
              onPress={() => void attemptUnlock()}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign in with phone number"
              onPress={() => void handleUsePhone()}
              style={styles.altWrap}
            >
              <Text style={styles.altText}>Use phone number</Text>
            </Pressable>
          </View>
        </FadeSlideIn>
      }
    >
      <FadeSlideIn delay={0}>
        {isUnlocking ? (
          <ActivityIndicator color={authColors.textOnDark} size="large" style={styles.spinner} />
        ) : (
          <View style={styles.iconCircle}>
            <Text style={styles.iconGlyph}>◎</Text>
          </View>
        )}
        <Text style={styles.title}>{title}</Text>
        {user?.display_name ? (
          <Text style={styles.subtitle}>Welcome back, {user.display_name}</Text>
        ) : (
          <Text style={styles.subtitle}>Confirm to continue</Text>
        )}
      </FadeSlideIn>
    </AuthGradientLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 24,
  },
  spinner: {
    marginBottom: 24,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: authColors.glass,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconGlyph: {
    fontSize: 36,
    color: authColors.textOnDarkMuted,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: authColors.textOnDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: authColors.textOnDarkMuted,
    textAlign: 'center',
  },
  footer: {
    gap: 12,
  },
  altWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  altText: {
    fontSize: 15,
    fontWeight: '600',
    color: authColors.textOnDarkMuted,
  },
});
