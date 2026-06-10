import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../theme/colors';
import { avatarColorFromName, formatSplitMoney } from '../../screens/splits/splitEntry.utils';

interface ParticipantOption {
  id: string;
  display_name: string;
}

interface ItemAssignPopupProps {
  visible: boolean;
  itemName: string;
  itemPrice: number;
  currency: string;
  participants: ParticipantOption[];
  selectedIds: string[];
  onClose: () => void;
  onConfirm: (participantIds: string[]) => void;
}

export function ItemAssignPopup({
  visible,
  itemName,
  itemPrice,
  currency,
  participants,
  selectedIds,
  onClose,
  onConfirm,
}: ItemAssignPopupProps) {
  const [pendingIds, setPendingIds] = useState<string[]>(selectedIds);

  useEffect(() => {
    if (visible) {
      setPendingIds(selectedIds);
    }
  }, [visible, selectedIds]);

  const toggleMember = (participantId: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPendingIds((prev) =>
      prev.includes(participantId)
        ? prev.filter((id) => id !== participantId)
        : [...prev, participantId],
    );
  };

  const handleConfirm = () => {
    onConfirm(pendingIds);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel="Cancel assignment"
          onPress={onClose}
        />
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.itemName} numberOfLines={2}>{itemName}</Text>
              <Text style={styles.itemPrice}>{formatSplitMoney(itemPrice, currency)}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel without assigning"
              onPress={onClose}
              hitSlop={12}
              style={styles.closeBtn}
            >
              <Text style={styles.closeIcon}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.subtitle}>Who shared this item?</Text>
          <Text style={styles.hint}>Select everyone who should pay for it.</Text>

          <View style={styles.memberList}>
            {participants.map((participant) => {
              const selected = pendingIds.includes(participant.id);
              const color = avatarColorFromName(participant.display_name);
              return (
                <Pressable
                  key={participant.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={participant.display_name}
                  onPress={() => toggleMember(participant.id)}
                  style={[styles.memberRow, selected && styles.memberRowSelected]}
                >
                  <View style={[styles.avatar, { backgroundColor: color }]}>
                    <Text style={styles.avatarText}>
                      {participant.display_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {participant.display_name}
                  </Text>
                  <View style={[styles.check, selected && styles.checkSelected]}>
                    {selected ? <Text style={styles.checkMark}>✓</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="OK"
            onPress={handleConfirm}
            style={styles.okBtn}
          >
            <Text style={styles.okText}>OK</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 61, 69, 0.55)',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#0B3D45',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  headerText: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  closeBtn: {
    padding: 4,
  },
  closeIcon: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textMuted,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 14,
    lineHeight: 18,
  },
  memberList: {
    gap: 8,
    marginBottom: 16,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  memberRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  memberName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  okBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
});
