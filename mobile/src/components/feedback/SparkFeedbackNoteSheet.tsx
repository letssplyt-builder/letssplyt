import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BottomSheetModal } from '../layout/BottomSheetModal';
import { PrimaryButton } from '../PrimaryButton';
import {
  SPARK_IMPROVEMENT_AREAS,
  sparkNotePlaceholder,
  sparkNoteTitle,
} from './sparkFeedbackContent';
import { useSparkFeedbackStore } from '../../store/sparkFeedbackStore';
import { getSparkFeedbackContextLabel } from '../../utils/sparkFeedbackNavigation';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    scrollContent: {
      paddingBottom: 8,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 999,
      backgroundColor: theme.line,
      marginBottom: 16,
    },
    kicker: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.ink3,
      letterSpacing: 0.6,
      marginBottom: 4,
      fontFamily: theme.fontBody,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.ink,
      marginBottom: 14,
      fontFamily: theme.fontDisplay,
    },
    contextChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      backgroundColor: theme.modalInset,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: theme.line,
      maxWidth: '100%',
    },
    contextLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.ink3,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontFamily: theme.fontBody,
    },
    contextValue: {
      flexShrink: 1,
      fontSize: 13,
      fontWeight: '700',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    chipsWrap: {
      marginBottom: 12,
    },
    chipsTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.ink2,
      marginBottom: 8,
      fontFamily: theme.fontBody,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.modalInset,
      borderWidth: 1,
      borderColor: theme.line,
    },
    chipSelected: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
    chipTextSelected: {
      color: theme.accentInk,
    },
    input: {
      minHeight: 120,
      borderRadius: theme.radiusSm,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.modalInset,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      lineHeight: 22,
      color: theme.ink,
      marginBottom: 12,
      fontFamily: theme.fontBody,
    },
    attachmentRow: {
      marginBottom: 16,
    },
    attachmentStub: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: theme.radiusSm,
      backgroundColor: theme.modalInset,
      borderWidth: 1,
      borderColor: theme.line,
      opacity: 0.72,
    },
    attachmentIcon: {
      fontSize: 14,
    },
    attachmentText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
    sendButton: {
      marginBottom: 10,
    },
    previewNote: {
      fontSize: 11,
      lineHeight: 16,
      color: theme.ink3,
      textAlign: 'center',
      marginBottom: 4,
      fontFamily: theme.fontBody,
    },
  });
}

export function SparkFeedbackNoteSheet() {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const visible = useSparkFeedbackStore((state) => state.noteVisible);
  const draft = useSparkFeedbackStore((state) => state.draft);
  const closeNote = useSparkFeedbackStore((state) => state.closeNote);
  const updateDraftMessage = useSparkFeedbackStore((state) => state.updateDraftMessage);
  const updateImprovementArea = useSparkFeedbackStore((state) => state.updateImprovementArea);
  const submitDraft = useSparkFeedbackStore((state) => state.submitDraft);

  const contextLabel = getSparkFeedbackContextLabel();

  const canSend = useMemo(() => {
    if (!draft) return false;
    const trimmed = draft.message.trim();
    if (draft.kind === 'improvement') {
      return trimmed.length >= 4 || draft.improvementArea !== null;
    }
    return trimmed.length >= 10;
  }, [draft]);

  if (!draft) {
    return null;
  }

  return (
    <BottomSheetModal
      visible={visible}
      onClose={closeNote}
      dismissLabel="Dismiss spark note"
      keyboardAware
      sheetStyle={{ maxHeight: '88%' }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.handle} />
        <Text style={styles.kicker}>✦ Send a spark note</Text>
        <Text style={styles.title}>{sparkNoteTitle(draft.kind)}</Text>

        <View style={styles.contextChip}>
          <Text style={styles.contextLabel}>On</Text>
          <Text style={styles.contextValue} numberOfLines={2}>
            {contextLabel}
          </Text>
        </View>

        {draft.kind === 'improvement' ? (
          <View style={styles.chipsWrap}>
            <Text style={styles.chipsTitle}>Which part?</Text>
            <View style={styles.chipsRow}>
              {SPARK_IMPROVEMENT_AREAS.map((area) => {
                const selected = draft.improvementArea === area;
                return (
                  <Pressable
                    key={area}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => updateImprovementArea(selected ? null : area)}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {area}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <TextInput
          accessibilityLabel="Feedback message"
          multiline
          value={draft.message}
          onChangeText={updateDraftMessage}
          placeholder={sparkNotePlaceholder(draft.kind)}
          placeholderTextColor={theme.ink3}
          style={styles.input}
          textAlignVertical="top"
          autoFocus
        />

        <View style={styles.attachmentRow}>
          <View style={styles.attachmentStub}>
            <Text style={styles.attachmentIcon}>📎</Text>
            <Text style={styles.attachmentText}>Screenshot — coming soon</Text>
          </View>
        </View>

        <PrimaryButton
          label="Send ✦"
          disabled={!canSend}
          onPress={submitDraft}
          style={styles.sendButton}
        />

        <Text style={styles.previewNote}>
          Preview mode — nothing is sent to the server yet.
        </Text>
      </ScrollView>
    </BottomSheetModal>
  );
}
