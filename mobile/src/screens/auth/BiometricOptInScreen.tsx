import { useCallback, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { FadeSlideIn } from '../../components/auth/FadeSlideIn';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { authColors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'BiometricOptIn'>;

export function BiometricOptInScreen({ navigation }: Props) {
  const enrollBiometricStorage = useAuthStore((state) => state.enrollBiometricStorage);
  const skipBiometricStorage = useAuthStore((state) => state.skipBiometricStorage);
  const needsPushPermission = useAuthStore((state) => state.needsPushPermission);
  const [isEnabling, setIsEnabling] = useState(false);

  const goNext = useCallback(() => {
    if (needsPushPermission) {
      navigation.replace('PushPermission');
      return;
    }
    navigation.replace('MainTabs');
  }, [navigation, needsPushPermission]);

  const handleEnable = async () => {
    if (isEnabling) return;
    setIsEnabling(true);
    try {
      const ok = await enrollBiometricStorage();
      if (!ok) return;
      goNext();
    } finally {
      setIsEnabling(false);
    }
  };

  const handleSkip = async () => {
    await skipBiometricStorage();
    goNext();
  };

  return (
    <AuthGradientLayout
      bottomSafeArea="system"
      contentStyle={styles.content}
      footer={
        <FadeSlideIn delay={120}>
          <View style={styles.footer}>
            <PrimaryButton
              accessibilityLabel="Enable Face ID or fingerprint"
              label="Enable"
              variant="inverse"
              loading={isEnabling}
              onPress={() => void handleEnable()}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip biometric login"
              onPress={() => void handleSkip()}
              style={styles.skipWrap}
            >
              <Text style={styles.skipText}>Not now</Text>
            </Pressable>
          </View>
        </FadeSlideIn>
      }
    >
      <FadeSlideIn delay={0}>
        <Text style={styles.eyebrow}>Quick sign-in</Text>
        <Text style={styles.title}>Use Face ID or fingerprint next time?</Text>
        <Text style={styles.subtitle}>
          Sign in faster without entering a code. You can still use your phone number anytime.
        </Text>
      </FadeSlideIn>
      <View style={styles.iconCircle}>
        <Text style={styles.iconGlyph}>◎</Text>
      </View>
    </AuthGradientLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 24,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: authColors.textOnDarkFaint,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: authColors.textOnDark,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: authColors.textOnDarkMuted,
    marginBottom: 32,
  },
  iconCircle: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: authColors.glass,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    fontSize: 36,
    color: authColors.textOnDarkMuted,
  },
  footer: {
    gap: 12,
  },
  skipWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: authColors.textOnDarkMuted,
  },
});
