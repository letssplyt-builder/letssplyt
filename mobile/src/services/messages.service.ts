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

export async function fetchMessagePreviews(eventId: string): Promise<MessagePreviewResponse> {
  return apiGet<MessagePreviewResponse>(`/events/${eventId}/messages/preview`);
}
