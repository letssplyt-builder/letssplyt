import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { formatSplitMoney } from '../../screens/splits/splitEntry.utils';
import { ItemAssignPopup } from './ItemAssignPopup';

interface LineItem {
  id: string;
  name: string;
  price: number;
}

interface ParticipantOption {
  id: string;
  display_name: string;
}

interface ItemisedSplitPanelProps {
  items: LineItem[];
  currency: string;
  assignedCount: number;
  participants: ParticipantOption[];
  assignments: Map<string, string[]>;
  onAssignItem: (itemId: string, participantIds: string[]) => void;
}

export function ItemisedSplitPanel({
  items,
  currency,
  assignedCount,
  participants,
  assignments,
  onAssignItem,
}: ItemisedSplitPanelProps) {
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

      <View style={styles.itemList}>
        {items.map((item) => {
          const assignedIds = assignments.get(item.id) ?? [];
          const isAssigned = assignedIds.length > 0;
          const isUnassigned = !isAssigned;
          const assigneeNames = assignedIds
            .map((id) => participants.find((p) => p.id === id)?.display_name)
            .filter(Boolean);

          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${formatSplitMoney(item.price, currency)}${isAssigned ? `, assigned to ${assigneeNames.join(', ')}` : ', not assigned'}`}
              onPress={() => setActiveItemId(item.id)}
              style={[styles.itemCard, isUnassigned && styles.itemCardUnassigned]}
            >
              <View style={[styles.itemDot, isAssigned ? styles.itemDotOk : styles.itemDotWarn]} />
              <View style={styles.itemBody}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemMeta} numberOfLines={1}>
                  {isAssigned ? assigneeNames.join(', ') : 'Tap to assign'}
                </Text>
              </View>
              <Text style={styles.itemPrice}>{formatSplitMoney(item.price, currency)}</Text>
            </Pressable>
          );
        })}
      </View>

      {activeItem ? (
        <ItemAssignPopup
          visible={activeItemId !== null}
          itemName={activeItem.name}
          itemPrice={activeItem.price}
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

const styles = StyleSheet.create({
  panel: {
    gap: 10,
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#0B3D45',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
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
    color: colors.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  statsValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  statsMuted: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  ringOuter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInnerDone: {
    backgroundColor: '#D1FAE5',
  },
  ringText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  statsTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  statsFill: {
    height: '100%',
    borderRadius: 3,
  },
  statsFillPending: {
    backgroundColor: '#FBBF24',
  },
  statsFillDone: {
    backgroundColor: '#34D399',
  },
  listHint: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.78)',
    marginBottom: 2,
  },
  itemList: {
    gap: 8,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#0B3D45',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  itemCardUnassigned: {
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
  },
  itemDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  itemDotOk: {
    backgroundColor: '#34D399',
  },
  itemDotWarn: {
    backgroundColor: '#F59E0B',
  },
  itemBody: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  itemMeta: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
    marginTop: 1,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
});
