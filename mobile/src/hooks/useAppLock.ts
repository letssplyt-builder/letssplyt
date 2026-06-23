import { useCallback, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { APP_LOCK_IDLE_MS } from '../auth/appLockConfig';
import { useAuthStore } from '../store/authStore';

let backgroundTimestamp: number | null = null;

/**
 * Locks the app after idle background time. Clears in-memory session while
 * keeping persisted refresh tokens on disk.
 */
export function useAppLock(): void {
  const lockApp = useAuthStore((state) => state.lockApp);
  const isUnlocked = useAuthStore((state) => state.isUnlocked);
  const hasStoredCredentials = useAuthStore((state) => state.hasStoredCredentials);

  const handleAppState = useCallback(
    (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundTimestamp = Date.now();
        return;
      }

      if (nextState !== 'active') return;
      if (!isUnlocked || !hasStoredCredentials) {
        backgroundTimestamp = null;
        return;
      }

      const elapsed = backgroundTimestamp ? Date.now() - backgroundTimestamp : 0;
      backgroundTimestamp = null;

      if (elapsed >= APP_LOCK_IDLE_MS) {
        void lockApp();
      }
    },
    [hasStoredCredentials, isUnlocked, lockApp],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [handleAppState]);
}
