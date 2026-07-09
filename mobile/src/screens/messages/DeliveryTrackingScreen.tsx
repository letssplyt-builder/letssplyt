import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { getSupabase } from '../../lib/supabase';
import type { EventsStackParamList } from '../../navigation/types';
import * as eventService from '../../services/event.service';
import { finishEventFlowToEventDetail } from '../../navigation/eventNavigation';
import { useEventStore } from '../../store/eventStore';
import { retryParticipantMessage, type SendResultStatus } from '../../services/messages.service';
import { isApiRequestError } from '../../services/api';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';
import { avatarColorFromName } from '../splits/splitEntry.utils';
import {
  deriveMessageDeliveryStatus,
  isTerminalMessageDeliveryStatus,
  messageDeliveryAccessibilityLabel,
  type MessageDeliveryStatus,
} from '../../utils/messageDeliveryStatus';

type Props = NativeStackScreenProps<EventsStackParamList, 'DeliveryTracking'>;

interface TrackingRow {
  id: string;
  display_name: string;
  status: MessageDeliveryStatus;
}

function statusLabel(status: MessageDeliveryStatus): string {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'sent':
      return 'Sent';
    case 'delivered':
      return 'Delivered';
    case 'failed':
      return 'Failed';
    case 'skipped':
      return 'Skipped';
    default:
      return status;
  }
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    layout: {
      paddingHorizontal: 0,
    },
    loader: {
      marginTop: 40,
    },
    scroll: {
      paddingHorizontal: 28,
      paddingBottom: 24,
    },
    error: {
      color: theme.bad,
      backgroundColor: theme.warnSoft,
      padding: 12,
      borderRadius: theme.radiusSm,
      marginBottom: 12,
      fontSize: 13,
      fontFamily: theme.fontBody,
    },
    list: {
      gap: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
      borderRadius: theme.radiusSm,
      paddingVertical: 10,
      paddingHorizontal: 12,
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
      fontSize: 14,
    },
    name: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    statusWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    spinner: {
      marginRight: 2,
    },
    statusBadge: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.ink3,
      minWidth: 52,
      textAlign: 'right',
      fontFamily: theme.fontBody,
    },
    statusDelivered: {
      color: theme.good,
      fontSize: 16,
    },
    statusFailed: {
      color: theme.bad,
    },
    statusSkipped: {
      color: theme.ink3,
    },
    retryBtn: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.radiusSm,
      backgroundColor: theme.surfaceStrong,
      borderWidth: 1,
      borderColor: theme.line,
    },
    retryText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    failedSummary: {
      marginTop: 16,
      fontSize: 13,
      lineHeight: 18,
      color: theme.bad,
      fontFamily: theme.fontBody,
    },
  });
}

export function DeliveryTrackingScreen({ navigation, route }: Props) {
  const { eventId, sendResults = [] } = route.params;
  const { rawBottom } = useAppInsets();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [rows, setRows] = useState<TrackingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const sendResultMap = useMemo(() => {
    const map = new Map<string, SendResultStatus>();
    for (const row of sendResults) {
      map.set(row.participant_id, row.status);
    }
    return map;
  }, [sendResults]);

  const mapParticipantsToRows = useCallback(
    (
      participants: Array<{
        id: string;
        display_name: string;
        is_organiser?: boolean;
        join_method?: string;
        message_sent_at?: string | null;
        message_delivered_at?: string | null;
        message_failed?: boolean;
      }>,
      resultOverrides?: Map<string, SendResultStatus>,
    ): TrackingRow[] =>
      participants
        .filter((participant) => !participant.is_organiser)
        .filter((participant) => participant.join_method !== 'manual_name_only')
        .map((participant) => ({
          id: participant.id,
          display_name: participant.display_name,
          status: deriveMessageDeliveryStatus(participant, resultOverrides?.get(participant.id)),
        })),
    [],
  );

  const loadRows = useCallback(async () => {
    setLoadError(null);
    try {
      const detail = await eventService.fetchEventById(eventId);
      setRows(mapParticipantsToRows(detail.participants, sendResultMap));
    } catch {
      setLoadError('Could not load delivery status. Pull to refresh.');
    } finally {
      setLoading(false);
    }
  }, [eventId, mapParticipantsToRows, sendResultMap]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return undefined;

    const channel = supabase
      .channel(`message-delivery:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'participants',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const updated = payload.new as {
            id?: string;
            display_name?: string;
            message_sent_at?: string | null;
            message_delivered_at?: string | null;
            message_failed?: boolean;
          };
          if (!updated.id) return;

          setRows((prev) =>
            prev.map((row) => {
              if (row.id !== updated.id) return row;
              return {
                ...row,
                display_name: updated.display_name ?? row.display_name,
                status: deriveMessageDeliveryStatus({
                  message_sent_at: updated.message_sent_at,
                  message_delivered_at: updated.message_delivered_at,
                  message_failed: updated.message_failed,
                }),
              };
            }),
          );
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  const allTerminal =
    rows.length === 0 ||
    rows.every((row) => isTerminalMessageDeliveryStatus(row.status));
  const failedCount = rows.filter((row) => row.status === 'failed').length;

  const handleRetry = async (participantId: string) => {
    setRetryingId(participantId);
    try {
      const result = await retryParticipantMessage(eventId, participantId);
      const retryRow = result.results.find((row) => row.participant_id === participantId);
      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== participantId) return row;
          return {
            ...row,
            status: deriveMessageDeliveryStatus(
              {
                message_sent_at: retryRow?.status === 'sent' ? new Date().toISOString() : null,
                message_delivered_at: null,
                message_failed: retryRow?.status === 'failed',
              },
              retryRow?.status,
            ),
          };
        }),
      );
    } catch (err) {
      const message = isApiRequestError(err)
        ? err.message
        : 'Could not retry message. Try again.';
      setLoadError(message);
    } finally {
      setRetryingId(null);
    }
  };

  const handleDone = () => {
    void useEventStore
      .getState()
      .loadEventDetail(eventId)
      .catch(() => undefined)
      .finally(() => {
        finishEventFlowToEventDetail(navigation, eventId);
      });
  };

  const subtitle = allTerminal ? 'All messages sent' : 'Sending to members…';

  return (
    <AuthGradientLayout
      contentStyle={styles.layout}
      footerStyle={splitActionBarFooterStyle(rawBottom)}
      footer={
        <PrimaryButton
          label="Done"
          disabled={!allTerminal || loading}
          onPress={handleDone}
          accessibilityLabel="Done"
          variant="inverse"
        />
      }
    >
      <StatusBar style="light" />
      <ScreenTopBar
        title="Sending messages…"
        subtitle={subtitle}
        titleAlign="start"
      />

      {loading ? (
        <ActivityIndicator color={theme.ink} style={styles.loader} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {loadError ? <Text style={styles.error}>{loadError}</Text> : null}

          <View style={styles.list} accessibilityLiveRegion="polite">
            {rows.map((row) => {
              const color = avatarColorFromName(row.display_name);
              const showSpinner = row.status === 'queued' || retryingId === row.id;

              return (
                <View
                  key={row.id}
                  style={styles.row}
                  accessibilityLabel={messageDeliveryAccessibilityLabel(
                    row.display_name,
                    row.status,
                  )}
                >
                  <View style={[styles.avatar, { backgroundColor: color }]}>
                    <Text style={styles.avatarText}>
                      {row.display_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.name} numberOfLines={1}>{row.display_name}</Text>
                  <View style={styles.statusWrap}>
                    {showSpinner ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.ink3}
                        style={styles.spinner}
                      />
                    ) : null}
                    <Text
                      style={[
                        styles.statusBadge,
                        (row.status === 'delivered' || row.status === 'sent') && styles.statusDelivered,
                        row.status === 'failed' && styles.statusFailed,
                        row.status === 'skipped' && styles.statusSkipped,
                      ]}
                    >
                      {row.status === 'delivered' || row.status === 'sent'
                        ? '✓'
                        : statusLabel(row.status)}
                    </Text>
                  </View>
                  {row.status === 'failed' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Retry message for ${row.display_name}`}
                      disabled={retryingId === row.id}
                      onPress={() => void handleRetry(row.id)}
                      style={styles.retryBtn}
                    >
                      <Text style={styles.retryText}>Retry</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>

          {failedCount > 0 && allTerminal ? (
            <Text style={styles.failedSummary}>
              {failedCount} message{failedCount === 1 ? '' : 's'} failed to send. Tap Retry on a
              row to try again.
            </Text>
          ) : null}
        </ScrollView>
      )}
    </AuthGradientLayout>
  );
}
