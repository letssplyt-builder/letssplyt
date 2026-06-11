import { Pressable, StyleSheet, Text, View } from 'react-native';

export type SplitPath = 'itemised' | 'custom';

interface SplitPathToggleProps {
  value: SplitPath;
  onChange: (path: SplitPath) => void;
  showItemised: boolean;
}

export function SplitPathToggle({ value, onChange, showItemised }: SplitPathToggleProps) {
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

const styles = StyleSheet.create({
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
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
  },
  labelActive: {
    color: '#0B3D45',
  },
});
