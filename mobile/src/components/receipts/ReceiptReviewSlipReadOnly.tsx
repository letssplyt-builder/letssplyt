import { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReceiptReviewSnapshot } from '@letssplyt/shared/receipt.types';
import {
  computeDiscountLineAmount,
  computeDiscountTotal,
  computeItemsSubtotal,
  computeReviewTotal,
  itemLabelForDiscount,
  snapshotToEditable,
} from '../../screens/receipts/itemReview.utils';
import { formatMoney } from '../../utils/events';

const PAPER = {
  bg: '#FFFDF8',
  ink: '#1A1628',
  inkMuted: '#6B7280',
  inkFaint: '#9CA3AF',
  line: '#E8E4DC',
} as const;

function ReceiptDivider({ heavy = false }: { heavy?: boolean }) {
  return <View style={[styles.divider, heavy && styles.dividerHeavy]} />;
}

function StaticLine({
  label,
  amount,
  currency,
  muted,
}: {
  label: string;
  amount: number;
  currency: string;
  muted?: boolean;
}) {
  return (
    <View style={styles.lineRow}>
      <Text style={[styles.lineLabel, muted && styles.lineLabelMuted]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.lineAmount, muted && styles.lineAmountMuted]}>
        {formatMoney(amount, currency)}
      </Text>
    </View>
  );
}

export interface ReceiptReviewSlipReadOnlyProps {
  review: ReceiptReviewSnapshot;
  style?: StyleProp<ViewStyle>;
}

export function ReceiptReviewSlipReadOnly({ review, style }: ReceiptReviewSlipReadOnlyProps) {
  const editable = useMemo(() => snapshotToEditable(review), [review]);
  const subtotal = computeItemsSubtotal(editable.items);
  const feesTotal = editable.charges.reduce((sum, charge) => sum + charge.amount, 0);
  const discountTotal = computeDiscountTotal(editable.discounts, editable.items);
  const runningTotal = computeReviewTotal(
    editable.items,
    editable.charges,
    editable.discounts,
    editable.tax,
    editable.tip,
  );

  return (
    <View style={[styles.slip, style]}>
      <Text style={styles.slipBrand}>RECEIPT</Text>
      <Text style={styles.slipHint}>Shared bill breakdown</Text>
      <ReceiptDivider />

      {editable.items.map((item) => {
        const lineTotal = item.unit_price * item.quantity;
        const label =
          item.quantity > 1 ? `${item.quantity}× ${item.name || 'Item'}` : item.name || 'Item';
        return (
          <StaticLine key={item.localId} label={label} amount={lineTotal} currency={review.currency} />
        );
      })}

      {editable.charges.length > 0 ? <ReceiptDivider /> : null}

      {editable.charges.map((charge, index) => (
        <StaticLine
          key={`charge-${index}`}
          label={charge.name || 'Fee'}
          amount={charge.amount}
          currency={review.currency}
        />
      ))}

      <ReceiptDivider />

      <StaticLine label="Subtotal" amount={subtotal} currency={review.currency} />

      {editable.discounts.map((discount, index) => {
        const itemLabel = itemLabelForDiscount(discount, editable.items);
        const resolvedAmount = computeDiscountLineAmount(
          discount,
          editable.items,
          editable.discounts.slice(0, index),
        );
        const label = itemLabel ? `${discount.name} (${itemLabel})` : discount.name;
        return (
          <StaticLine
            key={discount.localId}
            label={label}
            amount={-resolvedAmount}
            currency={review.currency}
            muted
          />
        );
      })}

      {discountTotal > 0 ? (
        <StaticLine label="Discounts" amount={-discountTotal} currency={review.currency} muted />
      ) : null}
      {feesTotal > 0 ? (
        <StaticLine label="Fees" amount={feesTotal} currency={review.currency} />
      ) : null}
      {Number(review.tax_amount) > 0 ? (
        <StaticLine label="Tax" amount={Number(review.tax_amount)} currency={review.currency} />
      ) : null}
      {Number(review.tip_amount) > 0 ? (
        <StaticLine label="Tip" amount={Number(review.tip_amount)} currency={review.currency} />
      ) : null}

      <ReceiptDivider heavy />
      <View style={styles.grandTotalRow}>
        <Text style={styles.grandTotalLabel}>Total</Text>
        <Text style={styles.grandTotalValue}>{formatMoney(runningTotal, review.currency)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slip: {
    backgroundColor: PAPER.bg,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 20,
    shadowColor: '#0B3D45',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 10,
  },
  slipBrand: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3.2,
    color: PAPER.inkFaint,
    marginBottom: 6,
  },
  slipHint: {
    textAlign: 'center',
    fontSize: 12,
    color: PAPER.inkMuted,
    marginBottom: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: PAPER.line,
    marginVertical: 10,
  },
  dividerHeavy: {
    height: 1,
    backgroundColor: PAPER.inkFaint,
    marginVertical: 12,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
  },
  lineLabel: {
    flex: 1,
    fontSize: 14,
    color: PAPER.ink,
    lineHeight: 19,
  },
  lineLabelMuted: {
    color: PAPER.inkMuted,
  },
  lineAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: PAPER.ink,
  },
  lineAmountMuted: {
    color: '#059669',
  },
  grandTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: PAPER.ink,
  },
  grandTotalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: PAPER.ink,
  },
});
