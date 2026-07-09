import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { BottomSheetModal } from '../layout/BottomSheetModal';
import { PrimaryButton } from '../PrimaryButton';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

interface CreateEventModalProps {
  visible: boolean;
  title: string;
  isCreating: boolean;
  error: string | null;
  onTitleChange: (value: string) => void;
  onClose: () => void;
  onCreate: () => void;
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.line,
      alignSelf: 'center',
      marginBottom: 12,
    },
    heading: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.ink,
      marginBottom: 12,
      fontFamily: theme.fontDisplay,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.ink2,
      marginBottom: 8,
      fontFamily: theme.fontBody,
    },
    input: {
      borderWidth: 1.5,
      borderColor: theme.line,
      borderRadius: theme.radiusSm,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.ink,
      backgroundColor: theme.modalInset,
      marginBottom: 8,
      fontFamily: theme.fontBody,
    },
    error: {
      fontSize: 13,
      color: theme.bad,
      marginBottom: 8,
      fontFamily: theme.fontBody,
    },
    cta: {
      marginTop: 6,
    },
  });
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
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
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
    >
      <View style={styles.handle} />
      <Text style={styles.heading}>New event</Text>
      <Text style={styles.label}>Event title</Text>
      <TextInput
        ref={inputRef}
        value={title}
        onChangeText={onTitleChange}
        placeholder="Friday Dinner"
        placeholderTextColor={theme.ink3}
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
