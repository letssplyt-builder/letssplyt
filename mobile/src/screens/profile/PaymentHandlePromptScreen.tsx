import { useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { PaymentHandleSetupForm } from '../../components/profile/PaymentHandleSetupForm';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentHandlePrompt'>;

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    content: {
      flex: 1,
      padding: 24,
      justifyContent: 'center',
    },
    icon: {
      fontSize: 56,
      marginBottom: 24,
      textAlign: 'center',
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: theme.ink,
      marginBottom: 12,
      textAlign: 'center',
      fontFamily: theme.fontDisplay,
    },
    body: {
      fontSize: 16,
      lineHeight: 24,
      color: theme.ink2,
      textAlign: 'center',
      marginBottom: 32,
      fontFamily: theme.fontBody,
    },
    allowButton: {
      alignSelf: 'stretch',
      marginBottom: 16,
    },
    skipButton: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    skipText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
  });
}

export function PaymentHandlePromptScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const dismissPaymentHandlePrompt = useAuthStore(
    (state) => state.dismissPaymentHandlePrompt,
  );
  const [showForm, setShowForm] = useState(false);

  const goHome = () => {
    dismissPaymentHandlePrompt();
    navigation.replace('MainTabs');
  };

  return (
    <AuthGradientLayout contentStyle={styles.content}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.icon}>💸</Text>
        <Text style={styles.title}>Get paid back</Text>
        <Text style={styles.body}>
          Add how friends pay you back. You can skip — you&apos;ll need this
          before you send payment requests.
        </Text>

        {showForm ? (
          <PaymentHandleSetupForm
            onSaved={goHome}
            saveLabel="Save"
            buttonVariant="inverse"
          />
        ) : (
          <PrimaryButton
            label="Add payment method"
            accessibilityLabel="Add payment method"
            onPress={() => setShowForm(true)}
            style={styles.allowButton}
          />
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip for now"
          onPress={goHome}
          style={styles.skipButton}
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </ScrollView>
    </AuthGradientLayout>
  );
}
