import { useEffect, useRef, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PhoneInput from 'react-native-phone-number-input';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { OtpRequestResponse } from '@letssplyt/shared/auth.types';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { RootStackParamList } from '../../navigation/types';
import { apiPost, getApiErrorCode, isApiRequestError } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import { nationalFromE164, toE164FromPhoneInput } from '../../utils/phone';

type Props = NativeStackScreenProps<RootStackParamList, 'PhoneEntry'>;

export function PhoneEntryScreen({ navigation, route }: Props) {
  const phoneRef = useRef<PhoneInput>(null);
  const [phoneValue, setPhoneValue] = useState(() =>
    nationalFromE164(route.params.initialPhone ?? ''),
  );
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
    const phoneInput = phoneRef.current;
    if (!phoneInput) return;

    const parsed = phoneInput.getNumberAfterPossiblyEliminatingZero();
    const nationalNumber = parsed?.number ?? '';
    if (!nationalNumber || !phoneInput.isValidNumber(nationalNumber)) {
      setError("Couldn't send code. Check your number and try again.");
      return;
    }

    const phoneE164 = toE164FromPhoneInput(parsed?.formattedNumber ?? '', 'US');
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{mode === 'login' ? 'Welcome back' : 'New account'}</Text>
          </View>
          <Text style={styles.title}>Your phone{'\n'}number</Text>
          <Text style={styles.subtitle}>We'll verify with a one-time code.</Text>
        </View>

        <View style={styles.inputWrap}>
          <PhoneInput
            ref={phoneRef}
            defaultCode="US"
            layout="first"
            value={phoneValue}
            onChangeText={(text) => {
              setPhoneValue(text);
              setShowRegisterCta(false);
            }}
            containerStyle={styles.phoneContainer}
            textContainerStyle={styles.phoneTextContainer}
            textInputStyle={styles.phoneInput}
            codeTextStyle={styles.phoneCode}
            flagButtonStyle={styles.phoneFlag}
            placeholder="(555) 000-0000"
            textInputProps={{
              accessibilityLabel: 'Phone number',
              accessibilityHint: 'Enter your phone number including country code',
            }}
          />
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              {showRegisterCta ? (
                <View style={styles.registerCta}>
                  <Text style={styles.registerHint}>If you are new here</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Register a new account"
                    onPress={handleRegister}
                    style={styles.registerButton}
                  >
                    <Text style={styles.registerButtonText}>Register</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            accessibilityRole="button"
            label="Send Code →"
            loading={isLoading}
            onPress={() => void handleSendCode()}
          />
          <Text style={styles.legal}>
            By continuing you agree to our Terms & Privacy
          </Text>
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
    paddingBottom: 28,
  },
  header: {
    paddingTop: 48,
    marginBottom: 28,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    marginBottom: 14,
  },
  pillText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  inputWrap: {
    flex: 1,
  },
  phoneContainer: {
    width: '100%',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    height: 56,
  },
  phoneTextContainer: {
    backgroundColor: 'transparent',
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    paddingVertical: 0,
  },
  phoneInput: {
    fontSize: 17,
    color: colors.text,
    height: 54,
  },
  phoneCode: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  phoneFlag: {
    backgroundColor: 'transparent',
  },
  errorBox: {
    marginTop: 12,
    backgroundColor: colors.errorBg,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    lineHeight: 18,
  },
  registerCta: {
    marginTop: 12,
    alignItems: 'center',
    gap: 8,
  },
  registerHint: {
    fontSize: 13,
    color: colors.textMuted,
  },
  registerButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
    minWidth: 160,
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    gap: 10,
  },
  legal: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 4,
  },
});
