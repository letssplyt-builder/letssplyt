import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

export type SplitPath = 'itemised' | 'custom';

interface SplitPathToggleProps {
  value: SplitPath;
  onChange: (path: SplitPath) => void;
  showItemised: boolean;
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    segment: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: theme.radiusSm,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
    },
    segmentActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    label: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
    labelActive: {
      color: theme.accentInk,
    },
  });
}

export function SplitPathToggle({ value, onChange, showItemised }: SplitPathToggleProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (!showItemised) return null;

  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: value === 'itemised' }}
        accessibilityLabel="Items — split by receipt line items"
        onPress={() => onChange('itemised')}
        style={[styles.segment, value === 'itemised' && styles.segmentActive]}
      >
        <Text style={[styles.label, value === 'itemised' && styles.labelActive]}>Items</Text>
      </Pressable>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: value === 'custom' }}
        accessibilityLabel="Custom — even, amount, percent, portions"
        onPress={() => onChange('custom')}
        style={[styles.segment, value === 'custom' && styles.segmentActive]}
      >
        <Text style={[styles.label, value === 'custom' && styles.labelActive]}>Custom</Text>
      </Pressable>
    </View>
  );
}
