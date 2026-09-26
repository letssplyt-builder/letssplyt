import { useMemo } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { PaymentHandleSetupForm } from './PaymentHandleSetupForm';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

interface PaymentHandleRequiredSheetProps {
  visible: boolean;
  onSaved: () => void;
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
      backgroundColor: 'rgba(0,0,0,0.68)',
    },
    card: {
      backgroundColor: theme.modalSurface,
      borderRadius: theme.radius,
      borderWidth: 1,
      borderColor: theme.line,
      padding: 20,
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.ink,
      fontFamily: theme.fontDisplay,
      marginBottom: 8,
    },
    body: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.ink2,
      fontFamily: theme.fontBody,
      marginBottom: 16,
    },
  });
}

export function PaymentHandleRequiredSheet({
  visible,
  onSaved,
}: PaymentHandleRequiredSheetProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => undefined}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View
          style={styles.card}
          accessibilityLabel="Add a payment method to send"
        >
          <Text style={styles.title}>Add a payment method</Text>
          <Text style={styles.body}>
            People need a way to pay you back. Add one method to send these
            requests.
          </Text>
          <PaymentHandleSetupForm onSaved={onSaved} saveLabel="Save and continue" />
        </View>
      </View>
    </Modal>
  );
}
