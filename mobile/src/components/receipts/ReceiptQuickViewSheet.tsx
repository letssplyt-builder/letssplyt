import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ReceiptReviewSnapshot } from '@letssplyt/shared/receipt.types';
import {
  CenteredCardModal,
  centeredCardModalStyles,
} from '../layout/CenteredCardModal';
import { ReceiptReviewSlipReadOnly } from './ReceiptReviewSlipReadOnly';
import { colors } from '../../theme/colors';

interface ReceiptQuickViewSheetProps {
  visible: boolean;
  review: ReceiptReviewSnapshot;
  onClose: () => void;
}

export function ReceiptQuickViewSheet({ visible, review, onClose }: ReceiptQuickViewSheetProps) {
  return (
    <CenteredCardModal visible={visible} onClose={onClose} dismissLabel="Close receipt view">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Receipt</Text>
          <Text style={styles.hint}>What everyone split</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close receipt"
          onPress={onClose}
          hitSlop={12}
          style={styles.closeBtn}
        >
          <Text style={styles.closeIcon}>✕</Text>
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

const styles = StyleSheet.create({
  header: {
    ...centeredCardModalStyles.header,
  },
  headerText: {
    ...centeredCardModalStyles.headerText,
  },
  title: {
    ...centeredCardModalStyles.title,
    marginBottom: 0,
  },
  hint: {
    ...centeredCardModalStyles.hint,
    marginBottom: 0,
    marginTop: 4,
  },
  closeBtn: {
    ...centeredCardModalStyles.closeBtn,
  },
  closeIcon: {
    ...centeredCardModalStyles.closeIcon,
  },
  scroll: {
    maxHeight: 420,
  },
  scrollContent: {
    paddingBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
