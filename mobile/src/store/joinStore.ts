import { create } from 'zustand';

interface JoinState {
  pendingJoinToken: string | null;
  setPendingJoinToken: (token: string | null) => void;
  clearPendingJoinToken: () => void;
}

export const useJoinStore = create<JoinState>((set) => ({
  pendingJoinToken: null,
  setPendingJoinToken: (token) => set({ pendingJoinToken: token }),
  clearPendingJoinToken: () => set({ pendingJoinToken: null }),
}));
