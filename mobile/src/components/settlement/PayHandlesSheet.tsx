import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { IOwePaymentHandle } from '@letssplyt/shared/settlement.types';
import { CenteredCardModal } from '../layout/CenteredCardModal';
import { useCenteredCardModalStyles } from '../../hooks/useCenteredCardModalStyles';
import { useTheme } from '../../theme/ThemeContext';
import { formatMoney } from '../../utils/events';
import { providerLabel, providerVisual } from '../../utils/profile';
import { buildHandlePaymentOptions, openPaymentDeepLink } from '../../utils/settlementPayment';

interface PayHandlesSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  amount: number;
  currency: string;
  payerDisplayName: string;
  eventTitleForLink: string;
  handles: IOwePaymentHandle[];
}

export function PayHandlesSheet({
  visible,
  onClose,
  title,
  subtitle,
  amount,
  currency,
  payerDisplayName,
  eventTitleForLink,
  handles,
}: PayHandlesSheetProps) {
  const { theme } = useTheme();
  const shared = useCenteredCardModalStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        eventLine: {
          fontSize: 13,
          fontWeight: '600',
          color: theme.ink2,
          marginTop: 4,
          lineHeight: 18,
          fontFamily: theme.fontBody,
        },
        optionScroll: {
          maxHeight: 320,
        },
        optionScrollContent: {
          paddingBottom: 4,
        },
        payCard: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingVertical: 14,
          paddingHorizontal: 14,
          borderRadius: theme.radiusSm,
          borderWidth: 1.5,
          borderColor: theme.line,
          backgroundColor: theme.modalInset,
          minHeight: 72,
          marginBottom: 8,
        },
        badge: {
          width: 44,
          height: 44,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        badgeText: {
          color: theme.ink,
          fontWeight: '800',
          fontSize: 13,
        },
        payBody: {
          flex: 1,
          minWidth: 0,
        },
        payProvider: {
          fontSize: 16,
          fontWeight: '800',
          color: theme.ink,
          lineHeight: 22,
          fontFamily: theme.fontBody,
        },
        payHandle: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.ink2,
          marginTop: 4,
          lineHeight: 20,
          fontFamily: theme.fontBody,
        },
      }),
    [theme],
  );
  const paymentOptions = buildHandlePaymentOptions(handles, amount, eventTitleForLink);
  const acceptsLine = `${payerDisplayName} accepts payment via`;

  return (
    <CenteredCardModal visible={visible} onClose={onClose} dismissLabel="Dismiss pay sheet">
      <View style={shared.header}>
        <View style={shared.headerText}>
          <Text style={shared.title} numberOfLines={2}>{title}</Text>
          <Text style={shared.titleAccent}>{formatMoney(amount, currency)}</Text>
          {subtitle ? (
            <Text style={styles.eventLine} numberOfLines={2}>{subtitle}</Text>
          ) : null}
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

      <Text style={shared.subtitle}>{acceptsLine}</Text>
      <Text style={shared.hint}>Tap a payment option to open your app.</Text>

      <ScrollView
        style={styles.optionScroll}
        contentContainerStyle={styles.optionScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {paymentOptions.length === 0 ? (
          <Text style={shared.empty}>No payment handles on file for this payer.</Text>
        ) : (
          paymentOptions.map((option) => {
            const visual = providerVisual(option.provider);
            return (
              <Pressable
                key={option.provider}
                accessibilityRole="button"
                accessibilityLabel={`Pay via ${option.label} — ${option.handleDisplay}`}
                onPress={() =>
                  void openPaymentDeepLink(option.url, option.label, option.webFallbackUrl)
                }
                style={styles.payCard}
              >
                <View style={[styles.badge, { backgroundColor: visual.color }]}>
                  <Text style={styles.badgeText}>{visual.badge}</Text>
                </View>
                <View style={styles.payBody}>
                  <Text style={styles.payProvider}>{providerLabel(option.provider)}</Text>
                  <Text style={styles.payHandle} numberOfLines={2} ellipsizeMode="middle">
                    {option.handleDisplay}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </CenteredCardModal>
  );
}
