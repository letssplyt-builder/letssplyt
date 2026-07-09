import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { ScreenTopBar } from '../../components/navigation/ScreenTopBar';
import { PrimaryButton } from '../../components/PrimaryButton';
import { splitActionBarFooterStyle } from '../../constants/layout';
import { useAppInsets } from '../../hooks/useAppInsets';
import type { EventsStackParamList } from '../../navigation/types';
import {
  fetchMessagePreviews,
  sendEventMessages,
  type MessagePreviewItem,
} from '../../services/messages.service';
import { isApiRequestError } from '../../services/api';
import {
  avatarColorFromName,
  formatSplitMoney,
} from '../splits/splitEntry.utils';
import { useSplitStore } from '../../store/splitStore';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';
import { completeEventWithoutSms } from '../../utils/messageFlow';

type Props = NativeStackScreenProps<EventsStackParamList, 'MessagePreview'>;

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    layout: {
      paddingHorizontal: 0,
    },
    scroll: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    hint: {
      fontSize: 12,
      color: theme.ink2,
      marginBottom: 12,
      fontFamily: theme.fontBody,
    },
    pickerRow: {
      gap: 12,
      paddingBottom: 16,
    },
    pickerItem: {
      alignItems: 'center',
      width: 56,
    },
    pickerAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    pickerAvatarSelected: {
      width: 50,
      height: 50,
      borderRadius: 25,
      borderWidth: 3,
    },
    pickerAvatarText: {
      color: theme.ink,
      fontWeight: '800',
      fontSize: 16,
    },
    pickerName: {
      marginTop: 6,
      fontSize: 10,
      color: theme.ink3,
      textAlign: 'center',
      fontFamily: theme.fontBody,
    },
    viewedDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.good,
      marginTop: 4,
    },
    card: {
      backgroundColor: theme.surfaceStrong,
      borderRadius: theme.radius,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.line,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 16,
      paddingBottom: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.line,
    },
    cardAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardAvatarText: {
      color: theme.ink,
      fontWeight: '800',
      fontSize: 17,
    },
    cardHeaderText: {
      flex: 1,
    },
    cardName: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    cardAmount: {
      fontSize: 12,
      color: theme.ink2,
      marginTop: 2,
      fontFamily: theme.fontBody,
    },
    channelPill: {
      backgroundColor: theme.accentSoft,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.radiusSm,
    },
    channelPillText: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.accent,
      fontFamily: theme.fontBody,
    },
    breakdownLinkCard: {
      borderRadius: theme.radiusSm,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
      padding: 14,
      marginBottom: 14,
    },
    breakdownLinkCardPressed: {
      opacity: 0.92,
    },
    breakdownLinkTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.ink,
      marginBottom: 4,
      fontFamily: theme.fontBody,
    },
    breakdownLinkSubtitle: {
      fontSize: 12,
      color: theme.ink2,
      lineHeight: 18,
      marginBottom: 8,
      fontFamily: theme.fontBody,
    },
    breakdownLinkUrl: {
      fontSize: 12,
      color: theme.accent,
      fontWeight: '600',
      fontFamily: theme.fontBody,
    },
    messageText: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.ink2,
      marginBottom: 14,
      fontFamily: theme.fontBody,
    },
    linksSection: {
      gap: 8,
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: theme.radiusSm,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
    },
    linkIcon: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    linkIconText: {
      color: theme.accentInk,
      fontWeight: '700',
      fontSize: 11,
    },
    linkLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
    linkMuted: {
      fontSize: 11,
      color: theme.ink3,
      fontFamily: theme.fontBody,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    loadingText: {
      marginTop: 12,
      color: theme.ink2,
      fontSize: 15,
      fontFamily: theme.fontBody,
    },
    errorText: {
      color: theme.bad,
      fontSize: 15,
      textAlign: 'center',
      marginBottom: 12,
      fontFamily: theme.fontBody,
    },
    retryBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      backgroundColor: theme.surfaceStrong,
      borderRadius: theme.radiusSm,
      borderWidth: 1,
      borderColor: theme.line,
    },
    retryText: {
      color: theme.accent,
      fontWeight: '700',
      fontFamily: theme.fontBody,
    },
    sendErrorBanner: {
      backgroundColor: theme.warnSoft,
      borderRadius: theme.radiusSm,
      borderWidth: 1,
      borderColor: theme.warn,
      padding: 12,
      marginBottom: 12,
    },
    sendErrorText: {
      color: theme.bad,
      fontSize: 14,
      fontWeight: '600',
      fontFamily: theme.fontBody,
    },
    sendErrorAction: {
      marginTop: 4,
      color: theme.ink2,
      fontSize: 12,
      fontWeight: '600',
      fontFamily: theme.fontBody,
    },
  });
}

export function MessagePreviewScreen({ navigation, route }: Props) {
  const { eventId } = route.params;
  const { rawBottom } = useAppInsets();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [previews, setPreviews] = useState<MessagePreviewItem[]>([]);
  const storeCurrency = useSplitStore((s) =>
    s.eventId === eventId ? s.currency : 'USD',
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const autoCompleteRef = useRef(false);
  const loadPreviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchMessagePreviews(eventId);
      setPreviews(response.previews);
      if (response.previews.length > 0) {
        setViewedIds(new Set([response.previews[0].participant_id]));
        setSelectedIndex(0);
      }
    } catch (err) {
      const message = isApiRequestError(err)
        ? err.message
        : "Couldn't load message previews. Try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadPreviews();
  }, [loadPreviews]);

  useEffect(() => {
    if (loading || error || previews.length > 0 || autoCompleteRef.current) {
      return;
    }

    autoCompleteRef.current = true;
    setSending(true);
    void completeEventWithoutSms(navigation, eventId).catch(() => {
      autoCompleteRef.current = false;
      setSendError('Could not complete the event. Tap to retry.');
      setSending(false);
    });
  }, [error, eventId, loading, navigation, previews.length]);

  const selected = previews[selectedIndex];

  const amountLabel = useMemo(() => {
    if (!selected) return '';
    return formatSplitMoney(selected.amount_owed, storeCurrency);
  }, [storeCurrency, selected]);

  const selectParticipant = (index: number) => {
    setSelectedIndex(index);
    const participantId = previews[index]?.participant_id;
    if (participantId) {
      setViewedIds((prev) => new Set(prev).add(participantId));
    }
  };

  const handleSendAll = async () => {
    setSending(true);
    setSendError(null);
    try {
      const result = await sendEventMessages(eventId);
      navigation.replace('DeliveryTracking', {
        eventId,
        sendResults: result.results,
      });
    } catch (err) {
      const message = isApiRequestError(err)
        ? err.message
        : 'Messages failed to send. Tap to retry.';
      setSendError(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthGradientLayout
      contentStyle={styles.layout}
      footerStyle={splitActionBarFooterStyle(rawBottom)}
      footer={
        <PrimaryButton
          label="Send to all →"
          loading={sending}
          disabled={loading || Boolean(error) || sending || previews.length === 0}
          onPress={() => void handleSendAll()}
          accessibilityLabel="Send to all"
          variant="inverse"
        />
      }
    >
      <StatusBar style="light" />
      <ScreenTopBar title="Preview" onBack={() => navigation.goBack()} />

      {loading || (sending && previews.length === 0) ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.loadingText}>
            {previews.length === 0 ? 'Completing event…' : 'Crafting your messages…'}
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void loadPreviews()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {sendError ? (
            <Pressable onPress={() => void handleSendAll()} style={styles.sendErrorBanner}>
              <Text style={styles.sendErrorText}>{sendError}</Text>
              <Text style={styles.sendErrorAction}>Tap to retry</Text>
            </Pressable>
          ) : null}
          <Text style={styles.hint}>Optional — tap a member to preview their message</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pickerRow}
          >
            {previews.map((row, index) => {
              const isSelected = index === selectedIndex;
              const isViewed = viewedIds.has(row.participant_id);
              const avatarColor = avatarColorFromName(row.display_name);
              return (
                <Pressable
                  key={row.participant_id}
                  onPress={() => selectParticipant(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Preview message for ${row.display_name}`}
                  style={styles.pickerItem}
                >
                  <View
                    style={[
                      styles.pickerAvatar,
                      { backgroundColor: avatarColor },
                      isSelected && styles.pickerAvatarSelected,
                      isSelected && { borderColor: avatarColor },
                    ]}
                  >
                    <Text style={styles.pickerAvatarText}>
                      {row.display_name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.pickerName,
                      isSelected && { color: avatarColor, fontWeight: '700' },
                    ]}
                  >
                    {row.display_name}
                  </Text>
                  {isViewed ? <View style={styles.viewedDot} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {selected ? (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.cardAvatar,
                    { backgroundColor: avatarColorFromName(selected.display_name) },
                  ]}
                >
                  <Text style={styles.cardAvatarText}>
                    {selected.display_name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardName}>{selected.display_name}</Text>
                  <Text style={styles.cardAmount}>{amountLabel}</Text>
                </View>
                <View style={styles.channelPill}>
                  <Text style={styles.channelPillText}>
                    {selected.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                  </Text>
                </View>
              </View>

              {selected.breakdown_url ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`Open split breakdown for ${selected.display_name}`}
                  onPress={() => Linking.openURL(selected.breakdown_url!)}
                  style={({ pressed }) => [
                    styles.breakdownLinkCard,
                    pressed && styles.breakdownLinkCardPressed,
                  ]}
                >
                  <Text style={styles.breakdownLinkTitle}>Split breakdown</Text>
                  <Text style={styles.breakdownLinkSubtitle}>
                    Opens the same table guests see in SMS — your row highlighted.
                  </Text>
                  <Text style={styles.breakdownLinkUrl} numberOfLines={2}>
                    {selected.breakdown_url}
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.breakdownLinkCard}>
                  <Text style={styles.breakdownLinkSubtitle}>Breakdown link unavailable</Text>
                </View>
              )}

              <Text style={styles.messageText}>{selected.message_text}</Text>

              {selected.payment_links.length > 0 ? (
                <View style={styles.linksSection}>
                  {selected.payment_links.map((link) => (
                    <View key={`${link.provider}-${link.url}`} style={styles.linkRow}>
                      <View style={styles.linkIcon}>
                        <Text style={styles.linkIconText}>
                          {link.label.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.linkLabel}>{link.label}</Text>
                      <Text style={styles.linkMuted}>Preview</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

        </ScrollView>
      )}
    </AuthGradientLayout>
  );
}
