import { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import type { OtpRequestResponse } from '@letssplyt/shared/auth.types';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { FadeSlideIn } from '../../components/auth/FadeSlideIn';
import { RegionPhoneField } from '../../components/auth/RegionPhoneField';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { RootStackParamList } from '../../navigation/types';
import { apiPost, isApiRequestError } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useJoinStore } from '../../store/joinStore';
import { authColors } from '../../theme/colors';
import {
  DEFAULT_AUTH_REGION,
  formatUsNationalDisplay,
  isValidNationalNumber,
  nationalFromE164,
  toE164FromNational,
} from '../../utils/phone';

type Props = NativeStackScreenProps<RootStackParamList, 'PhoneEntry'>;

export function PhoneEntryScreen({ navigation, route }: Props) {
  const initialPhone = route.params?.initialPhone ?? '';
  const joinToken = route.params?.joinToken;
  const [phoneValue, setPhoneValue] = useState(() =>
    formatUsNationalDisplay(nationalFromE164(initialPhone)),
  );
  const [error, setError] = useState<string | null>(null);
  const isLoading = useAuthStore((state) => state.isLoading);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    if (route.params?.initialPhone) {
      setPhoneValue(formatUsNationalDisplay(nationalFromE164(route.params.initialPhone)));
    }
  }, [route.params?.initialPhone]);

  useEffect(() => {
    if (joinToken) {
      useJoinStore.getState().setPendingJoinToken(joinToken);
    }
  }, [joinToken]);

  const handleSendCode = async () => {
    setError(null);

    if (!isValidNationalNumber(phoneValue, DEFAULT_AUTH_REGION)) {
      setError("Couldn't send code. Check your number and try again.");
      return;
    }

    const phoneE164 = toE164FromNational(phoneValue, DEFAULT_AUTH_REGION);
    if (!phoneE164) {
      setError("Couldn't send code. Check your number and try again.");
      return;
    }

    setLoading(true);
    try {
      const result = await apiPost<OtpRequestResponse>('/auth/otp/request', {
        phone_e164: phoneE164,
        context: 'register',
      });
      if (result.sent !== true) {
        setError("Couldn't send code. Check your number and try again.");
        return;
      }
      navigation.navigate('OTPVerify', {
        phoneE164,
        accountExists: result.account_exists === true,
        joinToken,
      });
    } catch (err) {
      if (isApiRequestError(err)) {
        setError(err.message);
      } else {
        setError("Couldn't send code. Check your number and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGradientLayout
      bottomSafeArea="system"
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
      <View style={styles.centerStage}>
        <FadeSlideIn delay={60}>
          <Text style={styles.title}>Enter your{'\n'}phone number</Text>
        </FadeSlideIn>
        <FadeSlideIn delay={120} style={styles.subtitleWrap}>
          <Text style={styles.subtitle}>
            We&apos;ll text you a{'\n'}one-time code.
          </Text>
        </FadeSlideIn>

        <FadeSlideIn delay={180} style={styles.phoneBlock}>
          <RegionPhoneField
            region={DEFAULT_AUTH_REGION}
            value={phoneValue}
            onChangeText={setPhoneValue}
          />
        </FadeSlideIn>

        {error ? (
          <FadeSlideIn delay={0} style={styles.feedbackWrap}>
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
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
  centerStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    width: '100%',
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
    alignSelf: 'center',
  },
  subtitleWrap: {
    width: '100%',
    alignSelf: 'stretch',
    marginBottom: 32,
  },
  subtitle: {
    width: '100%',
    fontSize: 15,
    color: authColors.textOnDarkMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  phoneBlock: {
    width: '100%',
    maxWidth: 300,
    alignSelf: 'center',
  },
  feedbackWrap: {
    width: '100%',
    maxWidth: 300,
    alignSelf: 'center',
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
  footer: {
    gap: 12,
  },
  legal: {
    textAlign: 'center',
    fontSize: 11,
    color: authColors.textOnDarkFaint,
  },
});
