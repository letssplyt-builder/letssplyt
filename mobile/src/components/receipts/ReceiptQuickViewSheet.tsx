import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ReceiptReviewSnapshot } from '@letssplyt/shared/receipt.types';
import { BottomSheetModal } from '../layout/BottomSheetModal';
import { ReceiptReviewSlipReadOnly } from './ReceiptReviewSlipReadOnly';
import { authColors } from '../../theme/colors';

interface ReceiptQuickViewSheetProps {
  visible: boolean;
  review: ReceiptReviewSnapshot;
  onClose: () => void;
}

export function ReceiptQuickViewSheet({ visible, review, onClose }: ReceiptQuickViewSheetProps) {
  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      dismissLabel="Close receipt view"
      sheetStyle={styles.sheet}
    >
      <View style={styles.handle} />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Receipt</Text>
          <Text style={styles.subtitle}>What everyone split</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close receipt"
          onPress={onClose}
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ReceiptReviewSlipReadOnly review={review} />
      </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: authColors.gradientMid,
    maxHeight: '88%',
    paddingTop: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: authColors.glassBorder,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: authColors.textOnDark,
  },
  subtitle: {
    fontSize: 13,
    color: authColors.textOnDarkMuted,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: authColors.glass,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    color: authColors.textOnDarkMuted,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 8,
  },
});
