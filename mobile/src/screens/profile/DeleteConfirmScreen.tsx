import { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { FadeSlideIn } from '../../components/auth/FadeSlideIn';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useAppInsets } from '../../hooks/useAppInsets';
import type { SettingsStackParamList } from '../../navigation/types';
import { getApiErrorCode, isApiRequestError } from '../../services/api';
import { fetchBalance } from '../../services/event.service';
import * as profileService from '../../services/profile.service';
import { formatMoney } from '../../utils/events';
import { authColors } from '../../theme/colors';

type Props = NativeStackScreenProps<SettingsStackParamList, 'DeleteConfirm'>;

export function DeleteConfirmScreen({ navigation }: Props) {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCheckingBalance, setIsCheckingBalance] = useState(true);
  const [hasOutstandingDebt, setHasOutstandingDebt] = useState(false);
  const { screenScrollBottomPadding } = useAppInsets();

  useEffect(() => {
    void fetchBalance()
      .then((balance) => {
        if ((balance.you_owe ?? 0) > 0) {
          setHasOutstandingDebt(true);
          Alert.alert(
            'Outstanding balance',
            `You still owe ${formatMoney(balance.you_owe ?? 0, balance.currency ?? 'USD')}. Settle all payments from the Dashboard before deleting your account.`,
            [{ text: 'OK', onPress: () => navigation.goBack() }],
          );
        }
      })
      .catch(() => {
        Alert.alert('Could not verify balance', 'Check your connection and try again.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      })
      .finally(() => setIsCheckingBalance(false));
  }, [navigation]);

  const normalizedConfirm = confirmText.trim().toUpperCase();
  const canDelete = normalizedConfirm === 'DELETE' && !isDeleting && !isCheckingBalance && !hasOutstandingDebt;

  const handleDelete = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    try {
      await profileService.deleteAccount();
      navigation.replace('Deleted');
    } catch (err) {
      const code = getApiErrorCode(err);
      const message = isApiRequestError(err)
        ? err.message
        : 'Please try again.';
      if (code === 'OUTSTANDING_BALANCE') {
        Alert.alert('Outstanding balance', message, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Could not delete account', message);
      }
      setIsDeleting(false);
    }
  };

  return (
    <AuthGradientLayout contentStyle={styles.content}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: screenScrollBottomPadding }}
      >
        <FadeSlideIn delay={0}>
          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Confirm deletion</Text>
          <Text style={styles.subtitle}>
            Type <Text style={styles.emphasis}>DELETE</Text> below to permanently delete your account.
          </Text>
        </FadeSlideIn>

        <FadeSlideIn delay={60}>
          <TextInput
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="Type DELETE"
            placeholderTextColor={authColors.textOnDarkFaint}
            style={styles.input}
            accessibilityLabel="Type DELETE to confirm account deletion"
            editable={!isCheckingBalance && !hasOutstandingDebt}
          />
          {canDelete ? (
            <Text style={styles.readyHint}>Confirmation matched. Tap Delete account below.</Text>
          ) : null}
        </FadeSlideIn>

        <FadeSlideIn delay={120}>
          <View style={styles.buttonWrap}>
            <PrimaryButton
              accessibilityLabel="Delete account permanently"
              label={isDeleting ? 'Deleting…' : 'Delete account'}
              variant="inverse"
              disabled={!canDelete}
              loading={isDeleting || isCheckingBalance}
              onPress={() => void handleDelete()}
            />
          </View>
        </FadeSlideIn>
      </ScrollView>
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
  emphasis: {
    fontWeight: '800',
    color: authColors.textOnDark,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    backgroundColor: authColors.glass,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '700',
    color: authColors.textOnDark,
    letterSpacing: 1,
  },
  readyHint: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: authColors.textOnDarkMuted,
  },
  buttonWrap: {
    marginTop: 24,
  },
});
