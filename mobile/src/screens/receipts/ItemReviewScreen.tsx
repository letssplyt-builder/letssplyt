import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ReceiptAdditionalCharge } from '@letssplyt/shared/receipt.types';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { ReceiptReviewSlip } from '../../components/receipts/ReceiptReviewSlip';
import { PrimaryButton } from '../../components/PrimaryButton';
import { splitActionBarFooterStyle } from '../../constants/layout';
import { useAppInsets } from '../../hooks/useAppInsets';
import type { EventsStackParamList } from '../../navigation/types';
import * as eventService from '../../services/event.service';
import * as receiptsService from '../../services/receipts.service';
import { authColors } from '../../theme/colors';
import { glassStyles } from '../../theme/glassStyles';
import {
  computeDiscountTotal,
  computeItemsSubtotal,
  computeReviewTotal,
  createLocalId,
  parseAmountInput,
  parseResultToSnapshot,
  snapshotToEditable,
  type EditableReviewDiscount,
  type EditableReviewItem,
} from './itemReview.utils';

type Props = NativeStackScreenProps<EventsStackParamList, 'ItemReview'>;

export function ItemReviewScreen({ navigation, route }: Props) {
  const { eventId, parseResult, flow = 'initial' } = route.params;
  const isEditFlow = flow === 'edit';
  const { rawBottom } = useAppInsets();

  const initialSnapshot = useMemo(() => parseResultToSnapshot(parseResult), [parseResult]);
  const initialEditable = useMemo(
    () => snapshotToEditable(initialSnapshot),
    [initialSnapshot],
  );

  const [items, setItems] = useState<EditableReviewItem[]>(initialEditable.items);
  const [charges, setCharges] = useState<ReceiptAdditionalCharge[]>(initialEditable.charges);
  const [discounts, setDiscounts] = useState<EditableReviewDiscount[]>(initialEditable.discounts);
  const [taxInput, setTaxInput] = useState(initialEditable.tax);
  const [tipInput, setTipInput] = useState(initialEditable.tip);
  const [confirming, setConfirming] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const runningTotal = computeReviewTotal(items, charges, discounts, taxInput, tipInput);
  const currency = initialSnapshot.currency;

  const applySnapshot = useCallback((snapshot: typeof initialSnapshot) => {
    const editable = snapshotToEditable(snapshot);
    setItems(editable.items);
    setCharges(editable.charges);
    setDiscounts(editable.discounts);
    setTaxInput(editable.tax);
    setTipInput(editable.tip);
    setExpandedKey(null);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const detail = await eventService.fetchEventById(eventId);
      if (detail.receipt_review) {
        applySnapshot(detail.receipt_review);
      }
    } catch {
      Alert.alert('Could not refresh', 'Check your connection and try again.');
    } finally {
      setRefreshing(false);
    }
  }, [applySnapshot, eventId]);

  const updateItem = (localId: string, patch: Partial<EditableReviewItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.localId === localId ? { ...item, ...patch } : item)),
    );
  };

  const removeItem = (localId: string) => {
    setItems((prev) => prev.filter((item) => item.localId !== localId));
    if (expandedKey === `item-${localId}`) {
      setExpandedKey(null);
    }
  };

  const addItem = () => {
    const localId = createLocalId();
    setItems((prev) => [
      ...prev,
      {
        localId,
        name: '',
        unit_price: 0,
        quantity: 1,
        is_fee: false,
      },
    ]);
    setExpandedKey(`item-${localId}`);
  };

  const updateCharge = (index: number, patch: Partial<ReceiptAdditionalCharge>) => {
    setCharges((prev) =>
      prev.map((charge, i) => (i === index ? { ...charge, ...patch } : charge)),
    );
  };

  const removeCharge = (index: number) => {
    setCharges((prev) => prev.filter((_, i) => i !== index));
    if (expandedKey === `charge-${index}`) {
      setExpandedKey(null);
    }
  };

  const addCharge = () => {
    setCharges((prev) => [...prev, { name: '', amount: 0 }]);
  };

  const updateDiscount = (localId: string, patch: Partial<EditableReviewDiscount>) => {
    setDiscounts((prev) =>
      prev.map((discount) =>
        discount.localId === localId ? { ...discount, ...patch } : discount,
      ),
    );
  };

  const removeDiscount = (localId: string) => {
    setDiscounts((prev) => prev.filter((discount) => discount.localId !== localId));
    if (expandedKey === `discount-${localId}`) {
      setExpandedKey(null);
    }
  };

  const addDiscount = () => {
    const localId = createLocalId();
    setDiscounts((prev) => [
      ...prev,
      { localId, name: '', type: 'percent', value: 0 },
    ]);
    setExpandedKey(`discount-${localId}`);
  };

  const handleConfirm = async () => {
    const validItems = items.filter((item) => item.name.trim().length > 0);
    if (validItems.length === 0) {
      setConfirmError('Add at least one item with a name.');
      return;
    }

    const payloadItems = validItems.map((item) => ({
      id: item.id,
      name: item.name.trim(),
      price: item.unit_price,
      quantity: item.quantity,
    }));

    const payloadCharges = charges
      .filter((charge) => charge.name.trim().length > 0 && charge.amount > 0)
      .map((charge) => ({
        name: charge.name.trim(),
        amount: charge.amount,
      }));

    const fees = payloadCharges.reduce((sum, charge) => sum + charge.amount, 0);
    const tax = parseAmountInput(taxInput);
    const tip = parseAmountInput(tipInput);
    const itemsSubtotal = computeItemsSubtotal(validItems);
    const filteredDiscounts = discounts.filter(
      (discount) => discount.name.trim().length > 0 && discount.value > 0,
    );
    const payloadDiscounts = filteredDiscounts.map((discount) => ({
      name: discount.name.trim(),
      type: discount.type,
      value: discount.value,
      scope: discount.scope ?? 'bill',
      item_id: discount.scope === 'item' ? discount.item_id : undefined,
    }));
    const discountTotal = computeDiscountTotal(filteredDiscounts, validItems);

    setConfirming(true);
    setConfirmError(null);
    try {
      await receiptsService.confirmReceipt({
        event_id: eventId,
        items: payloadItems,
        additional_charges: payloadCharges,
        discounts: payloadDiscounts,
        tax,
        fees: Number(fees.toFixed(2)),
        tip,
        discount_total: discountTotal,
      });
      navigation.replace('SplitEntry', { eventId, mode: 'itemised' });
    } catch {
      setConfirmError("Couldn't save items. Check your connection and try again.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <AuthGradientLayout
      contentStyle={styles.layout}
      footer={
        <PrimaryButton
          label={isEditFlow ? 'Continue to split →' : 'Looks good → assign shares'}
          loading={confirming}
          disabled={confirming}
          onPress={() => void handleConfirm()}
          accessibilityLabel={isEditFlow ? 'Continue to split' : 'Confirm items'}
          style={styles.confirmButton}
        />
      }
      footerStyle={splitActionBarFooterStyle(rawBottom)}
    >
      <StatusBar style="light" />

      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={styles.back}
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.screenTitle}>Review items</Text>
        <View style={styles.backPlaceholder} />
      </View>

      <Text style={styles.subtitle}>Fix anything the scanner missed before you split.</Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={authColors.textOnDark}
            onRefresh={() => void onRefresh()}
          />
        }
      >
        <ReceiptReviewSlip
          currency={currency}
          items={items}
          charges={charges}
          discounts={discounts}
          taxInput={taxInput}
          tipInput={tipInput}
          runningTotal={runningTotal}
          expandedKey={expandedKey}
          onExpandedKeyChange={setExpandedKey}
          onItemChange={updateItem}
          onItemRemove={removeItem}
          onAddItem={addItem}
          onChargeChange={updateCharge}
          onChargeRemove={removeCharge}
          onAddCharge={addCharge}
          onDiscountChange={updateDiscount}
          onDiscountRemove={removeDiscount}
          onAddDiscount={addDiscount}
          onTaxChange={setTaxInput}
          onTipChange={setTipInput}
        />

        {confirmError ? (
          <Text style={[glassStyles.errorText, styles.error]}>{confirmError}</Text>
        ) : null}
      </ScrollView>
    </AuthGradientLayout>
  );
}

const styles = StyleSheet.create({
  layout: {
    paddingHorizontal: 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 8,
    gap: 8,
  },
  back: {
    minWidth: 72,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: authColors.textOnDarkMuted,
  },
  backPlaceholder: {
    minWidth: 72,
  },
  screenTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: authColors.textOnDark,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: authColors.textOnDarkMuted,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  confirmButton: {
    alignSelf: 'stretch',
  },
  error: {
    marginTop: 12,
    textAlign: 'center',
  },
});
