import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { PrimaryButton } from '../../components/PrimaryButton';
import { splitActionBarFooterStyle } from '../../constants/layout';
import { useAppInsets } from '../../hooks/useAppInsets';
import type { EventsStackParamList } from '../../navigation/types';
import {
  fetchMessagePreviews,
  type MessagePreviewItem,
} from '../../services/messages.service';
import { isApiRequestError } from '../../services/api';
import {
  avatarColorFromName,
  formatSplitMoney,
} from '../splits/splitEntry.utils';
import { useSplitStore } from '../../store/splitStore';
import { useEventStore } from '../../store/eventStore';
import { resolveSplitEntryMode } from '../../utils/eventSplitFooter';
import { authColors, colors } from '../../theme/colors';

type Props = NativeStackScreenProps<EventsStackParamList, 'MessagePreview'>;

export function MessagePreviewScreen({ navigation, route }: Props) {
  const { eventId } = route.params;
  const { rawBottom } = useAppInsets();
  const [previews, setPreviews] = useState<MessagePreviewItem[]>([]);
  const storeCurrency = useSplitStore((s) =>
    s.eventId === eventId ? s.currency : 'USD',
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [imageLoading, setImageLoading] = useState(false);

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

  const selected = previews[selectedIndex];
  const allViewed = previews.length > 0 && viewedIds.size >= previews.length;

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
    setImageLoading(Boolean(previews[index]?.split_image_url));
  };

  return (
    <AuthGradientLayout
      footerStyle={splitActionBarFooterStyle(rawBottom)}
      footer={
        <PrimaryButton
          label="Send to all →"
          disabled={!allViewed || loading || Boolean(error)}
          onPress={() => {
            // Delivery + Twilio send wired in E08-S05.
          }}
          accessibilityLabel="Send to all"
          variant="inverse"
        />
      }
    >
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Preview</Text>
        <Pressable
          onPress={() => {
            const detail = useEventStore.getState().currentEvent;
            const mode =
              detail?.event.id === eventId
                ? resolveSplitEntryMode(
                    detail.event.split_mode,
                    detail.event.ai_stage,
                    Boolean(detail.receipt_review),
                  )
                : 'manual';
            navigation.navigate('SplitEntry', { eventId, mode });
          }}
          accessibilityRole="button"
          accessibilityLabel="Edit split"
        >
          <Text style={styles.editLink}>Edit</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={authColors.ctaSurface} />
          <Text style={styles.loadingText}>Crafting your messages…</Text>
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
          <Text style={styles.hint}>Tap each member to preview their message</Text>

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

              <View style={styles.imageWrap}>
                {selected.split_image_url ? (
                  <>
                    <Image
                      source={{ uri: selected.split_image_url }}
                      style={styles.splitImage}
                      resizeMode="contain"
                      accessibilityLabel={`Split breakdown for ${selected.display_name}`}
                      onLoadStart={() => setImageLoading(true)}
                      onLoadEnd={() => setImageLoading(false)}
                      onError={() => setImageLoading(false)}
                    />
                    {imageLoading ? (
                      <View style={styles.imagePlaceholder}>
                        <ActivityIndicator color={colors.primary} />
                      </View>
                    ) : null}
                  </>
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.imagePlaceholderText}>Split image unavailable</Text>
                  </View>
                )}
              </View>

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

          {!allViewed && previews.length > 1 ? (
            <Text style={styles.viewHint}>
              Preview all {previews.length} messages to enable Send to all
            </Text>
          ) : null}
        </ScrollView>
      )}
    </AuthGradientLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    marginBottom: 8,
  },
  back: {
    color: authColors.ctaSurface,
    fontWeight: '600',
    fontSize: 15,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: authColors.ctaSurface,
  },
  editLink: {
    fontSize: 14,
    fontWeight: '600',
    color: authColors.textOnDarkMuted,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  hint: {
    fontSize: 12,
    color: authColors.textOnDarkMuted,
    marginBottom: 12,
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
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  pickerName: {
    marginTop: 6,
    fontSize: 10,
    color: authColors.textOnDarkMuted,
    textAlign: 'center',
  },
  viewedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F0EEF8',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E6F0',
  },
  cardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 17,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  cardAmount: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  channelPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  channelPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  imageWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F8F7FF',
    marginBottom: 14,
    minHeight: 120,
  },
  splitImage: {
    width: '100%',
    height: 200,
  },
  imagePlaceholder: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  imagePlaceholderText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textMuted,
    marginBottom: 14,
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
    borderRadius: 12,
    backgroundColor: '#F8F7FF',
    borderWidth: 1,
    borderColor: '#E0DDFF',
  },
  linkIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkIconText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
  },
  linkLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  linkMuted: {
    fontSize: 11,
    color: colors.textMuted,
  },
  viewHint: {
    marginTop: 14,
    fontSize: 13,
    color: authColors.textOnDarkMuted,
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    color: authColors.textOnDarkMuted,
    fontSize: 15,
  },
  errorText: {
    color: '#FEE2E2',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: authColors.ctaSurface,
    borderRadius: 12,
  },
  retryText: {
    color: colors.primary,
    fontWeight: '700',
  },
});
