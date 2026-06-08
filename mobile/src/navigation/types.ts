import type { NavigatorScreenParams } from '@react-navigation/native';
import type { PaymentProvider } from '@letssplyt/shared/profile.types';

export type EventsStackParamList = {
  Events: undefined;
  EventDetail: { eventId: string };
};

export type MainTabParamList = {
  HomeTab: undefined;
  EventsTab: NavigatorScreenParams<EventsStackParamList> | undefined;
};

export type RootStackParamList = {
  Welcome: undefined;
  PhoneEntry: { initialPhone?: string };
  OTPVerify: {
    phoneE164: string;
    accountExists?: boolean;
  };
  PushPermission: undefined;
  MainTabs: undefined;
  Profile: { toastMessage?: string } | undefined;
  AddHandle: {
    handleId?: string;
    provider?: PaymentProvider;
    handleValue?: string;
  };
};

/** @deprecated Use RootStackParamList */
export type AuthStackParamList = RootStackParamList;
