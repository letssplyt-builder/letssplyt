import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { avatarColorFromName, formatSplitMoney } from '../../screens/splits/splitEntry.utils';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

interface ParticipantOption {
  id: string;
  display_name: string;
}

interface ItemAssignPopupProps {
  visible: boolean;
  itemName: string;
  itemPrice: number;
  lineDiscount?: number;
  netPrice?: number;
  currency: string;
  participants: ParticipantOption[];
  selectedIds: string[];
  onClose: () => void;
  onConfirm: (participantIds: string[]) => void;
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.68)',
    },
    card: {
      backgroundColor: theme.modalSurface,
      borderRadius: theme.radius,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.line,
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
      color: theme.ink,
      marginBottom: 4,
      fontFamily: theme.fontDisplay,
    },
    itemPrice: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.accent,
      fontFamily: theme.fontDisplay,
    },
    itemPriceMath: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.ink2,
      marginTop: 4,
      fontFamily: theme.fontBody,
    },
    closeBtn: {
      padding: 4,
    },
    closeIcon: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.ink3,
    },
    subtitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.ink,
      marginBottom: 4,
      fontFamily: theme.fontBody,
    },
    hint: {
      fontSize: 13,
      color: theme.ink3,
      marginBottom: 14,
      lineHeight: 18,
      fontFamily: theme.fontBody,
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
      borderRadius: theme.radiusSm,
      borderWidth: 1.5,
      borderColor: theme.line,
      backgroundColor: theme.modalInset,
    },
    memberRowSelected: {
      borderColor: theme.accent,
      backgroundColor: theme.accentSoft,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: theme.ink,
      fontWeight: '800',
      fontSize: 15,
    },
    memberName: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    check: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.line,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.modalInset,
    },
    checkSelected: {
      borderColor: theme.accent,
      backgroundColor: theme.accent,
    },
    checkMark: {
      color: theme.accentInk,
      fontSize: 14,
      fontWeight: '800',
    },
    okBtn: {
      height: 48,
      borderRadius: theme.radiusSm,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    okText: {
      color: theme.accentInk,
      fontSize: 17,
      fontWeight: '800',
      fontFamily: theme.fontBody,
    },
  });
}

export function ItemAssignPopup({
  visible,
  itemName,
  itemPrice,
  lineDiscount = 0,
  netPrice,
  currency,
  participants,
  selectedIds,
  onClose,
  onConfirm,
}: ItemAssignPopupProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [pendingIds, setPendingIds] = useState<string[]>(selectedIds);
  const resolvedNet = netPrice ?? Number(Math.max(0, itemPrice - lineDiscount).toFixed(2));
  const hasDiscount = lineDiscount > 0;

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
              <Text style={styles.itemPrice}>
                {formatSplitMoney(resolvedNet, currency)}
              </Text>
              {hasDiscount ? (
                <Text style={styles.itemPriceMath}>
                  {formatSplitMoney(itemPrice, currency)} −{' '}
                  {formatSplitMoney(lineDiscount, currency)} ={' '}
                  {formatSplitMoney(resolvedNet, currency)}
                </Text>
              ) : null}
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
