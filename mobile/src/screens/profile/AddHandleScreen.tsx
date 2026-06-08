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
import { GlassHandleInput } from '../../components/profile/GlassHandleInput';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { RootStackParamList } from '../../navigation/types';
import { isApiRequestError } from '../../services/api';
import { useProfileStore } from '../../store/profileStore';
import { PROVIDER_OPTIONS, providerLabel } from '../../utils/profile';
import { authColors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'AddHandle'>;

export function AddHandleScreen({ navigation, route }: Props) {
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
      if (isEditMode && route.params?.handleId) {
        await updateHandle(route.params.handleId, result.normalized);
        navigation.navigate('Profile', {
          toastMessage: 'Payment method updated successfully',
        });
      } else {
        await addHandle(selectedProvider, result.normalized);
        navigation.navigate('Profile', {
          toastMessage: 'Payment method added successfully',
        });
      }
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
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FadeSlideIn delay={0}>
          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
        </FadeSlideIn>

        <FadeSlideIn delay={60}>
          <Text style={styles.title}>{isEditMode ? 'Edit payment method' : 'Add payment method'}</Text>
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

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0,
  },
  scroll: {
    paddingHorizontal: 28,
    paddingBottom: 24,
    gap: 16,
  },
  back: {
    marginBottom: 8,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: authColors.textOnDarkMuted,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: authColors.textOnDark,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: authColors.textOnDarkMuted,
    marginBottom: 8,
    lineHeight: 20,
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
    borderColor: authColors.glassBorder,
    backgroundColor: authColors.segmentInactive,
  },
  chipSelected: {
    borderColor: 'rgba(255, 255, 255, 0.55)',
    backgroundColor: authColors.segmentActive,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: authColors.segmentInactiveText,
  },
  chipTextSelected: {
    color: authColors.segmentActiveText,
  },
  lockedProvider: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: authColors.glassBorder,
    backgroundColor: authColors.glass,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  lockedLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: authColors.textOnDarkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  lockedValue: {
    fontSize: 16,
    fontWeight: '700',
    color: authColors.textOnDark,
  },
});
