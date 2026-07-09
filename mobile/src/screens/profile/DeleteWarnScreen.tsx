import { useEffect, useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { FadeSlideIn } from '../../components/auth/FadeSlideIn';
import { ScreenTopBar } from '../../components/navigation/ScreenTopBar';
import { fetchBalance } from '../../services/event.service';
import { formatMoney } from '../../utils/events';
import type { SettingsStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

type Props = NativeStackScreenProps<SettingsStackParamList, 'DeleteWarn'>;

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    layout: {
      paddingHorizontal: 0,
    },
    body: {
      flex: 1,
      paddingHorizontal: 28,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.ink2,
      marginBottom: 20,
      fontFamily: theme.fontBody,
    },
    loader: {
      marginTop: 12,
    },
    listCard: {
      borderRadius: theme.radiusSm,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.surface,
      padding: 16,
      gap: 10,
    },
    listItem: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
    blockCard: {
      borderRadius: theme.radiusSm,
      borderWidth: 1,
      borderColor: theme.bad,
      backgroundColor: theme.warnSoft,
      padding: 16,
      gap: 8,
    },
    blockTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.bad,
      fontFamily: theme.fontBody,
    },
    blockText: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
    footer: {
      gap: 12,
    },
    continueButton: {
      paddingVertical: 14,
      borderRadius: theme.radiusSm,
      alignItems: 'center',
      backgroundColor: theme.warnSoft,
      borderWidth: 1.5,
      borderColor: theme.bad,
    },
    continueText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.bad,
      fontFamily: theme.fontBody,
    },
    cancelWrap: {
      paddingVertical: 10,
      alignItems: 'center',
    },
    cancelText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
    cancelOnlyButton: {
      paddingVertical: 14,
      borderRadius: theme.radiusSm,
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: theme.line,
      backgroundColor: theme.surface,
    },
    cancelOnlyText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
  });
}

export function DeleteWarnScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [isCheckingBalance, setIsCheckingBalance] = useState(true);
  const [youOwe, setYouOwe] = useState(0);
  const [currency, setCurrency] = useState('USD');
  const [balanceError, setBalanceError] = useState(false);

  useEffect(() => {
    void fetchBalance()
      .then((balance) => {
        setYouOwe(balance.you_owe ?? 0);
        setCurrency(balance.currency ?? 'USD');
      })
      .catch(() => setBalanceError(true))
      .finally(() => setIsCheckingBalance(false));
  }, []);

  const hasOutstandingDebt = youOwe > 0;

  const footer = (
    <FadeSlideIn delay={120}>
      <View style={styles.footer}>
        {hasOutstandingDebt ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={styles.cancelOnlyButton}
          >
            <Text style={styles.cancelOnlyText}>Go back</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue to account deletion"
              onPress={() => navigation.navigate('DeleteConfirm')}
              style={styles.continueButton}
              disabled={isCheckingBalance || balanceError}
            >
              <Text style={styles.continueText}>Continue</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.goBack()}
              style={styles.cancelWrap}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </>
        )}
      </View>
    </FadeSlideIn>
  );

  return (
    <AuthGradientLayout contentStyle={styles.layout} footer={footer}>
      <ScreenTopBar title="Delete your account?" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
      <FadeSlideIn delay={0}>
        <Text style={styles.subtitle}>
          This permanently removes your LetsSplyt account and cannot be undone.
        </Text>
      </FadeSlideIn>

      {isCheckingBalance ? (
        <ActivityIndicator color={theme.ink} style={styles.loader} />
      ) : hasOutstandingDebt ? (
        <FadeSlideIn delay={60}>
          <View style={styles.blockCard}>
            <Text style={styles.blockTitle}>Outstanding balance must be settled first</Text>
            <Text style={styles.blockText}>
              You still owe {formatMoney(youOwe, currency)} across your events. Pay or settle every
              amount you owe from the Dashboard before deleting your account.
            </Text>
          </View>
        </FadeSlideIn>
      ) : balanceError ? (
        <FadeSlideIn delay={60}>
          <View style={styles.blockCard}>
            <Text style={styles.blockText}>
              We couldn&apos;t verify your balance. Check your connection and try again.
            </Text>
          </View>
        </FadeSlideIn>
      ) : (
        <FadeSlideIn delay={60}>
          <View style={styles.listCard}>
            <Text style={styles.listItem}>• Your profile and phone number</Text>
            <Text style={styles.listItem}>• All saved payment handles</Text>
            <Text style={styles.listItem}>• In-app notifications on this account</Text>
            <Text style={styles.listItem}>
              • Your name on past events will show as &quot;Deleted User&quot;
            </Text>
          </View>
        </FadeSlideIn>
      )}
      </View>
    </AuthGradientLayout>
  );
}
