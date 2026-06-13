/**
 * In-memory Supabase auth storage — refresh tokens persist via secureTokenStorage;
 * this cache holds the active session JSON while the app is unlocked.
 */
let memorySessionJson: string | null = null;

type SessionPersistenceListener = (sessionJson: string | null) => void | Promise<void>;

let persistenceListener: SessionPersistenceListener | null = null;

export function setSupabaseSessionPersistenceListener(
  listener: SessionPersistenceListener | null,
): void {
  persistenceListener = listener;
}

export const supabaseMemoryStorage = {
  getItem: async (_key: string): Promise<string | null> => memorySessionJson,
  setItem: async (_key: string, value: string): Promise<void> => {
    memorySessionJson = value;
    if (persistenceListener) {
      await persistenceListener(value);
    }
  },
  removeItem: async (_key: string): Promise<void> => {
    memorySessionJson = null;
    if (persistenceListener) {
      await persistenceListener(null);
    }
  },
};

export function clearSupabaseMemorySession(): void {
  memorySessionJson = null;
}
