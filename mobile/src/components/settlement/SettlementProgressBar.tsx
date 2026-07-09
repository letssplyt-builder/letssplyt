import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

interface SettlementProgressBarProps {
  confirmedAmount: number;
  saysPaidAmount: number;
  totalAmount: number;
  paidCount: number;
  participantCount: number;
}

export function SettlementProgressBar({
  confirmedAmount,
  saysPaidAmount,
  totalAmount,
  participantCount,
  paidCount,
}: SettlementProgressBarProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const safeTotal = totalAmount > 0 ? totalAmount : 1;
  const confirmedRatio = Math.min(1, Math.max(0, confirmedAmount / safeTotal));
  const saysPaidRatio = Math.min(
    1 - confirmedRatio,
    Math.max(0, saysPaidAmount / safeTotal),
  );
  const confirmedWidth = `${confirmedRatio * 100}%` as const;
  const saysPaidWidth = `${saysPaidRatio * 100}%` as const;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Collection progress</Text>
        <Text style={styles.headerMeta}>
          {paidCount} of {participantCount} paid
        </Text>
      </View>
      <View style={styles.track}>
        {confirmedRatio > 0 ? (
          <View style={[styles.segmentConfirmed, { width: confirmedWidth }]} />
        ) : null}
        {saysPaidRatio > 0 ? (
          <View style={[styles.segmentSaysPaid, { width: saysPaidWidth }]} />
        ) : null}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.good }]} />
          <Text style={styles.legendText}>Confirmed</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.warn }]} />
          <Text style={styles.legendText}>Says paid</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.line }]} />
          <Text style={styles.legendText}>Outstanding</Text>
        </View>
      </View>
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    wrap: {
      marginBottom: 16,
      gap: 8,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
    headerMeta: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.ink3,
      fontFamily: theme.fontBody,
    },
    track: {
      height: 10,
      borderRadius: 999,
      backgroundColor: theme.line,
      overflow: 'hidden',
      flexDirection: 'row',
    },
    segmentConfirmed: {
      height: '100%',
      backgroundColor: theme.good,
    },
    segmentSaysPaid: {
      height: '100%',
      backgroundColor: theme.warn,
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 11,
      color: theme.ink3,
      fontFamily: theme.fontBody,
    },
  });
}
