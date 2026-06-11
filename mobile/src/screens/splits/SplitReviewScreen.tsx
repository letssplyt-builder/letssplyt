import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { PrimaryButton } from '../../components/PrimaryButton';
import { splitActionBarFooterStyle } from '../../constants/layout';
import { useAppInsets } from '../../hooks/useAppInsets';
import type { EventsStackParamList } from '../../navigation/types';
import { confirmEventSplit } from '../../services/messages.service';
import { isApiRequestError } from '../../services/api';
import { useSplitStore } from '../../store/splitStore';
import { authColors, colors } from '../../theme/colors';
import { glassStyles } from '../../theme/glassStyles';
import {
  formatSplitMoney,
  isWithinMoneyTolerance,
  parseNumericInput,
} from './splitEntry.utils';

type Props = NativeStackScreenProps<EventsStackParamList, 'SplitReview'>;

export function SplitReviewScreen({ navigation, route }: Props) {
  const { eventId } = route.params;
  const { rawBottom } = useAppInsets();
  const splits = useSplitStore((s) => s.splits);
  const billTotal = useSplitStore((s) => s.billTotal);
  const currency = useSplitStore((s) => s.currency);
  const totalCheck = useSplitStore((s) => s.totalCheck);
  const updateParticipantAmount = useSplitStore((s) => s.updateParticipantAmount);

  const [editParticipantId, setEditParticipantId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const sumBalanced = useMemo(
    () => isWithinMoneyTolerance(totalCheck, billTotal, currency),
    [billTotal, currency, totalCheck],
  );

  const allHaveAmounts = splits.every((row) => row.amount_owed > 0);
  const canSend = sumBalanced && allHaveAmounts && splits.length > 0;

  const openEdit = (participantId: string, current: number) => {
    setEditParticipantId(participantId);
    setEditInput(String(current));
  };

  const saveEdit = () => {
    if (!editParticipantId) return;
    const amount = parseNumericInput(editInput);
    updateParticipantAmount(editParticipantId, amount);
    setEditParticipantId(null);
    setEditInput('');
  };

  return (
    <AuthGradientLayout
      footerStyle={splitActionBarFooterStyle(rawBottom)}
      footer={
        <PrimaryButton
          label="Preview messages →"
          loading={confirming}
          disabled={!canSend || confirming}
          onPress={() => {
            void (async () => {
              setConfirmError(null);
              setConfirming(true);
              try {
                await confirmEventSplit(
                  eventId,
                  splits.map((row) => ({
                    participant_id: row.participant_id,
                    amount_owed: row.amount_owed,
                  })),
                );
                navigation.navigate('MessagePreview', { eventId });
              } catch (err) {
                setConfirmError(
                  isApiRequestError(err)
                    ? err.message
                    : "Couldn't confirm split. Try again.",
                );
              } finally {
                setConfirming(false);
              }
            })();
          }}
          accessibilityLabel="Preview messages"
          variant="inverse"
        />
      }
    >
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 24 }]}>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Review split</Text>
        <Text style={styles.subtitle}>Event {eventId.slice(0, 8)}…</Text>

        <View style={glassStyles.card}>
          {splits.map((row) => (
            <Pressable
              key={row.participant_id}
              accessibilityRole="button"
              accessibilityLabel={`${row.display_name}, owes ${formatSplitMoney(row.amount_owed, currency)}`}
              accessibilityHint="Tap to edit this person's amount"
              onPress={() => openEdit(row.participant_id, row.amount_owed)}
              style={styles.row}
            >
              <View style={styles.rowMain}>
                <Text style={styles.name}>{row.display_name}</Text>
                {row.item_names.length > 0 ? (
                  <Text style={styles.items}>{row.item_names.join(', ')}</Text>
                ) : null}
              </View>
              <Text style={styles.amount}>{formatSplitMoney(row.amount_owed, currency)}</Text>
            </Pressable>
          ))}
        </View>

        <View
          style={[styles.totalRow, sumBalanced ? styles.totalOk : styles.totalBad]}
          accessibilityLiveRegion="polite"
        >
          <Text style={[styles.totalText, sumBalanced ? styles.totalTextOk : styles.totalTextBad]}>
            Total: {formatSplitMoney(totalCheck, currency)}
            {sumBalanced ? ' ✓' : ''}
          </Text>
        </View>

        {!canSend ? (
          <Text style={styles.hint}>
            Adjust amounts so everyone has a share and the total matches the bill.
          </Text>
        ) : null}
        {confirmError ? <Text style={styles.hint}>{confirmError}</Text> : null}
      </ScrollView>

      <Modal visible={editParticipantId !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit amount</Text>
            <TextInput
              accessibilityLabel="Edit amount"
              keyboardType="decimal-pad"
              value={editInput}
              onChangeText={setEditInput}
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditParticipantId(null)} style={styles.modalBtn}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveEdit} style={styles.modalBtnPrimary}>
                <Text style={styles.modalBtnPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AuthGradientLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  back: {
    color: authColors.ctaSurface,
    fontWeight: '600',
    fontSize: 15,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: authColors.ctaSurface,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: authColors.textOnDarkMuted,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: authColors.glassBorder,
  },
  rowMain: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  items: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  amount: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  totalRow: {
    marginTop: 16,
    borderRadius: 12,
    padding: 14,
  },
  totalOk: {
    backgroundColor: '#ECFDF5',
  },
  totalBad: {
    backgroundColor: '#FEF2F2',
  },
  totalText: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  totalTextOk: {
    color: '#047857',
  },
  totalTextBad: {
    color: '#B91C1C',
  },
  hint: {
    marginTop: 12,
    fontSize: 14,
    color: '#B91C1C',
    fontWeight: '600',
  },
  hintMuted: {
    marginTop: 12,
    fontSize: 14,
    color: authColors.textOnDarkMuted,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
    color: colors.text,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    borderRadius: 12,
    padding: 12,
    fontSize: 18,
    marginBottom: 16,
    color: colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
  },
  modalBtnPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
    borderRadius: 20,
  },
  modalBtnPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
