import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '../PrimaryButton';
import { authColors } from '../../theme/colors';
import {
  AUTH_COUNTRIES,
  DEFAULT_AUTH_REGION,
  type AuthCountryCode,
  toE164FromNational,
} from '../../utils/phone';

interface AddParticipantModalProps {
  visible: boolean;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: {
    display_name: string;
    join_method: 'manual_phone' | 'manual_name_only';
    phone_e164?: string;
  }) => void;
}

export function AddParticipantModal({
  visible,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: AddParticipantModalProps) {
  const insets = useSafeAreaInsets();
  const nameRef = useRef<TextInput>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameOnly, setNameOnly] = useState(false);
  const region: AuthCountryCode = DEFAULT_AUTH_REGION;

  useEffect(() => {
    if (visible) {
      setName('');
      setPhone('');
      setNameOnly(false);
      const timer = setTimeout(() => nameRef.current?.focus(), 120);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [visible]);

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    if (nameOnly) {
      onSubmit({ display_name: trimmedName, join_method: 'manual_name_only' });
      return;
    }

    const phoneE164 = toE164FromNational(phone, region);
    if (!phoneE164) return;

    onSubmit({
      display_name: trimmedName,
      join_method: 'manual_phone',
      phone_e164: phoneE164,
    });
  };

  const canSubmit =
    name.trim().length > 0 && (nameOnly || toE164FromNational(phone, region) !== null);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss add participant" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
      >
        <View style={styles.handle} />
        <Text style={styles.heading}>Add member</Text>

        <Text style={styles.label}>Name</Text>
        <TextInput
          ref={nameRef}
          value={name}
          onChangeText={setName}
          placeholder="Alex"
          placeholderTextColor={authColors.textOnDarkFaint}
          style={styles.input}
          editable={!isSubmitting}
        />

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Name only (no phone)</Text>
          <Switch
            value={nameOnly}
            onValueChange={setNameOnly}
            trackColor={{ false: authColors.glassBorder, true: 'rgba(45, 212, 191, 0.55)' }}
            thumbColor="#FFFFFF"
            disabled={isSubmitting}
          />
        </View>

        {!nameOnly ? (
          <>
            <Text style={styles.label}>Phone ({AUTH_COUNTRIES[region].dial})</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder={AUTH_COUNTRIES[region].placeholder}
              placeholderTextColor={authColors.textOnDarkFaint}
              keyboardType="phone-pad"
              style={styles.input}
              editable={!isSubmitting}
            />
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          label="Add to group"
          loading={isSubmitting}
          disabled={!canSubmit || isSubmitting}
          onPress={handleSubmit}
          variant="inverse"
          style={styles.cta}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 61, 69, 0.55)',
  },
  sheet: {
    backgroundColor: authColors.gradientMid,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: authColors.glassBorder,
    alignSelf: 'center',
    marginBottom: 16,
  },
  heading: {
    fontSize: 20,
    fontWeight: '800',
    color: authColors.textOnDark,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: authColors.textOnDarkMuted,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: authColors.glassBorder,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: authColors.textOnDark,
    backgroundColor: authColors.glassStrong,
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: authColors.textOnDark,
  },
  error: {
    fontSize: 13,
    color: authColors.errorOnDark,
    marginBottom: 8,
  },
  cta: {
    marginTop: 4,
  },
});
