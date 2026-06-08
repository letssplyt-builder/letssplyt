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
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthSession } from '@letssplyt/shared/auth.types';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { RootStackParamList } from '../../navigation/types';
import { apiPost, getApiErrorCode, isApiRequestError } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'OTPVerify'>;

const RESEND_COOLDOWN_SECONDS = 30;
const OTP_LENGTH = 6;

function maskPhoneLastFour(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, '');
  if (digits.length < 4) return phoneE164;
  return `•••• ${digits.slice(-4)}`;
}

export function OTPVerifyScreen({ navigation, route }: Props) {
  const { phoneE164, mode, accountExists = false } = route.params;
  const isExistingAccount = accountExists || mode === 'login';
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
          context: mode === 'login' ? 'login' : 'register',
        };
        if (mode === 'register' && displayName.trim()) {
          body.display_name = displayName.trim();
        }

        const result = await apiPost<AuthSession>('/auth/otp/verify', body);
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
      mode,
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
        context: mode === 'login' ? 'login' : 'register',
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() =>
            navigation.navigate('PhoneEntry', { mode, initialPhone: phoneE164 })
          }
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>📱</Text>
          </View>
          <Text style={styles.title}>Check your texts</Text>
          <Text style={styles.subtitle}>
            Sent to <Text style={styles.phoneHighlight}>{maskPhoneLastFour(phoneE164)}</Text>
          </Text>

          {accountExists && mode === 'register' ? (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                You&apos;re already registered. Enter the OTP to sign in.
              </Text>
            </View>
          ) : null}

          {mode === 'register' && !isExistingAccount ? (
            <TextInput
              accessibilityLabel="Your name"
              accessibilityHint="Required only when creating a new account"
              placeholder="Your name (new accounts only)"
              placeholderTextColor={colors.textFaint}
              value={displayName}
              onChangeText={setDisplayName}
              style={styles.nameInput}
              autoCapitalize="words"
              autoCorrect={false}
            />
          ) : null}

          <View style={styles.digitRow}>
            {digits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                accessibilityLabel={`Digit ${index + 1}`}
                keyboardType="number-pad"
                maxLength={1}
                value={digit}
                onChangeText={(value) => handleDigitChange(index, value)}
                onKeyPress={(event) => handleKeyPress(index, event)}
                style={[styles.digitBox, digit ? styles.digitBoxFilled : null]}
                selectTextOnFocus
              />
            ))}
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <PrimaryButton
            accessibilityLabel="Verify code"
            label="Verify →"
            loading={isLoading}
            disabled={!codeComplete}
            onPress={() => void handleVerify()}
            style={styles.verifyButton}
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
                <Text style={styles.resendLink}>Resend in {resendSeconds}s</Text>
              ) : (
                <Text style={styles.resendLinkActive}>Resend code</Text>
              )}
            </Text>
          </Pressable>
        </View>
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
    paddingHorizontal: 22,
  },
  backButton: {
    paddingTop: 8,
    paddingBottom: 12,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 17,
    color: colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 48,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 26,
  },
  phoneHighlight: {
    color: colors.text,
    fontWeight: '700',
  },
  nameInput: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
    marginBottom: 20,
  },
  digitRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
  },
  digitBox: {
    width: 44,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  digitBoxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  errorBox: {
    width: '100%',
    backgroundColor: colors.errorBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    textAlign: 'center',
  },
  verifyButton: {
    width: '100%',
  },
  resendWrap: {
    marginTop: 14,
    padding: 8,
  },
  resendText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  resendLink: {
    color: colors.textFaint,
    fontWeight: '600',
  },
  resendLinkActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  infoBox: {
    width: '100%',
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  infoText: {
    color: colors.primary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
});
