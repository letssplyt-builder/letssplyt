import type { NavigatorScreenParams } from '@react-navigation/native';
import type { PaymentProvider } from '@letssplyt/shared/profile.types';
import type { ReceiptParseResponse } from '@letssplyt/shared/receipt.types';

export type HomeStackParamList = {
  Home: undefined;
  Notifications: undefined;
  MemberDetail: { userId: string };
  GuestDetail: { phoneHash: string };
};

export type EventsStackParamList = {
  Events: undefined;
  Notifications: undefined;
  EventDetail: { eventId: string };
  ReceiptScan: { eventId: string };
  ReceiptPreview: { eventId: string; imageUri: string };
  ItemReview: {
    eventId: string;
    storagePath: string;
    parseResult: ReceiptParseResponse;
  };
  SplitEntry: { eventId: string; mode?: 'itemised' | 'manual' };
  SplitReview: { eventId: string };
  MessagePreview: { eventId: string };
  DeliveryTracking: {
    eventId: string;
    sendResults?: Array<{
      participant_id: string;
      status: 'sent' | 'skipped_opt_out' | 'skipped_no_phone' | 'failed';
      twilio_sid?: string;
    }>;
  };
};

export type ProfileStackParamList = {
  Profile: { toastMessage?: string } | undefined;
  AddHandle: {
    handleId?: string;
    provider?: PaymentProvider;
    handleValue?: string;
  };
};

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList> | undefined;
  EventsTab: NavigatorScreenParams<EventsStackParamList> | undefined;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

export type RootStackParamList = {
  Welcome: undefined;
  PhoneEntry: { initialPhone?: string; joinToken?: string };
  OTPVerify: {
    phoneE164: string;
    accountExists?: boolean;
    joinToken?: string;
  };
  PushPermission: undefined;
  BiometricOptIn: undefined;
  BiometricLock: undefined;
  MainTabs: undefined;
  AppJoin: { token: string };
  AppJoined: { eventId: string; eventName: string };
  AppLocked: { creatorName?: string; eventName?: string };
};

/** @deprecated Use RootStackParamList */
export type AuthStackParamList = RootStackParamList;
