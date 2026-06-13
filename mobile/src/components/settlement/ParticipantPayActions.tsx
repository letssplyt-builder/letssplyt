import { StyleSheet, View } from 'react-native';
import { PrimaryButton } from '../PrimaryButton';

interface ParticipantPayActionsProps {
  onPayNow: () => void;
  onAllPaid: () => void;
  payNowLabel?: string;
  allPaidLoading?: boolean;
}

export function ParticipantPayActions({
  onPayNow,
  onAllPaid,
  payNowLabel = 'Pay now',
  allPaidLoading = false,
}: ParticipantPayActionsProps) {
  return (
    <View style={styles.row}>
      <PrimaryButton
        label={payNowLabel}
        variant="inverse"
        onPress={onPayNow}
        style={styles.button}
      />
      <PrimaryButton
        label="All paid"
        loading={allPaidLoading}
        onPress={onAllPaid}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 8,
  },
  button: {
    flex: 1,
  },
});
