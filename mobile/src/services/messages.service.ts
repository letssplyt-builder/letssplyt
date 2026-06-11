import { apiGet, apiPostAuth } from './api';

export interface MessagePaymentLink {
  provider: string;
  label: string;
  url: string;
}

export interface MessagePreviewItem {
  participant_id: string;
  display_name: string;
  amount_owed: number;
  message_text: string;
  channel: 'whatsapp' | 'sms';
  payment_links: MessagePaymentLink[];
  split_image_url: string | null;
}

export interface MessagePreviewResponse {
  previews: MessagePreviewItem[];
}

export interface SplitConfirmLine {
  participant_id: string;
  amount_owed: number;
}

export interface SplitConfirmResponse {
  confirmed: boolean;
  event_status: string;
  ai_stage: string;
  splits: SplitConfirmLine[];
}

export async function confirmEventSplit(
  eventId: string,
  splits: SplitConfirmLine[],
): Promise<SplitConfirmResponse> {
  return apiPostAuth<SplitConfirmResponse>(`/events/${eventId}/split/confirm`, {
    splits,
  });
}

export type SendResultStatus =
  | 'sent'
  | 'skipped_opt_out'
  | 'skipped_no_phone'
  | 'failed';

export interface SendMessageResultRow {
  participant_id: string;
  status: SendResultStatus;
  twilio_sid?: string;
}

export interface SendMessagesResponse {
  sent_count: number;
  skipped_count: number;
  failed_count: number;
  results: SendMessageResultRow[];
  event_status: 'sent';
}

export async function fetchMessagePreviews(eventId: string): Promise<MessagePreviewResponse> {
  return apiGet<MessagePreviewResponse>(`/events/${eventId}/messages/preview`);
}

export async function sendEventMessages(
  eventId: string,
  participantIds?: string[],
): Promise<SendMessagesResponse> {
  return apiPostAuth<SendMessagesResponse>(`/events/${eventId}/messages/send`, {
    participant_ids: participantIds ?? [],
  });
}

export async function retryParticipantMessage(
  eventId: string,
  participantId: string,
): Promise<SendMessagesResponse> {
  return apiPostAuth<SendMessagesResponse>(
    `/events/${eventId}/messages/retry/${participantId}`,
    {},
  );
}
