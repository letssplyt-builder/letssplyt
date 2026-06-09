import * as Contacts from 'expo-contacts';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
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
  toE164FromPhoneInput,
} from '../../utils/phone';

type ModalStep = 'choose' | 'manual';

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

function contactDisplayName(contact: Contacts.Contact): string {
  const fromParts = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
  if (fromParts) return fromParts;
  if (contact.name?.trim()) return contact.name.trim();
  return 'Unknown';
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
  const [step, setStep] = useState<ModalStep>('choose');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameOnly, setNameOnly] = useState(false);
  const [contactsDenied, setContactsDenied] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [isPickingContact, setIsPickingContact] = useState(false);
  const region: AuthCountryCode = DEFAULT_AUTH_REGION;

  useEffect(() => {
    if (visible) {
      setStep('choose');
      setName('');
      setPhone('');
      setNameOnly(false);
      setContactsDenied(false);
      setContactsError(null);
      setIsPickingContact(false);
    }
  }, [visible]);

  useEffect(() => {
    if (visible && step === 'manual') {
      const timer = setTimeout(() => nameRef.current?.focus(), 120);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [visible, step]);

  const handleManualSubmit = () => {
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

  const handleFromContacts = async () => {
    setContactsDenied(false);
    setContactsError(null);

    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      setContactsDenied(true);
      return;
    }

    setIsPickingContact(true);
    try {
      const contact = await Contacts.presentContactPickerAsync();
      if (!contact) return;

      const displayName = contactDisplayName(contact);
      const phoneRaw = contact.phoneNumbers?.[0]?.number?.trim();
      if (!phoneRaw) {
        setContactsError('That contact has no phone number. Try another contact or enter manually.');
        return;
      }

      const phoneE164 = toE164FromPhoneInput(phoneRaw);
      if (!phoneE164) {
        setContactsError('Could not read that phone number. Enter it manually instead.');
        return;
      }

      onSubmit({
        display_name: displayName,
        join_method: 'manual_phone',
        phone_e164: phoneE164,
      });
    } finally {
      setIsPickingContact(false);
    }
  };

  const canSubmitManual =
    name.trim().length > 0 && (nameOnly || toE164FromNational(phone, region) !== null);
  const busy = isSubmitting || isPickingContact;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss add participant" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
      >
        <View style={styles.handle} />
        <Text style={styles.heading}>Add member</Text>

        {step === 'choose' ? (
          <>
            <PrimaryButton
              label="From contacts"
              variant="inverse"
              loading={isPickingContact}
              disabled={busy}
              onPress={() => void handleFromContacts()}
              style={styles.choiceButton}
            />
            <PrimaryButton
              label="Enter manually"
              disabled={busy}
              onPress={() => setStep('manual')}
              style={styles.choiceButton}
            />

            {contactsDenied ? (
              <View style={styles.deniedBox}>
                <Text style={styles.deniedText}>
                  Contacts access is off. You can still add members manually, or enable contacts in
                  Settings.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open Settings"
                  onPress={() => void Linking.openSettings()}
                >
                  <Text style={styles.settingsLink}>Open Settings</Text>
                </Pressable>
              </View>
            ) : null}

            {contactsError ? <Text style={styles.error}>{contactsError}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to add options"
              onPress={() => setStep('choose')}
              disabled={busy}
              style={styles.backLink}
            >
              <Text style={styles.backLinkText}>← Back</Text>
            </Pressable>

            <Text style={styles.label}>Name</Text>
            <TextInput
              ref={nameRef}
              value={name}
              onChangeText={setName}
              placeholder="Alex"
              placeholderTextColor={authColors.textOnDarkFaint}
              style={styles.input}
              editable={!busy}
            />

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Name only (no phone)</Text>
              <Switch
                value={nameOnly}
                onValueChange={setNameOnly}
                trackColor={{ false: authColors.glassBorder, true: 'rgba(45, 212, 191, 0.55)' }}
                thumbColor="#FFFFFF"
                disabled={busy}
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
                  editable={!busy}
                />
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <PrimaryButton
              label="Add to group"
              loading={isSubmitting}
              disabled={!canSubmitManual || busy}
              onPress={handleManualSubmit}
              variant="inverse"
              style={styles.cta}
            />
          </>
        )}
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
  choiceButton: {
    marginBottom: 10,
  },
  deniedBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: authColors.errorBgOnDark,
    gap: 8,
  },
  deniedText: {
    fontSize: 13,
    color: authColors.textOnDarkMuted,
    lineHeight: 18,
  },
  settingsLink: {
    fontSize: 14,
    fontWeight: '700',
    color: authColors.textOnDark,
    textDecorationLine: 'underline',
  },
  backLink: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: authColors.textOnDarkMuted,
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
