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

function balanceMessage(balance: BalanceSummary): { text: string; tone: 'positive' | 'negative' | 'neutral' } {
  if (balance.unavailable) {
    return { text: 'Balance unavailable', tone: 'neutral' };
  }
  if (balance.net_balance > 0) {
    return { text: `You're owed ${formatMoney(balance.net_balance, balance.currency)}`, tone: 'positive' };
  }
  if (balance.net_balance < 0) {
    return { text: `You owe ${formatMoney(Math.abs(balance.net_balance), balance.currency)}`, tone: 'negative' };
  }
  return { text: 'All settled up', tone: 'neutral' };
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

  const { text, tone } = balanceMessage(balance);
  const amountColor =
    tone === 'positive'
      ? '#6EE7B7'
      : tone === 'negative'
        ? authColors.errorOnDark
        : authColors.textOnDarkMuted;

  return (
    <View accessibilityRole="text" accessibilityLabel={text} style={[styles.card, styles.heroCard]}>
      <Text style={styles.heroLabel}>Net balance</Text>
      <Text style={[styles.heroAmount, { color: amountColor }]}>
        {balance.unavailable ? '—' : formatMoney(balance.net_balance, balance.currency)}
      </Text>
      <Text style={[styles.heroSub, { color: amountColor }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
  },
  heroCard: {
    backgroundColor: authColors.glassStrong,
  },
  skeleton: {
    height: 120,
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
  heroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: authColors.textOnDarkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  heroAmount: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 13,
    fontWeight: '600',
  },
});
