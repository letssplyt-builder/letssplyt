import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { ThemedSurface } from '../../theme/ThemedSurface';
import { formatMoney } from '../../utils/events';

interface CounterpartyRowProps {
  displayName: string;
  amount: number;
  avatarColour?: string;
  directionLabel?: string;
  amountTone?: 'positive' | 'negative';
  statusDot?: 'overdue' | 'disputed' | null;
  onPress: () => void;
}

export function CounterpartyRow({
  displayName,
  amount,
  avatarColour = '#4F46E5',
  directionLabel,
  amountTone,
  statusDot = null,
  onPress,
}: CounterpartyRowProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const spokenAmount = formatMoney(amount);
  const accessibilityLabel = directionLabel
    ? `${displayName}, ${spokenAmount}, ${directionLabel}`
    : `${displayName}, ${spokenAmount}`;

  const dotColor =
    statusDot === 'disputed' ? theme.warn : statusDot === 'overdue' ? theme.bad : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.rowPressed]}
    >
      <ThemedSurface style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: avatarColour }]}>
          {dotColor ? <View style={[styles.statusDot, { backgroundColor: dotColor }]} /> : null}
          <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          {directionLabel ? (
            <Text style={styles.hint} numberOfLines={1}>
              {directionLabel}
            </Text>
          ) : null}
        </View>
        <Text
          style={[
            styles.amount,
            amountTone === 'positive' && styles.amountPositive,
            amountTone === 'negative' && styles.amountNegative,
          ]}
        >
          {spokenAmount}
        </Text>
      </ThemedSurface>
    </Pressable>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 8,
      borderRadius: theme.radiusSm,
      gap: 12,
    },
    rowPressed: {
      opacity: 0.92,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusDot: {
      position: 'absolute',
      top: -2,
      right: -2,
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: theme.surfaceStrong,
    },
    avatarText: {
      fontSize: 16,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    body: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    name: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    hint: {
      fontSize: 12,
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
    amount: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.ink,
      fontVariant: ['tabular-nums'],
      fontFamily: theme.fontDisplay,
    },
    amountPositive: {
      color: theme.good,
    },
    amountNegative: {
      color: theme.bad,
    },
  });
}
