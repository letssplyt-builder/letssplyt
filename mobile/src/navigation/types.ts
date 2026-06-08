export type RootStackParamList = {
  Welcome: undefined;
  PhoneEntry: { mode: 'register' | 'login'; initialPhone?: string };
  OTPVerify: {
    phoneE164: string;
    mode: 'register' | 'login';
    accountExists?: boolean;
  };
  Home: undefined;
};

/** @deprecated Use RootStackParamList */
export type AuthStackParamList = RootStackParamList;
