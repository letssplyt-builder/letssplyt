import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SplitEntryTab } from '../../screens/splits/splitEntry.utils';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

const TABS: SplitEntryTab[] = ['even', 'amount', 'percent', 'portion'];

const LABELS: Record<SplitEntryTab, string> = {
  even: 'Even',
  amount: '$ Amt',
  percent: '%',
  portion: '⅟',
};

interface SplitModeTabsProps {
  value: SplitEntryTab;
  onChange: (tab: SplitEntryTab) => void;
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 10,
    },
    tab: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: theme.radiusSm,
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
    },
    tabActive: {
      backgroundColor: theme.accentSoft,
      borderColor: theme.accent,
    },
    label: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.ink3,
      fontFamily: theme.fontBody,
    },
    labelActive: {
      color: theme.accent,
    },
  });
}

export function SplitModeTabs({ value, onChange }: SplitModeTabsProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const active = tab === value;
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={LABELS[tab]}
            onPress={() => onChange(tab)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{LABELS[tab]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
