import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SplitEntryTab } from '../../screens/splits/splitEntry.utils';
import { colors } from '../../theme/colors';

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

export function SplitModeTabs({ value, onChange }: SplitModeTabsProps) {
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

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tabActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  labelActive: {
    color: '#4338CA',
  },
});
