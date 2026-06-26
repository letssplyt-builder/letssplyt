import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import type { ReceiptAdditionalCharge } from '@letssplyt/shared/receipt.types';
import type { ReceiptDiscountType } from '@letssplyt/shared/receipt.types';
import {
  computeDiscountLineAmount,
  computeDiscountTotal,
  computeItemsSubtotal,
  formatAmountInput,
  itemLabelForDiscount,
  parseAmountInput,
  type EditableReviewDiscount,
  type EditableReviewItem,
} from '../../screens/receipts/itemReview.utils';
import { formatMoney } from '../../utils/events';

const PAPER = {
  bg: '#FFFDF8',
  ink: '#1A1628',
  inkMuted: '#6B7280',
  inkFaint: '#9CA3AF',
  line: '#E8E4DC',
  accent: '#0E5C66',
  warn: '#D97706',
  warnBg: '#FFFBEB',
  warnBorder: '#FCD34D',
  danger: '#DC2626',
} as const;

function ReceiptDivider({ heavy = false }: { heavy?: boolean }) {
  return (
    <View style={[styles.divider, heavy && styles.dividerHeavy]} />
  );
}

function TrashIcon({ size = 18, color = PAPER.danger }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7h12Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M10 11v5M14 11v5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function ExpandedEditToolbar({
  onDone,
  onDelete,
  deleteAccessibilityLabel,
  deleteTestID,
}: {
  onDone: () => void;
  onDelete?: () => void;
  deleteAccessibilityLabel: string;
  deleteTestID?: string;
}) {
  return (
    <View style={styles.editToolbar}>
      <Pressable
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel="Done editing"
        style={styles.doneBtn}
      >
        <Text style={styles.doneBtnText}>Done</Text>
      </Pressable>
      {onDelete ? (
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={deleteAccessibilityLabel}
          testID={deleteTestID}
          style={styles.deleteIconBtn}
          hitSlop={6}
        >
          <TrashIcon />
        </Pressable>
      ) : null}
    </View>
  );
}

function QtyStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (qty: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        onPress={() => onChange(Math.max(1, value - 1))}
        style={styles.stepperBtn}
      >
        <Text style={styles.stepperBtnText}>−</Text>
      </Pressable>
      <Text style={styles.stepperValue}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        onPress={() => onChange(value + 1)}
        style={styles.stepperBtn}
      >
        <Text style={styles.stepperBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

function FoodLineRow({
  item,
  currency,
  isExpanded,
  onToggle,
  onCollapse,
  onChange,
  onRemove,
}: {
  item: EditableReviewItem;
  currency: string;
  isExpanded: boolean;
  onToggle: () => void;
  onCollapse: () => void;
  onChange: (patch: Partial<EditableReviewItem>) => void;
  onRemove: () => void;
}) {
  const isLow = item.confidence === 'low';
  const lineTotal = item.unit_price * item.quantity;
  const label = item.quantity > 1 ? `${item.quantity}× ${item.name || 'Item'}` : item.name || 'Item';

  if (isExpanded) {
    return (
      <View style={[styles.lineRow, styles.lineRowExpanded]}>
        <ExpandedEditToolbar
          onDone={onCollapse}
          onDelete={onRemove}
          deleteAccessibilityLabel={`Delete ${item.name || 'item'}`}
          deleteTestID={`delete-food-${item.localId}`}
        />
        <View style={styles.expandedBlock}>
          <TextInput
            style={styles.expandedNameInput}
            value={item.name}
            onChangeText={(text) => onChange({ name: text })}
            placeholder="Item name"
            placeholderTextColor={PAPER.inkFaint}
            accessibilityLabel={`${item.name || 'Item'}, edit name`}
          />
          <View style={styles.expandedControls}>
            <QtyStepper
              value={item.quantity}
              onChange={(qty) => onChange({ quantity: qty })}
            />
            <TextInput
              style={styles.expandedPriceInput}
              value={formatAmountInput(item.unit_price)}
              keyboardType="decimal-pad"
              onChangeText={(text) => onChange({ unit_price: parseAmountInput(text) })}
              placeholderTextColor={PAPER.inkFaint}
              accessibilityLabel={`${item.name || 'Item'} price`}
            />
          </View>
        </View>
      </View>
    );
  }

  const compactRow = (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`${item.name || 'Item'}, tap to edit`}
      accessibilityState={{ expanded: false }}
      style={[styles.lineRow, isLow && styles.lineRowWarn]}
    >
      <View style={styles.compactRow}>
        <View style={styles.compactLeft}>
          <Text style={styles.lineLabel} numberOfLines={2}>
            {label}
          </Text>
          {isLow ? (
            <View style={styles.checkChip}>
              <Text style={styles.checkChipText}>Check</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.lineAmount}>{formatMoney(lineTotal, currency)}</Text>
      </View>
    </Pressable>
  );

  return (
    <Swipeable
      renderRightActions={() => (
        <Pressable
          style={styles.swipeDelete}
          onPress={onRemove}
          accessibilityLabel={`Delete ${item.name || 'item'}`}
          testID={`delete-food-swipe-${item.localId}`}
        >
          <TrashIcon size={20} color="#FFF" />
        </Pressable>
      )}
    >
      {compactRow}
    </Swipeable>
  );
}

function ChargeLineRow({
  charge,
  currency,
  isExpanded,
  onToggle,
  onCollapse,
  onChange,
  onRemove,
}: {
  charge: ReceiptAdditionalCharge;
  currency: string;
  isExpanded: boolean;
  onToggle: () => void;
  onCollapse: () => void;
  onChange: (patch: Partial<ReceiptAdditionalCharge>) => void;
  onRemove: () => void;
}) {
  if (isExpanded) {
    return (
      <View style={[styles.lineRow, styles.lineRowExpanded]}>
        <ExpandedEditToolbar
          onDone={onCollapse}
          onDelete={onRemove}
          deleteAccessibilityLabel={`Delete ${charge.name || 'fee'}`}
        />
        <View style={styles.expandedBlock}>
          <TextInput
            style={styles.expandedNameInput}
            value={charge.name}
            onChangeText={(text) => onChange({ name: text })}
            placeholder="Fee label"
            placeholderTextColor={PAPER.inkFaint}
          />
          <TextInput
            style={styles.expandedPriceInput}
            value={formatAmountInput(charge.amount)}
            keyboardType="decimal-pad"
            onChangeText={(text) => onChange({ amount: parseAmountInput(text) })}
            placeholderTextColor={PAPER.inkFaint}
          />
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`${charge.name || 'Fee'}, tap to edit`}
      accessibilityState={{ expanded: false }}
      style={styles.lineRow}
    >
      <View style={styles.compactRow}>
        <Text style={styles.lineLabel} numberOfLines={2}>
          {charge.name || 'Fee'}
        </Text>
        <Text style={styles.lineAmount}>{formatMoney(charge.amount, currency)}</Text>
      </View>
    </Pressable>
  );
}

function DiscountLineRow({
  discount,
  currency,
  resolvedAmount,
  itemLabel,
  isExpanded,
  onToggle,
  onCollapse,
  onChange,
  onRemove,
}: {
  discount: EditableReviewDiscount;
  currency: string;
  resolvedAmount: number;
  itemLabel: string | null;
  isExpanded: boolean;
  onToggle: () => void;
  onCollapse: () => void;
  onChange: (patch: Partial<EditableReviewDiscount>) => void;
  onRemove: () => void;
}) {
  if (isExpanded) {
    return (
      <View style={[styles.lineRow, styles.lineRowExpanded, styles.discountRow]}>
        <ExpandedEditToolbar
          onDone={onCollapse}
          onDelete={onRemove}
          deleteAccessibilityLabel={`Delete ${discount.name || 'discount'}`}
        />
        <View style={styles.expandedBlock}>
          <TextInput
            style={styles.expandedNameInput}
            value={discount.name}
            onChangeText={(text) => onChange({ name: text })}
            placeholder="Discount description"
            placeholderTextColor={PAPER.inkFaint}
          />
          <View style={styles.discountTypeRow}>
            {(['percent', 'amount'] as ReceiptDiscountType[]).map((type) => {
              const selected = discount.type === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => onChange({ type })}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.discountTypeBtn, selected && styles.discountTypeBtnSelected]}
                >
                  <Text
                    style={[
                      styles.discountTypeBtnText,
                      selected && styles.discountTypeBtnTextSelected,
                    ]}
                  >
                    {type === 'percent' ? '%' : '$'}
                  </Text>
                </Pressable>
              );
            })}
            <TextInput
              style={styles.discountValueInput}
              value={formatAmountInput(discount.value)}
              keyboardType="decimal-pad"
              onChangeText={(text) => onChange({ value: parseAmountInput(text) })}
              placeholder={discount.type === 'percent' ? '10' : '5.00'}
              placeholderTextColor={PAPER.inkFaint}
            />
          </View>
        </View>
      </View>
    );
  }

  const label =
    discount.type === 'percent'
      ? `${discount.name || 'Discount'} (${formatAmountInput(discount.value)}%)`
      : discount.name || 'Discount';
  const scopedLabel =
    discount.scope === 'item' && itemLabel ? `${label} · ${itemLabel}` : label;

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`${label}, tap to edit`}
      accessibilityState={{ expanded: false }}
      style={[styles.lineRow, styles.discountRow]}
    >
      <View style={styles.compactRow}>
        <Text style={[styles.lineLabel, styles.discountLabel]} numberOfLines={2}>
          {scopedLabel}
        </Text>
        <Text style={[styles.lineAmount, styles.discountAmount]}>
          −{formatMoney(resolvedAmount, currency)}
        </Text>
      </View>
    </Pressable>
  );
}

function AmountLine({
  label,
  value,
  currency,
  isExpanded,
  onToggle,
  onCollapse,
  onChangeText,
}: {
  label: string;
  value: string;
  currency: string;
  isExpanded: boolean;
  onToggle: () => void;
  onCollapse: () => void;
  onChangeText: (text: string) => void;
}) {
  const amount = parseAmountInput(value);

  if (isExpanded) {
    return (
      <View style={styles.summaryLine}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <TextInput
          style={styles.summaryInput}
          value={value}
          keyboardType="decimal-pad"
          onChangeText={onChangeText}
          placeholderTextColor={PAPER.inkFaint}
        />
        <Pressable
          onPress={onCollapse}
          accessibilityRole="button"
          accessibilityLabel="Done editing"
          style={styles.doneBtnCompact}
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`${label}, tap to edit`}
      accessibilityState={{ expanded: false }}
      style={styles.summaryLine}
    >
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryAmount}>{formatMoney(amount, currency)}</Text>
    </Pressable>
  );
}

export interface ReceiptReviewSlipProps {
  style?: StyleProp<ViewStyle>;
  currency: string;
  items: EditableReviewItem[];
  charges: ReceiptAdditionalCharge[];
  discounts: EditableReviewDiscount[];
  taxInput: string;
  tipInput: string;
  runningTotal: number;
  onItemChange: (localId: string, patch: Partial<EditableReviewItem>) => void;
  onItemRemove: (localId: string) => void;
  onAddItem: () => void;
  onChargeChange: (index: number, patch: Partial<ReceiptAdditionalCharge>) => void;
  onChargeRemove: (index: number) => void;
  onAddCharge: () => void;
  onDiscountChange: (localId: string, patch: Partial<EditableReviewDiscount>) => void;
  onDiscountRemove: (localId: string) => void;
  onAddDiscount: () => void;
  onTaxChange: (text: string) => void;
  onTipChange: (text: string) => void;
  expandedKey: string | null;
  onExpandedKeyChange: (key: string | null) => void;
}

export function ReceiptReviewSlip({
  style,
  currency,
  items,
  charges,
  discounts,
  taxInput,
  tipInput,
  runningTotal,
  onItemChange,
  onItemRemove,
  onAddItem,
  onChargeChange,
  onChargeRemove,
  onAddCharge,
  onDiscountChange,
  onDiscountRemove,
  onAddDiscount,
  onTaxChange,
  onTipChange,
  expandedKey,
  onExpandedKeyChange,
}: ReceiptReviewSlipProps) {
  const subtotal = computeItemsSubtotal(items);
  const feesTotal = charges.reduce((sum, c) => sum + c.amount, 0);
  const discountTotal = computeDiscountTotal(discounts, items);

  const toggle = (key: string) => {
    onExpandedKeyChange(expandedKey === key ? null : key);
  };

  const collapse = () => onExpandedKeyChange(null);

  return (
    <View style={[styles.slip, style]}>
      <Text style={styles.slipBrand}>RECEIPT</Text>
      <Text style={styles.slipHint}>Tap a line to edit · Done when finished · swipe to delete</Text>
      <ReceiptDivider />

      {items.map((item) => (
        <FoodLineRow
          key={item.localId}
          item={item}
          currency={currency}
          isExpanded={expandedKey === `item-${item.localId}`}
          onToggle={() => toggle(`item-${item.localId}`)}
          onCollapse={collapse}
          onChange={(patch) => onItemChange(item.localId, patch)}
          onRemove={() => onItemRemove(item.localId)}
        />
      ))}

      <Pressable
        style={styles.addLineBtn}
        onPress={() => {
          onAddItem();
          onExpandedKeyChange(null);
        }}
        accessibilityRole="button"
        accessibilityLabel="Add item line"
      >
        <Text style={styles.addLineBtnText}>+ Add line</Text>
      </Pressable>

      {charges.length > 0 ? <ReceiptDivider /> : null}

      {charges.map((charge, index) => (
        <ChargeLineRow
          key={`charge-${index}`}
          charge={charge}
          currency={currency}
          isExpanded={expandedKey === `charge-${index}`}
          onToggle={() => toggle(`charge-${index}`)}
          onCollapse={collapse}
          onChange={(patch) => onChargeChange(index, patch)}
          onRemove={() => onChargeRemove(index)}
        />
      ))}

      <Pressable
        style={styles.addLineBtnMuted}
        onPress={() => {
          onAddCharge();
          onExpandedKeyChange(`charge-${charges.length}`);
        }}
        accessibilityRole="button"
        accessibilityLabel="Add fee"
      >
        <Text style={styles.addLineBtnMutedText}>+ Add fee or surcharge</Text>
      </Pressable>

      <ReceiptDivider />

      <View style={styles.summaryLine}>
        <Text style={styles.summaryLabel}>Subtotal</Text>
        <Text style={styles.summaryAmount}>{formatMoney(subtotal, currency)}</Text>
      </View>

      {discounts.map((discount, index) => (
        <DiscountLineRow
          key={discount.localId}
          discount={discount}
          currency={currency}
          itemLabel={itemLabelForDiscount(discount, items)}
          resolvedAmount={computeDiscountLineAmount(
            discount,
            items,
            discounts.slice(0, index),
          )}
          isExpanded={expandedKey === `discount-${discount.localId}`}
          onToggle={() => toggle(`discount-${discount.localId}`)}
          onCollapse={collapse}
          onChange={(patch) => onDiscountChange(discount.localId, patch)}
          onRemove={() => onDiscountRemove(discount.localId)}
        />
      ))}

      <Pressable
        style={styles.addLineBtnMuted}
        onPress={() => {
          onAddDiscount();
        }}
        accessibilityRole="button"
        accessibilityLabel="Add discount"
      >
        <Text style={styles.addLineBtnMutedText}>+ Add discount</Text>
      </Pressable>

      {discountTotal > 0 ? (
        <View style={styles.summaryLine}>
          <Text style={styles.summaryLabel}>Discounts</Text>
          <Text style={[styles.summaryAmount, styles.discountAmount]}>
            −{formatMoney(discountTotal, currency)}
          </Text>
        </View>
      ) : null}
      {feesTotal > 0 ? (
        <View style={styles.summaryLine}>
          <Text style={styles.summaryLabel}>Fees</Text>
          <Text style={styles.summaryAmount}>{formatMoney(feesTotal, currency)}</Text>
        </View>
      ) : null}
      <AmountLine
        label="Tax"
        value={taxInput}
        currency={currency}
        isExpanded={expandedKey === 'tax'}
        onToggle={() => toggle('tax')}
        onCollapse={collapse}
        onChangeText={onTaxChange}
      />
      <AmountLine
        label="Tip"
        value={tipInput}
        currency={currency}
        isExpanded={expandedKey === 'tip'}
        onToggle={() => toggle('tip')}
        onCollapse={collapse}
        onChangeText={onTipChange}
      />

      <ReceiptDivider heavy />
      <View style={styles.grandTotalRow}>
        <Text style={styles.grandTotalLabel}>Total</Text>
        <Text style={styles.grandTotalValue} accessibilityLabel={`Total ${formatMoney(runningTotal, currency)}`}>
          {formatMoney(runningTotal, currency)}
        </Text>
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
    lineHeight: 17,
  },
  divider: {
    height: 1,
    backgroundColor: PAPER.line,
    marginVertical: 12,
  },
  dividerHeavy: {
    height: 2,
    backgroundColor: PAPER.ink,
    opacity: 0.12,
    marginTop: 14,
    marginBottom: 10,
  },
  lineRow: {
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 2,
  },
  lineRowWarn: {
    backgroundColor: PAPER.warnBg,
    borderWidth: 1,
    borderColor: PAPER.warnBorder,
    paddingHorizontal: 10,
    marginHorizontal: -4,
  },
  lineRowExpanded: {
    backgroundColor: '#F4F2EC',
    paddingHorizontal: 12,
    marginHorizontal: -4,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  compactLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  lineLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: PAPER.ink,
    flexShrink: 1,
  },
  lineAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: PAPER.ink,
    fontVariant: ['tabular-nums'],
  },
  checkChip: {
    backgroundColor: PAPER.warnBorder,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  checkChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: PAPER.warn,
    letterSpacing: 0.3,
  },
  expandedBlock: {
    gap: 10,
  },
  expandedNameInput: {
    fontSize: 16,
    fontWeight: '600',
    color: PAPER.ink,
    paddingVertical: 4,
  },
  expandedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  expandedPriceInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: PAPER.ink,
    borderWidth: 1,
    borderColor: PAPER.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    fontVariant: ['tabular-nums'],
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PAPER.line,
    borderRadius: 10,
    backgroundColor: '#FFF',
  },
  stepperBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: PAPER.accent,
  },
  stepperValue: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: PAPER.ink,
    fontVariant: ['tabular-nums'],
  },
  editToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 4,
  },
  doneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: PAPER.accent,
  },
  doneBtnCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: PAPER.accent,
  },
  doneBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  deleteIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.35)',
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeDelete: {
    backgroundColor: PAPER.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 52,
    marginBottom: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  addLineBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: PAPER.accent,
    borderStyle: 'dashed',
    marginTop: 4,
    marginBottom: 4,
  },
  addLineBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: PAPER.accent,
  },
  addLineBtnMuted: {
    alignSelf: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  addLineBtnMutedText: {
    fontSize: 13,
    fontWeight: '600',
    color: PAPER.inkMuted,
  },
  summaryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: PAPER.inkMuted,
    fontWeight: '500',
  },
  summaryAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: PAPER.ink,
    fontVariant: ['tabular-nums'],
  },
  summaryInput: {
    width: 100,
    fontSize: 14,
    fontWeight: '600',
    color: PAPER.ink,
    borderWidth: 1,
    borderColor: PAPER.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    textAlign: 'right',
    backgroundColor: '#FFF',
    fontVariant: ['tabular-nums'],
  },
  grandTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  grandTotalLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: PAPER.ink,
  },
  grandTotalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: PAPER.accent,
    fontVariant: ['tabular-nums'],
  },
  discountRow: {
    backgroundColor: 'rgba(5, 150, 105, 0.06)',
    borderRadius: 12,
    paddingHorizontal: 8,
    marginHorizontal: -4,
  },
  discountLabel: {
    color: '#047857',
  },
  discountAmount: {
    color: '#047857',
  },
  discountTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  discountTypeBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PAPER.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  discountTypeBtnSelected: {
    borderColor: '#047857',
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
  },
  discountTypeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: PAPER.inkMuted,
  },
  discountTypeBtnTextSelected: {
    color: '#047857',
  },
  discountValueInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: PAPER.ink,
    borderWidth: 1,
    borderColor: PAPER.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    fontVariant: ['tabular-nums'],
  },
});
