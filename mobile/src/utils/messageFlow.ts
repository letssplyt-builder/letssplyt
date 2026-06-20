import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import {
  fetchMessagePreviews,
  resendRevisionMessages,
  sendEventMessages,
} from '../services/messages.service';
import { finishEventFlowToEventDetail } from '../navigation/eventNavigation';
import { useEventStore } from '../store/eventStore';

export function canParticipantReceiveSms(joinMethod: string): boolean {
  return joinMethod !== 'manual_name_only';
}

export function eventHasSmsRecipients(
  participants: Array<{ is_organiser?: boolean; join_method: string }>,
): boolean {
  return participants.some(
    (participant) =>
      !participant.is_organiser && canParticipantReceiveSms(participant.join_method),
  );
}

async function refreshEventDetail(eventId: string): Promise<void> {
  await useEventStore.getState().loadEventDetail(eventId).catch(() => undefined);
}

export async function completeEventWithoutSms(
  navigation: NavigationProp<ParamListBase>,
  eventId: string,
): Promise<void> {
  await sendEventMessages(eventId);
  await refreshEventDetail(eventId);
  finishEventFlowToEventDetail(navigation, eventId);
}

export async function continueMessagingAfterSplitConfirm(
  navigation: NavigationProp<ParamListBase>,
  eventId: string,
  options: { isPostSendRevision: boolean },
): Promise<void> {
  if (options.isPostSendRevision) {
    const sendResult = await resendRevisionMessages(eventId);
    const hasTrackableDelivery = sendResult.results.some(
      (row) => row.status === 'sent' || row.status === 'failed',
    );

    if (!hasTrackableDelivery) {
      await refreshEventDetail(eventId);
      finishEventFlowToEventDetail(navigation, eventId);
      return;
    }

    navigation.replace('DeliveryTracking', {
      eventId,
      sendResults: sendResult.results,
    });
    return;
  }

  const previewResponse = await fetchMessagePreviews(eventId);
  if (previewResponse.previews.length === 0) {
    await completeEventWithoutSms(navigation, eventId);
    return;
  }

  navigation.navigate('MessagePreview', { eventId });
}

export async function openMessagePreviewOrComplete(
  navigation: NavigationProp<ParamListBase>,
  eventId: string,
  participants: Array<{ is_organiser?: boolean; join_method: string }>,
): Promise<void> {
  if (!eventHasSmsRecipients(participants)) {
    await completeEventWithoutSms(navigation, eventId);
    return;
  }

  const previewResponse = await fetchMessagePreviews(eventId);
  if (previewResponse.previews.length === 0) {
    await completeEventWithoutSms(navigation, eventId);
    return;
  }

  navigation.navigate('MessagePreview', { eventId });
}
