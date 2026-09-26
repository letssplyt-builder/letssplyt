import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PaymentProvider } from '@letssplyt/shared/profile.types';
import {
  paymentHandleHint,
  validatePaymentHandle,
} from '@letssplyt/shared/paymentHandleValidation';
import { GlassHandleInput } from './GlassHandleInput';
import { PrimaryButton } from '../PrimaryButton';
import { isApiRequestError } from '../../services/api';
import { useProfileStore } from '../../store/profileStore';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';
import { PROVIDER_OPTIONS, providerLabel } from '../../utils/profile';

interface PaymentHandleSetupFormProps {
  onSaved: () => void;
  saveLabel?: string;
  buttonVariant?: 'brand' | 'inverse';
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    chipRow: {
      gap: 10,
      paddingVertical: 4,
      marginBottom: 12,
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
    saveButton: {
      marginTop: 16,
    },
  });
}

export function PaymentHandleSetupForm({
  onSaved,
  saveLabel = 'Save',
  buttonVariant = 'brand',
}: PaymentHandleSetupFormProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const addHandle = useProfileStore((state) => state.addHandle);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('venmo');
  const [handleValue, setHandleValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const placeholder =
    PROVIDER_OPTIONS.find((option) => option.id === selectedProvider)?.placeholder ?? '';
  const hint = paymentHandleHint(selectedProvider);

  const handleSave = async () => {
    const result = validatePaymentHandle(selectedProvider, handleValue);
    if (!result.valid) {
      setValidationError(result.error);
      return;
    }

    setIsSaving(true);
    try {
      await addHandle(selectedProvider, result.normalized);
      onSaved();
    } catch (err) {
      if (isApiRequestError(err) && err.code === 'DUPLICATE_PROVIDER') {
        setValidationError(
          `You already have ${providerLabel(selectedProvider)} on your profile. Choose another provider.`,
        );
        return;
      }
      if (isApiRequestError(err) && err.code === 'INVALID_HANDLE') {
        setValidationError(err.message);
        return;
      }
      setValidationError(
        isApiRequestError(err)
          ? err.message
          : 'Could not save. Check your connection and try again.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View>
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

      <GlassHandleInput
        value={handleValue}
        onChangeText={(text) => {
          setHandleValue(text);
          if (validationError) setValidationError(null);
        }}
        placeholder={placeholder}
        error={validationError}
        hint={validationError ? undefined : hint}
      />

      <PrimaryButton
        label={isSaving ? 'Saving…' : saveLabel}
        accessibilityLabel={saveLabel}
        onPress={() => void handleSave()}
        disabled={!handleValue.trim() || isSaving}
        variant={buttonVariant}
        style={styles.saveButton}
      />
    </View>
  );
}
