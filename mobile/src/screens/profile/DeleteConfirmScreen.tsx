import { useEffect, useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { ThemedScreenLayout } from '../../components/layout/ThemedScreenLayout';
import { FadeSlideIn } from '../../components/auth/FadeSlideIn';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useAppInsets } from '../../hooks/useAppInsets';
import type { SettingsStackParamList } from '../../navigation/types';
import { getApiErrorCode, isApiRequestError } from '../../services/api';
import { fetchBalance } from '../../services/event.service';
import * as profileService from '../../services/profile.service';
import { formatMoney } from '../../utils/events';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

type Props = NativeStackScreenProps<SettingsStackParamList, 'DeleteConfirm'>;

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.ink2,
      marginBottom: 20,
      fontFamily: theme.fontBody,
    },
    emphasis: {
      fontWeight: '800',
      color: theme.ink,
    },
    input: {
      borderRadius: theme.radiusSm,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.modalInset,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 18,
      fontWeight: '700',
      color: theme.ink,
      letterSpacing: 1,
      fontFamily: theme.fontBody,
    },
    readyHint: {
      marginTop: 10,
      fontSize: 13,
      lineHeight: 18,
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
    buttonWrap: {
      marginTop: 24,
    },
  });
}

export function DeleteConfirmScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
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
          { text: 'OK', onPress: () => navigation.goBack() }],
        );
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
    <ThemedScreenLayout
      topBar={{
        title: 'Confirm deletion',
        onBack: () => navigation.goBack(),
      }}
      scrollContentContainerStyle={{ paddingBottom: screenScrollBottomPadding }}
    >
        <FadeSlideIn delay={0}>
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
            placeholderTextColor={theme.ink3}
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
    </ThemedScreenLayout>
  );
}
