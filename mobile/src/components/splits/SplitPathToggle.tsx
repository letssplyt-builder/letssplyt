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
    gap: 10,
    marginBottom: 18,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    shadowColor: '#0B3D45',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  label: {
    fontSize: 16,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.92)',
  },
  labelActive: {
    color: '#0B3D45',
  },
});
