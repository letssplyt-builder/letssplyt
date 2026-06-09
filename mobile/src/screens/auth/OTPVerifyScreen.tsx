import { useCallback, useEffect, useRef, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import type { AuthSession } from '@letssplyt/shared/auth.types';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { FadeSlideIn } from '../../components/auth/FadeSlideIn';
import { OtpDigitBox } from '../../components/auth/OtpDigitBox';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { RootStackParamList } from '../../navigation/types';
import { apiPost, getApiErrorCode, isApiRequestError } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useJoinStore } from '../../store/joinStore';
import { authColors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'OTPVerify'>;

const RESEND_COOLDOWN_SECONDS = 30;
const OTP_LENGTH = 6;

function maskPhoneLastFour(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, '');
  if (digits.length < 4) return phoneE164;
  return `•••• ${digits.slice(-4)}`;
}

export function OTPVerifyScreen({ navigation, route }: Props) {
  const { phoneE164, accountExists = false, joinToken } = route.params;
  const isExistingAccount = accountExists;
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(RESEND_COOLDOWN_SECONDS);
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const isLoading = useAuthStore((state) => state.isLoading);
  const setLoading = useAuthStore((state) => state.setLoading);
  const applyAuthResponse = useAuthStore((state) => state.applyAuthResponse);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setInterval(() => {
      setResendSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  const clearDigits = useCallback(() => {
    setDigits(Array(OTP_LENGTH).fill(''));
    inputRefs.current[0]?.focus();
  }, []);

  const handleVerify = useCallback(
    async (codeOverride?: string) => {
      const code = codeOverride ?? digits.join('');
      if (code.length !== OTP_LENGTH) return;

      setError(null);
      setLoading(true);
      try {
        const body: Record<string, string> = {
          phone_e164: phoneE164,
          code,
          context: 'register',
        };
        if (!isExistingAccount && displayName.trim()) {
          body.display_name = displayName.trim();
        }

        const result = await apiPost<AuthSession>('/auth/otp/verify', body);
        if (joinToken) {
          useJoinStore.getState().setPendingJoinToken(joinToken);
        }
        await applyAuthResponse(result);
      } catch (err) {
        clearDigits();
        const code = getApiErrorCode(err);
        if (code === 'INVALID_CODE') {
          setError('Incorrect code. Try again.');
        } else if (code === 'CODE_EXPIRED') {
          setError('That code has expired. Tap Resend to get a new one.');
        } else if (code === 'NAME_REQUIRED') {
          setError('Enter your name to create an account.');
        } else if (code === 'ACCOUNT_NOT_FOUND') {
          setError('No account found. Check number and try again.');
        } else if (isApiRequestError(err)) {
          setError(err.message);
        } else {
          setError('Incorrect code. Try again.');
        }
      } finally {
        setLoading(false);
      }
    },
    [
      applyAuthResponse,
      clearDigits,
      digits,
      displayName,
      isExistingAccount,
      phoneE164,
      setLoading,
    ],
  );

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError(null);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (digit && index === OTP_LENGTH - 1 && next.every((d) => d.length === 1)) {
      void handleVerify(next.join(''));
    }
  };

  const handleKeyPress = (
    index: number,
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) => {
    if (event.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (resendSeconds > 0) return;
    setError(null);
    setLoading(true);
    try {
      await apiPost('/auth/otp/request', {
        phone_e164: phoneE164,
        context: 'register',
      });
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
      clearDigits();
    } catch (err) {
      if (isApiRequestError(err)) {
        setError(err.message);
      } else {
        setError("Couldn't resend code. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const codeComplete = digits.every((d) => d.length === 1);

  return (
    <AuthGradientLayout
      contentStyle={styles.content}
      footer={
        <FadeSlideIn delay={200}>
          <View style={styles.footer}>
          <PrimaryButton
            accessibilityLabel="Verify code"
            label="Verify"
            variant="inverse"
            loading={isLoading}
            disabled={!codeComplete}
            onPress={() => void handleVerify()}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Sends a new verification code to your phone"
            disabled={resendSeconds > 0 || isLoading}
            onPress={() => void handleResend()}
            style={styles.resendWrap}
          >
            <Text style={styles.resendText}>
              Didn&apos;t get it?{' '}
              {resendSeconds > 0 ? (
                <Text style={styles.resendMuted}>Resend in {resendSeconds}s</Text>
              ) : (
                <Text style={styles.resendActive}>Resend code</Text>
              )}
            </Text>
          </Pressable>
          </View>
        </FadeSlideIn>
      }
    >
      <FadeSlideIn delay={0} distance={8}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() =>
          navigation.navigate('PhoneEntry', { initialPhone: phoneE164 })
        }
        style={styles.backButton}
      >
        <Text style={styles.backText}>‹ Back</Text>
      </Pressable>
      </FadeSlideIn>

      <View style={styles.centerStage}>
        <FadeSlideIn delay={40}>
          <Text style={styles.eyebrow}>Verification</Text>
          <Text style={styles.title}>Enter your code</Text>
          <Text style={styles.subtitle}>
            Sent to{' '}
            <Text style={styles.phoneHighlight}>{maskPhoneLastFour(phoneE164)}</Text>
          </Text>
        </FadeSlideIn>

        {accountExists ? (
          <FadeSlideIn delay={100} style={styles.infoWrap}>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                You&apos;re already registered — just enter the code to sign in.
              </Text>
            </View>
          </FadeSlideIn>
        ) : null}

        {!isExistingAccount ? (
          <FadeSlideIn delay={100} style={styles.nameWrap}>
            <TextInput
              accessibilityLabel="Your name"
              accessibilityHint="Required only when creating a new account"
              placeholder="Your name"
              placeholderTextColor={authColors.textOnDarkFaint}
              value={displayName}
              onChangeText={setDisplayName}
              style={styles.nameInput}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </FadeSlideIn>
        ) : null}

        <View style={styles.digitRow}>
          {digits.map((digit, index) => (
            <OtpDigitBox
              key={index}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              index={index}
              filled={digit.length === 1}
              accessibilityLabel={`Digit ${index + 1}`}
              keyboardType="number-pad"
              maxLength={1}
              value={digit}
              onChangeText={(value) => handleDigitChange(index, value)}
              onKeyPress={(event) => handleKeyPress(index, event)}
              selectTextOnFocus
            />
          ))}
        </View>

        {error ? (
          <FadeSlideIn delay={0} style={styles.feedbackWrap}>
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </FadeSlideIn>
        ) : (
          <FadeSlideIn delay={320}>
            <Text style={styles.hint}>6-digit code from your text message</Text>
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
  backButton: {
    paddingTop: 4,
    paddingBottom: 8,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 17,
    color: authColors.textOnDark,
    fontWeight: '600',
  },
  centerStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 16,
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
    fontSize: 32,
    fontWeight: '800',
    color: authColors.textOnDark,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: authColors.textOnDarkMuted,
    marginBottom: 28,
    textAlign: 'center',
  },
  phoneHighlight: {
    color: authColors.textOnDark,
    fontWeight: '700',
  },
  nameWrap: {
    width: '100%',
    maxWidth: 340,
    marginBottom: 22,
  },
  nameInput: {
    width: '100%',
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    backgroundColor: authColors.glass,
    paddingHorizontal: 18,
    fontSize: 17,
    color: authColors.textOnDark,
  },
  infoWrap: {
    width: '100%',
    maxWidth: 340,
    marginBottom: 20,
  },
  digitRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  feedbackWrap: {
    width: '100%',
    maxWidth: 340,
  },
  errorBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: authColors.errorBgOnDark,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(252, 165, 165, 0.25)',
  },
  errorText: {
    color: authColors.errorOnDark,
    fontSize: 14,
    textAlign: 'center',
  },
  hint: {
    fontSize: 13,
    color: authColors.textOnDarkFaint,
    textAlign: 'center',
  },
  footer: {
    gap: 12,
  },
  resendWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  resendText: {
    fontSize: 14,
    color: authColors.textOnDarkMuted,
  },
  resendMuted: {
    color: authColors.textOnDarkFaint,
    fontWeight: '600',
  },
  resendActive: {
    color: authColors.textOnDark,
    fontWeight: '700',
  },
  infoBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: authColors.infoBgOnDark,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
  },
  infoText: {
    color: authColors.infoOnDark,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
});
