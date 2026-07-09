import { useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PaymentProvider } from '@letssplyt/shared/profile.types';
import {
  paymentHandleHint,
  validatePaymentHandle,
} from '@letssplyt/shared/paymentHandleValidation';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { FadeSlideIn } from '../../components/auth/FadeSlideIn';
import { ScreenTopBar } from '../../components/navigation/ScreenTopBar';
import { GlassHandleInput } from '../../components/profile/GlassHandleInput';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { SettingsStackParamList } from '../../navigation/types';
import { isApiRequestError } from '../../services/api';
import { useProfileStore } from '../../store/profileStore';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';
import { PROVIDER_OPTIONS, providerLabel } from '../../utils/profile';

type Props = NativeStackScreenProps<SettingsStackParamList, 'AddHandle'>;

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    content: {
      paddingHorizontal: 0,
    },
    scroll: {
      paddingHorizontal: 28,
      paddingBottom: 24,
      gap: 16,
      paddingTop: 8,
    },
    subtitle: {
      fontSize: 14,
      color: theme.ink2,
      marginBottom: 8,
      lineHeight: 20,
      fontFamily: theme.fontBody,
    },
    chipRow: {
      gap: 10,
      paddingVertical: 4,
    },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: theme.line,
      backgroundColor: theme.surface,
    },
    chipSelected: {
      borderColor: theme.accent,
      backgroundColor: theme.accentSoft,
    },
    chipText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
    chipTextSelected: {
      color: theme.accent,
    },
    lockedProvider: {
      borderRadius: theme.radiusSm,
      borderWidth: 1.5,
      borderColor: theme.line,
      backgroundColor: theme.surface,
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 4,
    },
    lockedLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.ink3,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      fontFamily: theme.fontBody,
    },
    lockedValue: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
  });
}

export function AddHandleScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const addHandle = useProfileStore((state) => state.addHandle);
  const updateHandle = useProfileStore((state) => state.updateHandle);
  const isEditMode = Boolean(route.params?.handleId);
  const editProvider = route.params?.provider ?? 'venmo';

  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>(
    isEditMode ? editProvider : 'venmo',
  );
  const [handleValue, setHandleValue] = useState(route.params?.handleValue ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const placeholder = useMemo(() => {
    return PROVIDER_OPTIONS.find((option) => option.id === selectedProvider)?.placeholder ?? '';
  }, [selectedProvider]);

  const hint = paymentHandleHint(selectedProvider);
  const canAttemptSave = Boolean(handleValue.trim().length > 0 && !isSaving);

  const handleValueChange = (text: string) => {
    setHandleValue(text);
    if (validationError) {
      setValidationError(null);
    }
  };

  const handleSave = async () => {
    const result = validatePaymentHandle(selectedProvider, handleValue);
    if (!result.valid) {
      setValidationError(result.error);
      return;
    }

    setIsSaving(true);
    try {
      const toastMessage =
        isEditMode && route.params?.handleId
          ? 'Payment method updated successfully'
          : 'Payment method added successfully';

      if (isEditMode && route.params?.handleId) {
        await updateHandle(route.params.handleId, result.normalized);
      } else {
        await addHandle(selectedProvider, result.normalized);
      }

      navigation.reset({
        index: 1,
        routes: [
          { name: 'Settings' },
          { name: 'Profile', params: { toastMessage } },
        ],
      });
    } catch (err) {
      if (isApiRequestError(err) && err.code === 'DUPLICATE_PROVIDER') {
        setValidationError(
          `You already have ${providerLabel(selectedProvider)} on your profile. Edit the existing card or choose another provider.`,
        );
        return;
      }

      if (isApiRequestError(err) && err.code === 'INVALID_HANDLE') {
        setValidationError(err.message);
        return;
      }

      const message = isApiRequestError(err)
        ? err.message
        : 'Something went wrong. Check your connection and try again.';
      Alert.alert('Could not save', message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AuthGradientLayout
      contentStyle={styles.content}
      footer={
        <FadeSlideIn delay={120}>
          <PrimaryButton
            label={isSaving ? 'Saving…' : 'Save'}
            accessibilityLabel="Save payment method"
            onPress={() => void handleSave()}
            disabled={!canAttemptSave}
            variant="inverse"
          />
        </FadeSlideIn>
      }
    >
      <ScreenTopBar
        title={isEditMode ? 'Edit payment method' : 'Add payment method'}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FadeSlideIn delay={0}>
          <Text style={styles.subtitle}>
            {isEditMode
              ? 'Update how friends can pay you on this app'
              : 'Choose how friends can pay you back'}
          </Text>
        </FadeSlideIn>

        {!isEditMode ? (
          <FadeSlideIn delay={120}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {PROVIDER_OPTIONS.map((option) => {
                const selected = selectedProvider === option.id;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setSelectedProvider(option.id);
                      setValidationError(null);
                    }}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </FadeSlideIn>
        ) : (
          <FadeSlideIn delay={120}>
            <View style={styles.lockedProvider}>
              <Text style={styles.lockedLabel}>Provider</Text>
              <Text style={styles.lockedValue}>
                {PROVIDER_OPTIONS.find((option) => option.id === selectedProvider)?.label}
              </Text>
            </View>
          </FadeSlideIn>
        )}

        <FadeSlideIn delay={180}>
          <GlassHandleInput
            value={handleValue}
            onChangeText={handleValueChange}
            placeholder={placeholder}
            error={validationError}
            hint={validationError ? undefined : hint}
          />
        </FadeSlideIn>
      </ScrollView>
    </AuthGradientLayout>
  );
}
