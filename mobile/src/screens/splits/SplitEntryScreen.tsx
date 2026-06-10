import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { CustomSplitPanel } from '../../components/splits/CustomSplitPanel';
import { ItemisedSplitPanel } from '../../components/splits/ItemisedSplitPanel';
import { SplitPathToggle, type SplitPath } from '../../components/splits/SplitPathToggle';
import { PrimaryButton } from '../../components/PrimaryButton';
import { splitActionBarFooterStyle } from '../../constants/layout';
import { useAppInsets } from '../../hooks/useAppInsets';
import type { EventsStackParamList } from '../../navigation/types';
import * as eventService from '../../services/event.service';
import * as splitsService from '../../services/splits.service';
import { useSplitStore } from '../../store/splitStore';
import { colors } from '../../theme/colors';
import {
  amountsFromPercents,
  computeEvenAmounts,
  formatSplitMoney,
  isPercentTotalValid,
  isWithinMoneyTolerance,
  parseNumericInput,
  type SplitEntryTab,
  allItemsAssigned,
} from './splitEntry.utils';

type Props = NativeStackScreenProps<EventsStackParamList, 'SplitEntry'>;

export function SplitEntryScreen({ navigation, route }: Props) {
  const { eventId, mode = 'itemised' } = route.params;
  const setCalculated = useSplitStore((s) => s.setCalculated);
  const { rawBottom } = useAppInsets();

  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<
    Array<{ id: string; display_name: string }>
  >([]);
  const [currency, setCurrency] = useState('USD');
  const [billTotal, setBillTotal] = useState(0);
  const [manualTotalInput, setManualTotalInput] = useState('');
  const [foodItems, setFoodItems] = useState<
    Array<{ id: string; name: string; unit_price: number; quantity: number }>
  >([]);

  const hasReceiptItems = foodItems.length > 0;
  const [splitPath, setSplitPath] = useState<SplitPath>(
    mode === 'manual' && !hasReceiptItems ? 'custom' : mode === 'manual' ? 'custom' : 'itemised',
  );

  const [activeTab, setActiveTab] = useState<SplitEntryTab>('even');
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>({});
  const [percentInputs, setPercentInputs] = useState<Record<string, string>>({});
  const [portionInputs, setPortionInputs] = useState<Record<string, string>>({});
  const [assignments, setAssignments] = useState<Map<string, string[]>>(new Map());
  const [calculateLoading, setCalculateLoading] = useState(false);
  const [calculateError, setCalculateError] = useState<string | null>(null);

  const loadEvent = useCallback(async () => {
    setLoading(true);
    try {
      const detail = await eventService.fetchEventById(eventId);
      const rows = detail.participants.map((p) => ({
        id: p.id,
        display_name: p.display_name,
      }));
      setParticipants(rows);

      const eventCurrency = detail.event.currency ?? 'USD';
      setCurrency(eventCurrency);

      const review = detail.receipt_review;
      if (review) {
        const items = review.items
          .filter((item) => item.id)
          .map((item) => ({
            id: item.id!,
            name: item.name,
            unit_price: item.unit_price,
            quantity: item.quantity,
          }));
        setFoodItems(items);
        const subtotal = review.items.reduce(
          (sum, item) => sum + item.unit_price * item.quantity,
          0,
        );
        const fees = review.additional_charges.reduce((sum, c) => sum + c.amount, 0);
        const total =
          detail.event.total_amount ??
          subtotal + review.tax_amount + review.tip_amount + fees;
        setBillTotal(Number(total.toFixed(2)));
      } else {
        setFoodItems([]);
        const total = detail.event.total_amount ?? 0;
        setBillTotal(total);
        setManualTotalInput(total > 0 ? String(total) : '');
      }

      const emptyInputs = Object.fromEntries(rows.map((p) => [p.id, '']));
      setAmountInputs(emptyInputs);
      setPercentInputs(emptyInputs);
      setPortionInputs(Object.fromEntries(rows.map((p) => [p.id, '1'])));
    } catch {
      Alert.alert('Could not load event', 'Check your connection and try again.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [eventId, navigation]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  const effectiveTotal = useMemo(() => {
    if (!hasReceiptItems) {
      const parsed = parseNumericInput(manualTotalInput);
      return parsed > 0 ? parsed : billTotal;
    }
    return billTotal;
  }, [billTotal, hasReceiptItems, manualTotalInput]);

  const evenAmounts = useMemo(
    () => computeEvenAmounts(effectiveTotal, participants.length, currency),
    [effectiveTotal, participants.length, currency],
  );

  const amountSum = useMemo(
    () =>
      participants.reduce((sum, p) => sum + parseNumericInput(amountInputs[p.id] ?? ''), 0),
    [amountInputs, participants],
  );

  const percentValues = useMemo(
    () => participants.map((p) => parseNumericInput(percentInputs[p.id] ?? '')),
    [percentInputs, participants],
  );

  const percentAmounts = useMemo(
    () => amountsFromPercents(percentValues, effectiveTotal, currency),
    [percentValues, effectiveTotal, currency],
  );

  const portionSum = useMemo(
    () =>
      participants.reduce(
        (sum, p) =>
          sum + Math.max(1, Math.floor(parseNumericInput(portionInputs[p.id] ?? '1'))),
        0,
      ),
    [portionInputs, participants],
  );

  const assignedCount = useMemo(() => {
    return foodItems.filter((item) => (assignments.get(item.id) ?? []).length > 0).length;
  }, [assignments, foodItems]);

  const itemisedReady =
    foodItems.length > 0 && allItemsAssigned(foodItems.map((i) => i.id), assignments);

  const customCanReview = useMemo(() => {
    if (participants.length === 0 || effectiveTotal <= 0) return false;
    switch (activeTab) {
      case 'even':
        return true;
      case 'amount':
        return isWithinMoneyTolerance(amountSum, effectiveTotal, currency);
      case 'percent':
        return isPercentTotalValid(percentValues);
      case 'portion':
        return portionSum > 0;
      default:
        return false;
    }
  }, [
    activeTab,
    amountSum,
    currency,
    effectiveTotal,
    participants.length,
    percentValues,
    portionSum,
  ]);

  const canReview =
    splitPath === 'itemised' && hasReceiptItems
      ? itemisedReady && effectiveTotal > 0
      : customCanReview;

  const allocationLabel = useMemo(() => {
    if (activeTab === 'amount') {
      const balanced = isWithinMoneyTolerance(amountSum, effectiveTotal, currency);
      return {
        text: `${formatSplitMoney(amountSum, currency)} of ${formatSplitMoney(effectiveTotal, currency)} allocated`,
        balanced,
        ratio: effectiveTotal > 0 ? amountSum / effectiveTotal : 0,
      };
    }
    if (activeTab === 'percent') {
      const sum = percentValues.reduce((a, b) => a + b, 0);
      const valid = isPercentTotalValid(percentValues);
      return { text: `Total: ${sum.toFixed(0)}%`, balanced: valid, ratio: sum / 100 };
    }
    if (activeTab === 'even') {
      const share = evenAmounts[0] ?? 0;
      return {
        text: `${participants.length} people — ${formatSplitMoney(share, currency)} each`,
        balanced: true,
        ratio: 1,
      };
    }
    return {
      text: `${portionSum} total portions`,
      balanced: portionSum > 0,
      ratio: portionSum > 0 ? 1 : 0,
    };
  }, [
    activeTab,
    amountSum,
    currency,
    effectiveTotal,
    evenAmounts,
    participants.length,
    percentValues,
    portionSum,
  ]);

  const foodItemsWithPrice = useMemo(
    () =>
      foodItems.map((item) => ({
        id: item.id,
        name: item.name,
        price: Number((item.unit_price * item.quantity).toFixed(2)),
      })),
    [foodItems],
  );

  const onReview = async () => {
    setCalculateLoading(true);
    setCalculateError(null);
    try {
      let response: splitsService.SplitCalculateResponse;

      if (splitPath === 'itemised' && itemisedReady) {
        const assignmentRows = foodItems.map((item) => ({
          item_id: item.id,
          participant_ids: assignments.get(item.id) ?? [],
        }));
        response = await splitsService.calculateSplit(eventId, {
          split_mode: 'itemised',
          assignments: assignmentRows,
        });
      } else if (activeTab === 'even') {
        response = await splitsService.calculateSplit(eventId, {
          split_mode: 'equal',
          ...(!hasReceiptItems ? { manual_total: effectiveTotal } : {}),
        });
      } else {
        const manual_splits =
          activeTab === 'amount'
            ? participants.map((p) => ({
                participant_id: p.id,
                value: parseNumericInput(amountInputs[p.id] ?? '0'),
              }))
            : activeTab === 'percent'
              ? participants.map((p, i) => ({
                  participant_id: p.id,
                  value: percentValues[i],
                }))
              : participants.map((p) => ({
                  participant_id: p.id,
                  value: Math.max(1, Math.floor(parseNumericInput(portionInputs[p.id] ?? '1'))),
                }));

        response = await splitsService.calculateSplit(eventId, {
          split_mode: 'portion',
          manual_splits,
          ...(!hasReceiptItems ? { manual_total: effectiveTotal } : {}),
        });
      }

      setCalculated(
        eventId,
        currency,
        effectiveTotal,
        response.splits,
        response.total_check,
      );
      navigation.navigate('SplitReview', { eventId });
    } catch {
      setCalculateError("Couldn't calculate split. Check your connection and try again.");
    } finally {
      setCalculateLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <AuthGradientLayout
      footerStyle={splitActionBarFooterStyle(rawBottom)}
      footer={
        <PrimaryButton
          label="Review split →"
          loading={calculateLoading}
          disabled={!canReview}
          onPress={() => void onReview()}
          accessibilityLabel="Review split"
          variant="inverse"
        />
      }
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          style={styles.backBtn}
        >
          <Text style={styles.back}>← Back</Text>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Fair play</Text>
          <Text style={styles.title}>Lets Splyt</Text>
          <View style={styles.totalPill}>
            <Text style={styles.totalLabel}>Bill total</Text>
            <Text style={styles.totalValue}>{formatSplitMoney(effectiveTotal, currency)}</Text>
          </View>
        </View>

        <SplitPathToggle
          value={splitPath}
          onChange={setSplitPath}
          showItemised={hasReceiptItems}
        />

        {splitPath === 'itemised' && hasReceiptItems ? (
          <ItemisedSplitPanel
            items={foodItemsWithPrice}
            currency={currency}
            assignedCount={assignedCount}
            participants={participants}
            assignments={assignments}
            onAssignItem={(itemId, participantIds) =>
              setAssignments((prev) => {
                const next = new Map(prev);
                next.set(itemId, participantIds);
                return next;
              })
            }
          />
        ) : (
          <CustomSplitPanel
            participants={participants}
            currency={currency}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            evenAmounts={evenAmounts}
            amountInputs={amountInputs}
            onAmountChange={(id, text) =>
              setAmountInputs((prev) => ({ ...prev, [id]: text }))
            }
            percentInputs={percentInputs}
            onPercentChange={(id, text) =>
              setPercentInputs((prev) => ({ ...prev, [id]: text }))
            }
            percentAmounts={percentAmounts}
            portionInputs={portionInputs}
            onPortionChange={(id, text) =>
              setPortionInputs((prev) => ({ ...prev, [id]: text }))
            }
            allocationLabel={allocationLabel.text}
            allocationBalanced={allocationLabel.balanced}
            progressRatio={allocationLabel.ratio}
            manualTotalInput={manualTotalInput}
            onManualTotalChange={setManualTotalInput}
            showManualTotal={!hasReceiptItems}
          />
        )}

        {calculateError ? <Text style={styles.error}>{calculateError}</Text> : null}
      </ScrollView>

    </AuthGradientLayout>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  backBtn: {
    marginBottom: 8,
  },
  back: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
    fontSize: 15,
  },
  hero: {
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 6,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 38,
    marginBottom: 16,
  },
  totalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  error: {
    marginTop: 16,
    color: '#FECACA',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
