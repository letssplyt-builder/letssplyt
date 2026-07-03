import { Pressable, StyleSheet, Text, View } from 'react-native';
import { authColors } from '../../theme/colors';

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

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: authColors.segmentInactive,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: authColors.segmentActive,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: authColors.segmentInactiveText,
  },
  labelActive: {
    color: authColors.segmentActiveText,
    fontWeight: '700',
  },
  labelCompact: {
    fontSize: 11,
  },
});
