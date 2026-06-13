import type {
  GuestCounterpartyRow,
  GuestDetailResponse,
  MemberCounterpartyRow,
  MemberDetailResponse,
} from '@letssplyt/shared/counterparty.types';
import type { IOweEntry, OwedToMeEntry } from '@letssplyt/shared/settlement.types';
import { create } from 'zustand';
import * as settlementService from '../services/settlement.service';

interface SettlementState {
  membersOweYou: MemberCounterpartyRow[];
  membersYouOwe: MemberCounterpartyRow[];
  guests: GuestCounterpartyRow[];
  memberDetail: MemberDetailResponse | null;
  guestDetail: GuestDetailResponse | null;
  owedToMeRows: OwedToMeEntry[];
  iOweRows: IOweEntry[];
  isLoadingCounterparties: boolean;
  isLoadingDetail: boolean;
  isLoadingLedger: boolean;
  counterpartyError: boolean;
  loadCounterparties: (kind: 'members' | 'guests') => Promise<void>;
  loadMemberDetail: (userId: string) => Promise<void>;
  loadGuestDetail: (phoneHash: string) => Promise<void>;
  loadEventLedger: () => Promise<void>;
  getIOweForEvent: (eventId: string) => IOweEntry | undefined;
  clearDetail: () => void;
}

export const useSettlementStore = create<SettlementState>((set, get) => ({
  membersOweYou: [],
  membersYouOwe: [],
  guests: [],
  memberDetail: null,
  guestDetail: null,
  owedToMeRows: [],
  iOweRows: [],
  isLoadingCounterparties: false,
  isLoadingDetail: false,
  isLoadingLedger: false,
  counterpartyError: false,

  loadCounterparties: async (kind) => {
    set({
      isLoadingCounterparties: true,
      counterpartyError: false,
      ...(kind === 'members'
        ? { membersOweYou: [], membersYouOwe: [] }
        : { guests: [] }),
    });
    try {
      if (kind === 'members') {
        const data = await settlementService.fetchMemberCounterparties();
        set({
          membersOweYou: data.owe_you,
          membersYouOwe: data.you_owe,
          isLoadingCounterparties: false,
        });
      } else {
        const data = await settlementService.fetchGuestCounterparties();
        set({ guests: data.guests, isLoadingCounterparties: false });
      }
    } catch {
      set({ counterpartyError: true, isLoadingCounterparties: false });
    }
  },

  loadMemberDetail: async (userId) => {
    set({ isLoadingDetail: true, memberDetail: null, guestDetail: null });
    try {
      const detail = await settlementService.fetchMemberDetail(userId);
      set({ memberDetail: detail, isLoadingDetail: false });
    } catch {
      set({ isLoadingDetail: false });
      throw new Error('MEMBER_DETAIL_FAILED');
    }
  },

  loadGuestDetail: async (phoneHash) => {
    set({ isLoadingDetail: true, memberDetail: null, guestDetail: null });
    try {
      const detail = await settlementService.fetchGuestDetail(phoneHash);
      set({ guestDetail: detail, isLoadingDetail: false });
    } catch {
      set({ isLoadingDetail: false });
      throw new Error('GUEST_DETAIL_FAILED');
    }
  },

  loadEventLedger: async () => {
    set({ isLoadingLedger: true });
    try {
      const [owed, owe] = await Promise.all([
        settlementService.fetchOwedToMe(),
        settlementService.fetchIOwe(),
      ]);
      set({
        owedToMeRows: owed.data,
        iOweRows: owe.data,
        isLoadingLedger: false,
      });
    } catch {
      set({ isLoadingLedger: false });
    }
  },

  getIOweForEvent: (eventId) => {
    return get().iOweRows.find((row) => row.event_id === eventId);
  },

  clearDetail: () => set({ memberDetail: null, guestDetail: null }),
}));
