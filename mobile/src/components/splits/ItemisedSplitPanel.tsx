import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatSplitMoney, type SplitPricedItem } from '../../screens/splits/splitEntry.utils';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';
import { ItemAssignPopup } from './ItemAssignPopup';

interface ParticipantOption {
  id: string;
  display_name: string;
}

interface ItemisedSplitPanelProps {
  items: SplitPricedItem[];
  currency: string;
  assignedCount: number;
  participants: ParticipantOption[];
  assignments: Map<string, string[]>;
  showBillDiscountNote?: boolean;
  onAssignItem: (itemId: string, participantIds: string[]) => void;
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    panel: {
      gap: 10,
    },
    statsCard: {
      backgroundColor: theme.surfaceStrong,
      borderRadius: theme.radiusSm,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.line,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    statsEyebrow: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.ink3,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
      fontFamily: theme.fontBody,
    },
    statsValue: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.ink,
      marginTop: 2,
      fontFamily: theme.fontDisplay,
    },
    statsMuted: {
      color: theme.ink3,
      fontWeight: '600',
    },
    ringOuter: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: theme.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringInner: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringInnerDone: {
      backgroundColor: theme.accentSoft,
    },
    ringText: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.accent,
      fontFamily: theme.fontDisplay,
    },
    statsTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.line,
      overflow: 'hidden',
    },
    statsFill: {
      height: '100%',
      borderRadius: 3,
    },
    statsFillPending: {
      backgroundColor: theme.warn,
    },
    statsFillDone: {
      backgroundColor: theme.good,
    },
    listHint: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.ink2,
      marginBottom: 2,
      fontFamily: theme.fontBody,
    },
    billNote: {
      fontSize: 12,
      color: theme.ink3,
      lineHeight: 17,
      fontFamily: theme.fontBody,
    },
    itemList: {
      gap: 8,
    },
    itemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surfaceStrong,
      borderRadius: theme.radiusSm,
      paddingVertical: 10,
      paddingHorizontal: 12,
      gap: 8,
      borderWidth: 1,
      borderColor: theme.line,
    },
    itemCardUnassigned: {
      borderColor: theme.warn,
      backgroundColor: theme.warnSoft,
    },
    itemDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    itemDotOk: {
      backgroundColor: theme.good,
    },
    itemDotWarn: {
      backgroundColor: theme.warn,
    },
    itemBody: {
      flex: 1,
      minWidth: 0,
    },
    itemName: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    itemMeta: {
      fontSize: 11,
      fontWeight: '500',
      color: theme.ink3,
      marginTop: 1,
      fontFamily: theme.fontBody,
    },
    itemDiscountMeta: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.good,
      marginTop: 2,
      fontFamily: theme.fontBody,
    },
    priceCol: {
      alignItems: 'flex-end',
      gap: 2,
    },
    itemPriceGross: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.ink3,
      textDecorationLine: 'line-through',
      fontFamily: theme.fontDisplay,
    },
    itemPrice: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.accent,
      fontFamily: theme.fontDisplay,
    },
  });
}

export function ItemisedSplitPanel({
  items,
  currency,
  assignedCount,
  participants,
  assignments,
  showBillDiscountNote = false,
  onAssignItem,
}: ItemisedSplitPanelProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const allAssigned = assignedCount >= items.length && items.length > 0;
  const progress = items.length > 0 ? assignedCount / items.length : 0;

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const activeItem = items.find((item) => item.id === activeItemId);

  return (
    <View style={styles.panel}>
      <View style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View>
            <Text style={styles.statsEyebrow}>Progress</Text>
            <Text style={styles.statsValue}>
              {assignedCount}<Text style={styles.statsMuted}> / {items.length}</Text> assigned
            </Text>
          </View>
          <View style={styles.ringOuter}>
            <View style={[styles.ringInner, allAssigned && styles.ringInnerDone]}>
              <Text style={styles.ringText}>{Math.round(progress * 100)}%</Text>
            </View>
          </View>
        </View>
        <View style={styles.statsTrack}>
          <View
            style={[
              styles.statsFill,
              allAssigned ? styles.statsFillDone : styles.statsFillPending,
              { width: `${Math.min(100, progress * 100)}%` },
            ]}
          />
        </View>
      </View>

      <Text style={styles.listHint}>Tap a line item to choose who shared it.</Text>
      {showBillDiscountNote ? (
        <Text style={styles.billNote}>
          Bill discounts are shared by each person&apos;s item share after product discounts.
        </Text>
      ) : null}

      <View style={styles.itemList}>
        {items.map((item) => {
          const assignedIds = assignments.get(item.id) ?? [];
          const isAssigned = assignedIds.length > 0;
          const isUnassigned = !isAssigned;
          const assigneeNames = assignedIds
            .map((id) => participants.find((p) => p.id === id)?.display_name)
            .filter(Boolean);
          const hasDiscount = item.lineDiscount > 0;

          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${formatSplitMoney(item.netPrice, currency)}${hasDiscount ? ` after ${formatSplitMoney(item.lineDiscount, currency)} off` : ''}${isAssigned ? `, assigned to ${assigneeNames.join(', ')}` : ', not assigned'}`}
              onPress={() => setActiveItemId(item.id)}
              style={[styles.itemCard, isUnassigned && styles.itemCardUnassigned]}
            >
              <View style={[styles.itemDot, isAssigned ? styles.itemDotOk : styles.itemDotWarn]} />
              <View style={styles.itemBody}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemMeta} numberOfLines={1}>
                  {isAssigned ? assigneeNames.join(', ') : 'Tap to assign'}
                </Text>
                {hasDiscount ? (
                  <Text style={styles.itemDiscountMeta} numberOfLines={1}>
                    −{formatSplitMoney(item.lineDiscount, currency)} off
                  </Text>
                ) : null}
              </View>
              <View style={styles.priceCol}>
                {hasDiscount ? (
                  <Text style={styles.itemPriceGross}>
                    {formatSplitMoney(item.price, currency)}
                  </Text>
                ) : null}
                <Text style={styles.itemPrice}>
                  {formatSplitMoney(item.netPrice, currency)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {activeItem ? (
        <ItemAssignPopup
          visible={activeItemId !== null}
          itemName={activeItem.name}
          itemPrice={activeItem.price}
          lineDiscount={activeItem.lineDiscount}
          netPrice={activeItem.netPrice}
          currency={currency}
          participants={participants}
          selectedIds={assignments.get(activeItem.id) ?? []}
          onClose={() => setActiveItemId(null)}
          onConfirm={(participantIds) => {
            onAssignItem(activeItem.id, participantIds);
            setActiveItemId(null);
          }}
        />
      ) : null}
    </View>
  );
}
