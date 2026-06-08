/** Auth types — shared between mobile and backend */

export type OtpChannel = 'sms' | 'whatsapp';

export interface OtpRequestBody {
  phone_e164: string;
  channel?: OtpChannel;
}

export interface OtpRequestResponse {
  sent: boolean;
  channel?: OtpChannel;
  expires_in_seconds?: number;
  reason?: string;
}

export interface OtpVerifyBody {
  phone_e164: string;
  code: string;
  display_name?: string;
  context?: 'login' | 'join_event';
  join_token?: string;
}

export interface AuthUser {
  id: string;
  display_name: string;
  avatar_colour: string;
  is_new_user: boolean;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: AuthUser;
}
