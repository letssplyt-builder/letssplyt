import type { CreateEventResponse, EventDetailResponse, EventListItem } from '@letssplyt/shared/event.types';
import { create } from 'zustand';
import * as eventService from '../services/event.service';

export interface QrPresentation {
  eventId: string;
  title: string;
  joinUrl: string;
  tokenExpiresAt: string;
}

interface EventState {
  events: EventListItem[];
  nextCursor: string | null;
  hasMore: boolean;
  currentEvent: EventDetailResponse | null;
  isLoadingEvents: boolean;
  isLoadingDetail: boolean;
  isCreating: boolean;
  isLocking: boolean;
  createModalOpen: boolean;
  qrPresentation: QrPresentation | null;
  loadEvents: (refresh?: boolean) => Promise<void>;
  createEvent: (title: string) => Promise<CreateEventResponse>;
  loadEventDetail: (eventId: string) => Promise<void>;
  loadParticipants: (eventId: string) => Promise<void>;
  lockEvent: (eventId: string) => Promise<void>;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  showQrPresentation: (presentation: QrPresentation) => void;
  dismissQrPresentation: () => void;
  updateJoinUrl: (joinUrl: string, tokenExpiresAt: string) => void;
  resetCurrentEvent: () => void;
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  nextCursor: null,
  hasMore: false,
  currentEvent: null,
  isLoadingEvents: false,
  isLoadingDetail: false,
  isCreating: false,
  isLocking: false,
  createModalOpen: false,
  qrPresentation: null,

  loadEvents: async (refresh = false) => {
    set({ isLoadingEvents: true });
    try {
      const cursor = refresh ? undefined : get().nextCursor ?? undefined;
      const page = await eventService.fetchEvents(cursor);
      const prior = refresh ? [] : get().events;
      set({
        events: refresh ? page.events : [...prior, ...page.events],
        nextCursor: page.next_cursor,
        hasMore: page.has_more,
        isLoadingEvents: false,
      });
    } catch (err) {
      set({ isLoadingEvents: false });
      throw err;
    }
  },

  createEvent: async (title) => {
    set({ isCreating: true });
    try {
      const created = await eventService.createEvent(title);
      const listItem: EventListItem = {
        id: created.id,
        title: created.title,
        status: created.status,
        participant_count: 0,
        total_amount: null,
        created_at: new Date().toISOString(),
      };
      set((state) => ({
        events: [listItem, ...state.events],
        isCreating: false,
        createModalOpen: false,
        qrPresentation: {
          eventId: created.id,
          title: created.title,
          joinUrl: created.join_url,
          tokenExpiresAt: created.token_expires_at,
        },
      }));
      return created;
    } catch (err) {
      set({ isCreating: false });
      throw err;
    }
  },

  loadEventDetail: async (eventId) => {
    set({ isLoadingDetail: true });
    try {
      const detail = await eventService.fetchEventById(eventId);
      set({ currentEvent: detail, isLoadingDetail: false });
    } catch (err) {
      set({ isLoadingDetail: false });
      throw err;
    }
  },

  loadParticipants: async (eventId) => {
    await get().loadEventDetail(eventId);
  },

  lockEvent: async (eventId) => {
    set({ isLocking: true });
    try {
      await eventService.lockEvent(eventId);
      await get().loadEventDetail(eventId);
      set((state) => ({
        isLocking: false,
        events: state.events.map((event) =>
          event.id === eventId ? { ...event, status: 'locked' } : event,
        ),
      }));
    } catch (err) {
      set({ isLocking: false });
      throw err;
    }
  },

  openCreateModal: () => set({ createModalOpen: true }),
  closeCreateModal: () => set({ createModalOpen: false }),
  showQrPresentation: (presentation) => set({ qrPresentation: presentation }),
  dismissQrPresentation: () => set({ qrPresentation: null }),

  updateJoinUrl: (joinUrl, tokenExpiresAt) => {
    set((state) => {
      if (!state.qrPresentation) return state;
      return {
        qrPresentation: {
          ...state.qrPresentation,
          joinUrl,
          tokenExpiresAt,
        },
      };
    });
  },

  resetCurrentEvent: () => set({ currentEvent: null }),
}));
