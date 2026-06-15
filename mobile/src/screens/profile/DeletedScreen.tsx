import { useEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { FadeSlideIn } from '../../components/auth/FadeSlideIn';
import type { SettingsStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useProfileStore } from '../../store/profileStore';
import { authColors } from '../../theme/colors';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Deleted'>;

const REDIRECT_DELAY_MS = 3000;

export function DeletedScreen(_props: Props) {
  const clearSession = useAuthStore((state) => state.clearSession);

  useEffect(() => {
    const timer = setTimeout(() => {
      useProfileStore.setState({ user: null, handles: [] });
      void clearSession();
    }, REDIRECT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [clearSession]);

  return (
    <AuthGradientLayout contentStyle={styles.content}>
      <FadeSlideIn delay={0}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconGlyph}>✓</Text>
        </View>
        <Text style={styles.title}>Account deleted</Text>
        <Text style={styles.subtitle}>
          Your account and personal data have been removed. You&apos;ll return to the welcome screen
          shortly.
        </Text>
      </FadeSlideIn>
    </AuthGradientLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: authColors.glass,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  iconGlyph: {
    fontSize: 32,
    color: authColors.textOnDark,
    fontWeight: '700',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: authColors.textOnDark,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: authColors.textOnDarkMuted,
    textAlign: 'center',
  },
});
