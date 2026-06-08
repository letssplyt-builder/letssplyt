import { useEffect, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '../PrimaryButton';
import { authColors } from '../../theme/colors';

interface CreateEventModalProps {
  visible: boolean;
  title: string;
  isCreating: boolean;
  error: string | null;
  onTitleChange: (value: string) => void;
  onClose: () => void;
  onCreate: () => void;
}

export function CreateEventModal({
  visible,
  title,
  isCreating,
  error,
  onTitleChange,
  onClose,
  onCreate,
}: CreateEventModalProps) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss create event" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
      >
        <View style={styles.handle} />
        <Text style={styles.heading}>New event</Text>
        <Text style={styles.label}>Event title</Text>
        <TextInput
          ref={inputRef}
          value={title}
          onChangeText={onTitleChange}
          placeholder="Friday Dinner"
          placeholderTextColor={authColors.textOnDarkFaint}
          style={styles.input}
          autoFocus
          editable={!isCreating}
          returnKeyType="done"
          onSubmitEditing={onCreate}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          label="Create event →"
          loading={isCreating}
          disabled={!title.trim() || isCreating}
          onPress={onCreate}
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
    marginBottom: 8,
  },
  error: {
    fontSize: 13,
    color: authColors.errorOnDark,
    marginBottom: 8,
  },
  cta: {
    marginTop: 8,
  },
});
