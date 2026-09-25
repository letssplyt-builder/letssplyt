import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';
import { formatMoney } from '../../utils/events';

interface CollectDisclosureSectionProps {
  title: string;
  count: number;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function collectSectionHeaderLabel(
  title: string,
  count: number,
  total: number,
): string {
  return `${title} · ${count} · ${formatMoney(total)}`;
}

export function CollectDisclosureSection({
  title,
  count,
  total,
  expanded,
  onToggle,
  children,
}: CollectDisclosureSectionProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const label = collectSectionHeaderLabel(title, count, total);

  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title}, ${count} ${count === 1 ? 'person' : 'people'}, ${formatMoney(total)}`}
        onPress={onToggle}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
      >
        <Text style={styles.headerLabel}>{label}</Text>
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={16}
          color={theme.ink3}
        />
      </Pressable>
      {expanded ? <View>{children}</View> : null}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    section: {
      marginBottom: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4,
      marginBottom: 10,
    },
    headerPressed: {
      opacity: 0.75,
    },
    headerLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.ink3,
      textTransform: 'uppercase',
      letterSpacing: 0.9,
      fontFamily: theme.fontBody,
      flex: 1,
    },
  });
}
