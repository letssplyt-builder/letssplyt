export type MessageChannel = 'sms' | 'whatsapp';

export interface SendOutboundMessageParams {
  toE164: string;
  body: string;
  preferredChannel: MessageChannel;
  statusCallbackUrl?: string;
}

export interface SendOutboundMessageResult {
  messageId: string;
  channel: MessageChannel;
}

export type SMSProviderName = 'twilio' | 'telnyx';

export interface SMSProvider {
  readonly name: SMSProviderName;
  sendOutboundMessage(params: SendOutboundMessageParams): Promise<SendOutboundMessageResult>;
}
