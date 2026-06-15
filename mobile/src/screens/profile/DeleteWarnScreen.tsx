import { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { FadeSlideIn } from '../../components/auth/FadeSlideIn';
import { fetchBalance } from '../../services/event.service';
import { formatMoney } from '../../utils/events';
import type { SettingsStackParamList } from '../../navigation/types';
import { authColors } from '../../theme/colors';

type Props = NativeStackScreenProps<SettingsStackParamList, 'DeleteWarn'>;

export function DeleteWarnScreen({ navigation }: Props) {
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
    <AuthGradientLayout contentStyle={styles.content} footer={footer}>
      <FadeSlideIn delay={0}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Delete your account?</Text>
        <Text style={styles.subtitle}>
          This permanently removes your LetsSplyt account and cannot be undone.
        </Text>
      </FadeSlideIn>

      {isCheckingBalance ? (
        <ActivityIndicator color={authColors.textOnDark} style={styles.loader} />
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
    </AuthGradientLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 28,
  },
  back: {
    marginBottom: 12,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: authColors.textOnDarkMuted,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: authColors.textOnDark,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: authColors.textOnDarkMuted,
    marginBottom: 20,
  },
  loader: {
    marginTop: 12,
  },
  listCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    backgroundColor: authColors.glass,
    padding: 16,
    gap: 10,
  },
  listItem: {
    fontSize: 14,
    lineHeight: 20,
    color: authColors.textOnDarkMuted,
  },
  blockCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.45)',
    backgroundColor: 'rgba(220, 38, 38, 0.16)',
    padding: 16,
    gap: 8,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FCA5A5',
  },
  blockText: {
    fontSize: 14,
    lineHeight: 22,
    color: authColors.textOnDarkMuted,
  },
  footer: {
    gap: 12,
  },
  continueButton: {
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(248, 113, 113, 0.55)',
  },
  continueText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F87171',
  },
  cancelWrap: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: authColors.textOnDarkMuted,
  },
  cancelOnlyButton: {
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: authColors.glassBorder,
    backgroundColor: authColors.glass,
  },
  cancelOnlyText: {
    fontSize: 15,
    fontWeight: '700',
    color: authColors.textOnDarkMuted,
  },
});
