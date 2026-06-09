import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BalanceSummary } from '../../services/event.service';
import { authColors } from '../../theme/colors';
import { formatMoney } from '../../utils/events';

interface BalanceHeroCardProps {
  balance: BalanceSummary | null;
  isLoading: boolean;
  error: boolean;
  onRetry: () => void;
}

function netLabel(net: number, unavailable: boolean): string {
  if (unavailable) return 'Settles after bills are split';
  if (net > 0) return 'Net in your favour';
  if (net < 0) return 'Net you need to pay';
  return 'All settled up';
}

export function BalanceHeroCard({ balance, isLoading, error, onRetry }: BalanceHeroCardProps) {
  if (isLoading) {
    return <View style={[styles.card, styles.skeleton]} accessibilityLabel="Loading balance" />;
  }

  if (error) {
    return (
      <View style={[styles.card, styles.errorCard]}>
        <Text style={styles.errorText}>Couldn&apos;t load your balance.</Text>
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!balance) {
    return null;
  }

  const unavailable = Boolean(balance.unavailable);
  const owedToYou = balance.owed_to_you ?? 0;
  const youOwe = balance.you_owe ?? 0;
  const net = balance.net_balance ?? owedToYou - youOwe;
  const currency = balance.currency ?? 'USD';

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`Owed to you ${formatMoney(owedToYou, currency)}. You owe ${formatMoney(youOwe, currency)}.`}
      style={[styles.card, styles.heroCard]}
    >
      <View style={styles.columns}>
        <View style={styles.column}>
          <Text style={styles.columnLabel}>Owed to you</Text>
          <Text style={[styles.columnAmount, styles.positive]}>
            {unavailable ? '—' : formatMoney(owedToYou, currency)}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.column}>
          <Text style={styles.columnLabel}>You owe</Text>
          <Text style={[styles.columnAmount, styles.negative]}>
            {unavailable ? '—' : formatMoney(youOwe, currency)}
          </Text>
        </View>
      </View>
      <View style={styles.netRow}>
        <Text style={styles.netLabel}>Net</Text>
        <Text
          style={[
            styles.netAmount,
            net > 0 ? styles.positive : net < 0 ? styles.negative : styles.neutral,
          ]}
        >
          {unavailable ? '—' : formatMoney(net, currency)}
        </Text>
      </View>
      <Text style={styles.netHint}>{netLabel(net, unavailable)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
  },
  heroCard: {
    backgroundColor: authColors.glassStrong,
  },
  skeleton: {
    height: 108,
    backgroundColor: authColors.glass,
    opacity: 0.7,
  },
  errorCard: {
    backgroundColor: authColors.errorBgOnDark,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: authColors.errorOnDark,
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: authColors.glass,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: authColors.textOnDark,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  column: {
    flex: 1,
    gap: 4,
  },
  divider: {
    width: 1,
    backgroundColor: authColors.glassBorder,
    marginHorizontal: 12,
  },
  columnLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: authColors.textOnDarkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  columnAmount: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  positive: {
    color: '#6EE7B7',
  },
  negative: {
    color: authColors.errorOnDark,
  },
  neutral: {
    color: authColors.textOnDarkMuted,
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: authColors.glassBorder,
  },
  netLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: authColors.textOnDarkMuted,
  },
  netAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  netHint: {
    fontSize: 12,
    color: authColors.textOnDarkFaint,
    marginTop: 6,
  },
});
