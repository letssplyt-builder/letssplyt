import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheetModal } from '../layout/BottomSheetModal';
import { SPARK_FEEDBACK_OPTIONS } from './sparkFeedbackContent';
import { useSparkFeedbackStore } from '../../store/sparkFeedbackStore';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

function makeStyles(theme: Theme) {
  return StyleSheet.create({
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
      fontSize: 24,
      fontWeight: '800',
      color: theme.ink,
      marginBottom: 6,
      fontFamily: theme.fontDisplay,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.ink2,
      marginBottom: 18,
      fontFamily: theme.fontBody,
    },
    cards: {
      gap: 10,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: theme.radiusSm,
      backgroundColor: theme.modalInset,
      borderWidth: 1,
      borderColor: theme.line,
    },
    cardPressed: {
      opacity: 0.92,
      transform: [{ scale: 0.99 }],
    },
    cardIcon: {
      fontSize: 22,
      width: 28,
      textAlign: 'center',
    },
    cardText: {
      flex: 1,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.ink,
      marginBottom: 2,
      fontFamily: theme.fontBody,
    },
    cardSubtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
    cardChevron: {
      fontSize: 22,
      color: theme.ink3,
      fontWeight: '300',
    },
    cancelLink: {
      alignItems: 'center',
      paddingVertical: 16,
    },
    cancelText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
  });
}

export function SparkFeedbackPickerSheet() {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const visible = useSparkFeedbackStore((state) => state.pickerVisible);
  const closePicker = useSparkFeedbackStore((state) => state.closePicker);
  const openNote = useSparkFeedbackStore((state) => state.openNote);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={closePicker}
      dismissLabel="Dismiss feedback picker"
    >
      <View style={styles.handle} />
      <Text style={styles.kicker}>✦ Spark note</Text>
      <Text style={styles.title}>Pick your note</Text>
      <Text style={styles.subtitle}>Quick feedback goes straight to the team.</Text>

      <View style={styles.cards}>
        {SPARK_FEEDBACK_OPTIONS.map((option) => (
          <Pressable
            key={option.kind}
            accessibilityRole="button"
            accessibilityLabel={`${option.title}. ${option.subtitle}`}
            onPress={() => openNote(option.kind)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <Text style={styles.cardIcon}>{option.icon}</Text>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{option.title}</Text>
              <Text style={styles.cardSubtitle}>{option.subtitle}</Text>
            </View>
            <Text style={styles.cardChevron}>›</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={closePicker}
        style={styles.cancelLink}
      >
        <Text style={styles.cancelText}>Not now</Text>
      </Pressable>
    </BottomSheetModal>
  );
}
