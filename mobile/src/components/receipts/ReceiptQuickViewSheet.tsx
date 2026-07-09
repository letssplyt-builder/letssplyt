import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ReceiptReviewSnapshot } from '@letssplyt/shared/receipt.types';
import { CenteredCardModal } from '../layout/CenteredCardModal';
import { useCenteredCardModalStyles } from '../../hooks/useCenteredCardModalStyles';
import { ReceiptReviewSlipReadOnly } from './ReceiptReviewSlipReadOnly';

interface ReceiptQuickViewSheetProps {
  visible: boolean;
  review: ReceiptReviewSnapshot;
  onClose: () => void;
}

export function ReceiptQuickViewSheet({ visible, review, onClose }: ReceiptQuickViewSheetProps) {
  const shared = useCenteredCardModalStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        title: {
          ...shared.title,
          marginBottom: 0,
        },
        hint: {
          ...shared.hint,
          marginBottom: 0,
          marginTop: 4,
        },
        scroll: {
          maxHeight: 420,
        },
        scrollContent: {
          paddingBottom: 4,
        },
      }),
    [shared],
  );

  return (
    <CenteredCardModal visible={visible} onClose={onClose} dismissLabel="Close receipt view">
      <View style={shared.header}>
        <View style={shared.headerText}>
          <Text style={styles.title}>Receipt</Text>
          <Text style={styles.hint}>What everyone split</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close receipt"
          onPress={onClose}
          hitSlop={12}
          style={shared.closeBtn}
        >
          <Text style={shared.closeIcon}>✕</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ReceiptReviewSlipReadOnly review={review} />
      </ScrollView>
    </CenteredCardModal>
  );
}
