import { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { OtpRequestResponse } from '@letssplyt/shared/auth.types';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { FadeSlideIn } from '../../components/auth/FadeSlideIn';
import { RegionPhoneField } from '../../components/auth/RegionPhoneField';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { RootStackParamList } from '../../navigation/types';
import { apiPost, getApiErrorCode, isApiRequestError } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { authColors } from '../../theme/colors';
import {
  DEFAULT_AUTH_REGION,
  isValidNationalNumber,
  nationalFromE164,
  toE164FromNational,
} from '../../utils/phone';

type Props = NativeStackScreenProps<RootStackParamList, 'PhoneEntry'>;

export function PhoneEntryScreen({ navigation, route }: Props) {
  const initialPhone = route.params.initialPhone ?? '';
  const [phoneValue, setPhoneValue] = useState(() => nationalFromE164(initialPhone));
  const [error, setError] = useState<string | null>(null);
  const [showRegisterCta, setShowRegisterCta] = useState(false);
  const [lastPhoneE164, setLastPhoneE164] = useState<string | null>(null);
  const isLoading = useAuthStore((state) => state.isLoading);
  const setLoading = useAuthStore((state) => state.setLoading);
  const mode = route.params.mode;

  useEffect(() => {
    if (route.params.initialPhone) {
      setPhoneValue(nationalFromE164(route.params.initialPhone));
    }
  }, [route.params.initialPhone, route.params.mode]);

  const handleSendCode = async () => {
    setError(null);
    setShowRegisterCta(false);

    if (!isValidNationalNumber(phoneValue, DEFAULT_AUTH_REGION)) {
      setError("Couldn't send code. Check your number and try again.");
      return;
    }

    const phoneE164 = toE164FromNational(phoneValue, DEFAULT_AUTH_REGION);
    if (!phoneE164) {
      setError("Couldn't send code. Check your number and try again.");
      return;
    }

    setLastPhoneE164(phoneE164);
    setLoading(true);
    try {
      const result = await apiPost<OtpRequestResponse>('/auth/otp/request', {
        phone_e164: phoneE164,
        context: mode === 'login' ? 'login' : 'register',
      });
      if (result.sent !== true) {
        setError("Couldn't send code. Check your number and try again.");
        return;
      }
      navigation.navigate('OTPVerify', {
        phoneE164,
        mode,
        accountExists: result.account_exists === true,
      });
    } catch (err) {
      const code = getApiErrorCode(err);
      const isAccountMissing =
        mode === 'login' &&
        (code === 'ACCOUNT_NOT_FOUND' || (isApiRequestError(err) && err.status === 404));

      if (isAccountMissing) {
        setError('No account found. Check number and try again.');
        setShowRegisterCta(true);
      } else if (isApiRequestError(err)) {
        setError(err.message);
      } else {
        setError("Couldn't send code. Check your number and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = () => {
    navigation.navigate('PhoneEntry', {
      mode: 'register',
      initialPhone: lastPhoneE164 ?? undefined,
    });
    setShowRegisterCta(false);
    setError(null);
  };

  return (
    <AuthGradientLayout
      contentStyle={styles.content}
      footer={
        <FadeSlideIn delay={220}>
          <View style={styles.footer}>
            <PrimaryButton
              accessibilityRole="button"
              label="Send Code"
              variant="inverse"
              loading={isLoading}
              onPress={() => void handleSendCode()}
            />
            <Text style={styles.legal}>By continuing you agree to our Terms & Privacy</Text>
          </View>
        </FadeSlideIn>
      }
    >
      <FadeSlideIn delay={0} distance={10}>
        <View style={styles.topRow}>
          <View style={styles.modePill}>
            <Text style={styles.modePillText}>
              {mode === 'login' ? 'Welcome back' : 'New account'}
            </Text>
          </View>
        </View>
      </FadeSlideIn>

      <View style={styles.centerStage}>
        <FadeSlideIn delay={60}>
          <Text style={styles.title}>
            {mode === 'login' ? "What's your\nnumber?" : "Your phone\nnumber"}
          </Text>
        </FadeSlideIn>
        <FadeSlideIn delay={120}>
          <Text style={styles.subtitle}>We&apos;ll text you a one-time code.</Text>
        </FadeSlideIn>

        <FadeSlideIn delay={180} style={styles.phoneBlock}>
          <RegionPhoneField
            region={DEFAULT_AUTH_REGION}
            value={phoneValue}
            onChangeText={(text) => {
              setPhoneValue(text);
              setShowRegisterCta(false);
            }}
          />
        </FadeSlideIn>

        {error ? (
          <FadeSlideIn delay={0} style={styles.feedbackWrap}>
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              {showRegisterCta ? (
                <View style={styles.registerCta}>
                  <Text style={styles.registerHint}>New here?</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Register a new account"
                    onPress={handleRegister}
                    style={styles.registerButton}
                  >
                    <Text style={styles.registerButtonText}>Create an account</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </FadeSlideIn>
        ) : (
          <FadeSlideIn delay={240}>
            <Text style={styles.hint}>US & Canadian numbers (+1)</Text>
          </FadeSlideIn>
        )}
      </View>
    </AuthGradientLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  topRow: {
    paddingTop: 8,
    marginBottom: 8,
  },
  modePill: {
    alignSelf: 'flex-start',
    backgroundColor: authColors.pillOnDark,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
  },
  modePillText: {
    color: authColors.textOnDarkMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  centerStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: authColors.textOnDark,
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: -0.6,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: authColors.textOnDarkMuted,
    textAlign: 'center',
    marginBottom: 36,
  },
  phoneBlock: {
    width: '100%',
    maxWidth: 360,
  },
  feedbackWrap: {
    width: '100%',
    maxWidth: 360,
    marginTop: 20,
  },
  hint: {
    marginTop: 20,
    fontSize: 13,
    color: authColors.textOnDarkFaint,
    textAlign: 'center',
  },
  errorBox: {
    width: '100%',
    backgroundColor: authColors.errorBgOnDark,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(252, 165, 165, 0.25)',
  },
  errorText: {
    color: authColors.errorOnDark,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  registerCta: {
    marginTop: 14,
    alignItems: 'center',
    gap: 8,
  },
  registerHint: {
    fontSize: 13,
    color: authColors.textOnDarkMuted,
  },
  registerButton: {
    backgroundColor: authColors.ctaSurface,
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  registerButtonText: {
    color: authColors.ctaText,
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    gap: 12,
  },
  legal: {
    textAlign: 'center',
    fontSize: 11,
    color: authColors.textOnDarkFaint,
  },
});
