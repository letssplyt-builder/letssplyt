import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BalanceSummary } from '../../services/event.service';
import { useTheme } from '../../theme/ThemeContext';
import { ThemedSurface } from '../../theme/ThemedSurface';
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
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (isLoading) {
    return (
      <ThemedSurface strong style={styles.card}>
        <View style={styles.skeleton} accessibilityLabel="Loading balance" />
      </ThemedSurface>
    );
  }

  if (error) {
    return (
      <ThemedSurface style={[styles.card, styles.errorCard]}>
        <Text style={styles.errorText}>Couldn&apos;t load your balance.</Text>
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </ThemedSurface>
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
  const netPositive = net > 0;
  const netNegative = net < 0;

  return (
    <ThemedSurface
      strong
      style={styles.card}
      // accessibility on ThemedSurface wrapper via child
    >
      <View
        accessibilityRole="summary"
        accessibilityLabel={`Net balance ${formatMoney(net, currency)}. Owed to you ${formatMoney(owedToYou, currency)}. You owe ${formatMoney(youOwe, currency)}.`}
        style={styles.inner}
      >
        <Text style={styles.heroLabel}>Net balance</Text>
        <Text
          style={[
            styles.heroAmount,
            netPositive && styles.positive,
            netNegative && styles.negative,
            !netPositive && !netNegative && styles.neutral,
            theme.heroGlow ? styles.heroGlow : null,
          ]}
        >
          {unavailable ? '—' : formatMoney(net, currency)}
        </Text>
        <Text style={styles.heroHint}>{netLabel(net, unavailable)}</Text>

        <View style={styles.divider} />

        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.columnLabel}>Owed to you</Text>
            <Text style={[styles.columnAmount, styles.positive]}>
              {unavailable ? '—' : formatMoney(owedToYou, currency)}
            </Text>
          </View>
          <View style={styles.columnDivider} />
          <View style={styles.column}>
            <Text style={styles.columnLabel}>You owe</Text>
            <Text style={[styles.columnAmount, styles.negative]}>
              {unavailable ? '—' : formatMoney(youOwe, currency)}
            </Text>
          </View>
        </View>
      </View>
    </ThemedSurface>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    card: {
      marginBottom: 16,
      padding: 18,
    },
    inner: {
      gap: 4,
    },
    skeleton: {
      height: 132,
      opacity: 0.5,
    },
    errorCard: {
      alignItems: 'center',
      padding: 16,
    },
    errorText: {
      fontSize: 14,
      color: theme.bad,
      marginBottom: 12,
      fontFamily: theme.fontBody,
    },
    retryButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: theme.radiusSm,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.surface,
    },
    retryText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    heroLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.ink3,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      fontFamily: theme.fontBody,
    },
    heroAmount: {
      fontSize: theme.heroSize,
      fontWeight: '800',
      letterSpacing: -1,
      fontVariant: ['tabular-nums'],
      fontFamily: theme.fontDisplay,
      color: theme.ink,
    },
    heroGlow: {
      textShadowColor: 'rgba(94,234,212,0.5)',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 18,
    },
    heroHint: {
      fontSize: 12,
      color: theme.ink2,
      marginTop: 2,
      fontFamily: theme.fontBody,
    },
    divider: {
      height: 1,
      backgroundColor: theme.line,
      marginVertical: 14,
    },
    columns: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    column: {
      flex: 1,
      gap: 4,
    },
    columnDivider: {
      width: 1,
      backgroundColor: theme.line,
      marginHorizontal: 12,
    },
    columnLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.ink3,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      fontFamily: theme.fontBody,
    },
    columnAmount: {
      fontSize: 20,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
      fontFamily: theme.fontDisplay,
    },
    positive: {
      color: theme.good,
    },
    negative: {
      color: theme.bad,
    },
    neutral: {
      color: theme.ink2,
    },
  });
}
