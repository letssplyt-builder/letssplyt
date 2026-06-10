import { useEffect, useRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { BottomSheetModal } from '../layout/BottomSheetModal';
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
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [visible]);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      keyboardAware
      dismissLabel="Dismiss create event"
      sheetStyle={styles.sheetBg}
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
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: authColors.gradientMid,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: authColors.glassBorder,
    alignSelf: 'center',
    marginBottom: 12,
  },
  heading: {
    fontSize: 18,
    fontWeight: '800',
    color: authColors.textOnDark,
    marginBottom: 12,
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
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    marginTop: 6,
  },
});
