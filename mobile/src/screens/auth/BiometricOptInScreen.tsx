import { useCallback, useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { FadeSlideIn } from '../../components/auth/FadeSlideIn';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

type Props = NativeStackScreenProps<RootStackParamList, 'BiometricOptIn'>;

function makeStyles(theme: Theme) {
  return StyleSheet.create({
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
      color: theme.ink3,
      marginBottom: 8,
      fontFamily: theme.fontBody,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: theme.ink,
      marginBottom: 12,
      letterSpacing: -0.5,
      fontFamily: theme.fontDisplay,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.ink2,
      marginBottom: 32,
      fontFamily: theme.fontBody,
    },
    iconCircle: {
      alignSelf: 'center',
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconGlyph: {
      fontSize: 36,
      color: theme.ink2,
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
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
  });
}

export function BiometricOptInScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
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
