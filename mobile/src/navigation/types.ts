import type { PaymentProvider } from '@letssplyt/shared/profile.types';

export type RootStackParamList = {
  Welcome: undefined;
  PhoneEntry: { initialPhone?: string };
  OTPVerify: {
    phoneE164: string;
    accountExists?: boolean;
  };
  PushPermission: undefined;
  Home: undefined;
  Profile: { toastMessage?: string } | undefined;
  AddHandle: {
    handleId?: string;
    provider?: PaymentProvider;
    handleValue?: string;
  };
};

/** @deprecated Use RootStackParamList */
export type AuthStackParamList = RootStackParamList;
