import type { RootStackParamList } from './types';

/** Post-login stack target — used by RootNavigator reset after OTP / unlock. */
export function resolveAuthenticatedRoute(
  pendingBiometricOptIn: boolean,
  pendingJoinToken: string | null,
  needsPushPermission: boolean,
): keyof RootStackParamList {
  if (pendingBiometricOptIn) return 'BiometricOptIn';
  if (pendingJoinToken) return 'AppJoin';
  if (needsPushPermission) return 'PushPermission';
  return 'MainTabs';
}
