import { StyleSheet, Text, View } from 'react-native';
import { authColors } from '../../theme/colors';

interface SettlementProgressBarProps {
  collected: number;
  total: number;
}

export function SettlementProgressBar({ collected, total }: SettlementProgressBarProps) {
  const ratio = total > 0 ? Math.min(1, Math.max(0, collected / total)) : 0;
  const percent = Math.round(ratio * 100);

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.label}>{percent}% collected</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
    gap: 6,
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: authColors.pillOnDark,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#34D399',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: authColors.textOnDarkMuted,
  },
});
