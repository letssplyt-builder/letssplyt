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
  removeParticipant: (eventId: string, participantId: string) => Promise<void>;
  reopenEvent: (eventId: string) => Promise<void>;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  showQrPresentation: (presentation: QrPresentation) => void;
  dismissQrPresentation: () => void;
  updateJoinUrl: (joinUrl: string, tokenExpiresAt: string) => void;
  resetCurrentEvent: () => void;
  /** Optimistic UI after POST /expenses/reset succeeds. */
  applyExpensesResetLocal: (eventId: string) => void;
  removeEvent: (eventId: string) => void;
  deleteEvent: (eventId: string) => Promise<void>;
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
      const page = await eventService.fetchEvents(cursor, { role: 'all' });
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
        participant_count: 1,
        total_amount: null,
        created_at: new Date().toISOString(),
        role: 'creator',
        creator_name: null,
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

  removeParticipant: async (eventId, participantId) => {
    await eventService.deleteParticipant(eventId, participantId);
    set((state) => {
      if (!state.currentEvent || state.currentEvent.event.id !== eventId) {
        return state;
      }
      return {
        currentEvent: {
          ...state.currentEvent,
          participants: state.currentEvent.participants.filter((p) => p.id !== participantId),
        },
      };
    });
    await get().loadEventDetail(eventId);
  },

  reopenEvent: async (eventId) => {
    await eventService.reopenEvent(eventId);
    await get().loadEventDetail(eventId);
    set((state) => ({
      events: state.events.map((event) =>
        event.id === eventId ? { ...event, status: 'open' } : event,
      ),
    }));
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

  applyExpensesResetLocal: (eventId) => {
    set((state) => {
      if (!state.currentEvent || state.currentEvent.event.id !== eventId) {
        return state;
      }

      const summary = state.currentEvent.summary
        ? {
            ...state.currentEvent.summary,
            total: 0,
            collected: 0,
            outstanding: 0,
            confirmed_count: 0,
            pending_count: state.currentEvent.participants.length,
          }
        : null;

      const { receipt_review: _review, ...detailWithoutReview } = state.currentEvent;

      return {
        currentEvent: {
          ...detailWithoutReview,
          summary,
          participants: state.currentEvent.participants.map((participant) => ({
            ...participant,
            amount_owed: null,
            payment_status: 'pending',
          })),
          event: {
            ...state.currentEvent.event,
            ai_stage: 'none',
            split_mode: null,
            total_amount: null,
          },
        },
      };
    });
  },

  removeEvent: (eventId) => {
    set((state) => ({
      events: state.events.filter((event) => event.id !== eventId),
      currentEvent:
        state.currentEvent?.event.id === eventId ? null : state.currentEvent,
    }));
  },

  deleteEvent: async (eventId) => {
    await eventService.deleteEvent(eventId);
    get().removeEvent(eventId);
  },
}));
