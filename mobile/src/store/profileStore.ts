import type {
  CreateHandleResponse,
  PaymentHandle,
  PaymentProvider,
  PublicUserProfile,
} from '@letssplyt/shared/profile.types';
import { create } from 'zustand';
import * as profileService from '../services/profile.service';

interface ProfileState {
  user: PublicUserProfile | null;
  handles: PaymentHandle[];
  isLoading: boolean;
  loadProfile: () => Promise<void>;
  setUser: (user: PublicUserProfile | null) => void;
  addHandle: (provider: PaymentProvider, handleValue: string) => Promise<void>;
  updateHandle: (id: string, handleValue: string) => Promise<void>;
  deleteHandle: (id: string) => Promise<void>;
  reorderHandles: (orderedIds: string[]) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  updateNotificationPreferences: (
    prefs: Partial<Pick<PublicUserProfile, 'push_notifications_enabled'>>,
  ) => Promise<void>;
  reset: () => void;
}

function sortHandles(handles: PaymentHandle[]): PaymentHandle[] {
  return [...handles].sort((a, b) => a.display_order - b.display_order);
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  user: null,
  handles: [],
  isLoading: false,

  loadProfile: async () => {
    if (get().isLoading) return;

    set({ isLoading: true });
    const profileErrors: unknown[] = [];

    try {
      try {
        const profileUser = await profileService.fetchMyProfile();
        set({ user: profileUser });
      } catch (err) {
        profileErrors.push(err);
      }

      try {
        const handles = await profileService.fetchMyHandles();
        set({ handles: sortHandles(handles) });
      } catch {
        // Handles can load independently — profile name/avatar still usable.
      }

      if (profileErrors.length > 0 && !get().user) {
        throw profileErrors[0];
      }
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }

    set({ isLoading: false });
  },

  setUser: (user) => set({ user }),

  addHandle: async (provider, handleValue) => {
    const tempId = `temp-${Date.now()}`;
    const optimistic: PaymentHandle = {
      id: tempId,
      provider,
      handle_value: handleValue,
      display_order: get().handles.length,
    };

    set((state) => ({ handles: sortHandles([...state.handles, optimistic]) }));

    try {
      const created: CreateHandleResponse = await profileService.addHandle(provider, handleValue);
      set((state) => ({
        handles: sortHandles(
          state.handles.map((handle) =>
            handle.id === tempId
              ? {
                  id: created.id,
                  provider: created.provider,
                  handle_value: handleValue,
                  display_order: created.display_order,
                }
              : handle,
          ),
        ),
      }));
    } catch (err) {
      set((state) => ({
        handles: state.handles.filter((handle) => handle.id !== tempId),
      }));
      throw err;
    }
  },

  updateHandle: async (id, handleValue) => {
    const previous = get().handles;
    set((state) => ({
      handles: state.handles.map((handle) =>
        handle.id === id ? { ...handle, handle_value: handleValue } : handle,
      ),
    }));

    try {
      const updated = await profileService.updateHandle(id, handleValue);
      set((state) => ({
        handles: state.handles.map((handle) => (handle.id === id ? updated : handle)),
      }));
    } catch (err) {
      set({ handles: previous });
      throw err;
    }
  },

  deleteHandle: async (id) => {
    const previous = get().handles;
    set((state) => ({ handles: state.handles.filter((handle) => handle.id !== id) }));

    try {
      await profileService.deleteHandle(id);
    } catch (err) {
      set({ handles: previous });
      throw err;
    }
  },

  reorderHandles: async (orderedIds) => {
    const previous = get().handles;
    const byId = new Map(previous.map((handle) => [handle.id, handle]));
    const reordered = orderedIds
      .map((id, index) => {
        const handle = byId.get(id);
        return handle ? { ...handle, display_order: index } : null;
      })
      .filter((handle): handle is PaymentHandle => handle !== null);

    set({ handles: reordered });

    try {
      await profileService.reorderHandles(orderedIds);
    } catch (err) {
      set({ handles: previous });
      throw err;
    }
  },

  updateDisplayName: async (displayName) => {
    const updated = await profileService.updateMyProfile({ display_name: displayName });
    set({ user: updated });
  },

  updateNotificationPreferences: async (prefs) => {
    const previous = get().user;
    if (!previous) {
      const updated = await profileService.updateMyProfile(prefs);
      set({ user: updated });
      return;
    }

    set({ user: { ...previous, ...prefs } });

    try {
      const updated = await profileService.updateMyProfile(prefs);
      set({ user: updated });
    } catch (err) {
      set({ user: previous });
      throw err;
    }
  },

  reset: () => set({ user: null, handles: [], isLoading: false }),
}));
