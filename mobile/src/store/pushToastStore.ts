import { create } from 'zustand';

export interface PushToastMessage {
  title: string;
  body: string;
}

interface PushToastState {
  toast: PushToastMessage | null;
  showPushToast: (toast: PushToastMessage) => void;
  clearPushToast: () => void;
}

export const usePushToastStore = create<PushToastState>((set) => ({
  toast: null,
  showPushToast: (toast) => set({ toast }),
  clearPushToast: () => set({ toast: null }),
}));

export function showPushToast(toast: PushToastMessage): void {
  usePushToastStore.getState().showPushToast(toast);
}
