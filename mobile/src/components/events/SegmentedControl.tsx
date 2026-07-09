import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

interface SegmentedControlProps<T extends string> {
  segments: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
  compact?: boolean;
}

export function SegmentedControl<T extends string>({
  segments,
  labels,
  value,
  onChange,
  compact = false,
}: SegmentedControlProps<T>) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.wrap}>
      {segments.map((segment) => {
        const active = segment === value;
        return (
          <Pressable
            key={segment}
            accessibilityRole="button"
            accessibilityLabel={`${labels[segment]} tab`}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(segment)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text
              style={[
                styles.label,
                compact && styles.labelCompact,
                active && styles.labelActive,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {labels[segment]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: theme.radiusSm,
      padding: 4,
      borderWidth: 1,
      borderColor: theme.line,
    },
    segment: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: theme.radiusSm - 4,
      alignItems: 'center',
    },
    segmentActive: {
      backgroundColor: theme.accent,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
    labelActive: {
      color: theme.accentInk,
      fontWeight: '700',
    },
    labelCompact: {
      fontSize: 11,
    },
  });
}
