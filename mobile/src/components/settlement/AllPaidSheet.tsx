import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { IOwePaymentHandle } from '@letssplyt/shared/settlement.types';
import type { PaymentProvider } from '@letssplyt/shared/profile.types';
import { CenteredCardModal, centeredCardModalStyles as shared } from '../layout/CenteredCardModal';
import type { SelfReportPaymentMethod } from '../../services/settlement.service';
import { buildAllPaidMethodOptions } from '../../utils/settlementPayment';
import { providerLabel, providerVisual } from '../../utils/profile';

interface AllPaidSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  handles: IOwePaymentHandle[];
  loading?: boolean;
  onConfirm: (method: SelfReportPaymentMethod) => void;
}

export function AllPaidSheet({
  visible,
  onClose,
  title = 'All paid',
  description = 'Which payment method did you use?',
  handles,
  loading = false,
  onConfirm,
}: AllPaidSheetProps) {
  const options = useMemo(() => buildAllPaidMethodOptions(handles), [handles]);
  const [selectedId, setSelectedId] = useState<string>(() => options[0]?.id ?? 'cash-other');

  useEffect(() => {
    if (!visible) return;
    setSelectedId(options[0]?.id ?? 'cash-other');
  }, [visible, options]);

  const selected = options.find((row) => row.id === selectedId);

  const selectOption = (optionId: string) => {
    setSelectedId(optionId);
  };

  return (
    <CenteredCardModal visible={visible} onClose={onClose} dismissLabel="Dismiss all paid sheet">
      <View style={shared.header}>
        <View style={shared.headerText}>
          <Text style={shared.title}>{title}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          hitSlop={12}
          style={shared.closeBtn}
        >
          <Text style={shared.closeIcon}>✕</Text>
        </Pressable>
      </View>

      <Text style={shared.hint}>{description}</Text>

      <View style={styles.optionList}>
        {options.map((option) => {
          const isSelected = option.id === selectedId;
          const isCashOther = option.id === 'cash-other';
          const provider = isCashOther ? null : (option.id as PaymentProvider);
          const visual = provider ? providerVisual(provider) : null;
          const label = isCashOther ? 'Cash/Other' : providerLabel(provider!);

          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ selected: isSelected }}
              onPress={() => selectOption(option.id)}
              style={[styles.optionRow, isSelected && shared.optionRowSelected]}
            >
              <View style={[shared.check, isSelected && shared.checkSelected]}>
                {isSelected ? <Text style={shared.checkMark}>✓</Text> : null}
              </View>
              {visual ? (
                <View style={[styles.badge, { backgroundColor: visual.color }]}>
                  <Text style={styles.badgeText}>{visual.badge}</Text>
                </View>
              ) : (
                <View style={styles.cashBadge}>
                  <Text style={styles.cashBadgeText}>$</Text>
                </View>
              )}
              <Text style={shared.optionLabelFlex}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="OK"
        disabled={!selected || loading}
        onPress={() => {
          if (selected) onConfirm(selected.method);
        }}
        style={[shared.okBtn, (!selected || loading) && shared.okBtnDisabled]}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={shared.okText}>OK</Text>
        )}
      </Pressable>
    </CenteredCardModal>
  );
}

const styles = StyleSheet.create({
  optionList: {
    gap: 8,
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E0DDFF',
    backgroundColor: '#F8F7FF',
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  cashBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#64748B',
  },
  cashBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
