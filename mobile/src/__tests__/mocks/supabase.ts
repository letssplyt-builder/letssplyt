import { jest } from '@jest/globals';
import type { Session } from '@supabase/supabase-js';

export const mockAuthStateCallback = jest.fn();
export const mockUnsubscribe = jest.fn();

const defaultSession: Session = {
  access_token: 'refreshed-access-token',
  refresh_token: 'refreshed-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'user-1',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
  },
};

export const mockSetSession = jest.fn(() =>
  Promise.resolve({ data: { session: defaultSession }, error: null }),
);

export const mockGetSession = jest.fn(() =>
  Promise.resolve({ data: { session: null }, error: null }),
);

export const mockSignOut = jest.fn(() => Promise.resolve({ error: null }));

export const mockOnAuthStateChange = jest.fn((callback: (event: string, session: Session | null) => void) => {
  mockAuthStateCallback.mockImplementation(callback);
  return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
});

export const supabaseMock = {
  auth: {
    onAuthStateChange: mockOnAuthStateChange,
    setSession: mockSetSession,
    getSession: mockGetSession,
    signOut: mockSignOut,
  },
};
