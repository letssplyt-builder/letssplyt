import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

type HeaderStatusChipProps = {
  label: string;
  /** Accent for the status dot — defaults to theme.good. */
  dotColor?: string;
};

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.surfaceStrong,
      flexShrink: 0,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    label: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
  });
}

export function HeaderStatusChip({ label, dotColor }: HeaderStatusChipProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.chip}>
      <View style={[styles.dot, { backgroundColor: dotColor ?? theme.good }]} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}
