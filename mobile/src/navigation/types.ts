import type { NavigatorScreenParams } from '@react-navigation/native';
import type { PaymentProvider } from '@letssplyt/shared/profile.types';
import type { ReceiptParseResponse } from '@letssplyt/shared/receipt.types';

export type EventsStackParamList = {
  Events: undefined;
  EventDetail: { eventId: string };
  ReceiptScan: { eventId: string };
  ReceiptPreview: { eventId: string; imageUri: string };
  ItemReview: {
    eventId: string;
    storagePath: string;
    parseResult: ReceiptParseResponse;
  };
  SplitEntry: { eventId: string; mode?: 'itemised' | 'manual' };
};

export type MainTabParamList = {
  HomeTab: undefined;
  EventsTab: NavigatorScreenParams<EventsStackParamList> | undefined;
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
  MainTabs: undefined;
  AppJoin: { token: string };
  AppJoined: { eventId: string; eventName: string };
  AppLocked: { creatorName?: string; eventName?: string };
  Profile: { toastMessage?: string } | undefined;
  AddHandle: {
    handleId?: string;
    provider?: PaymentProvider;
    handleValue?: string;
  };
};

/** @deprecated Use RootStackParamList */
export type AuthStackParamList = RootStackParamList;
