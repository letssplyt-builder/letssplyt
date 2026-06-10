import type {
  GuestCounterpartyRow,
  GuestDetailResponse,
  MemberCounterpartyRow,
  MemberDetailResponse,
} from '@letssplyt/shared/counterparty.types';
import { create } from 'zustand';
import * as settlementService from '../services/settlement.service';

interface SettlementState {
  membersOweYou: MemberCounterpartyRow[];
  membersYouOwe: MemberCounterpartyRow[];
  guests: GuestCounterpartyRow[];
  memberDetail: MemberDetailResponse | null;
  guestDetail: GuestDetailResponse | null;
  isLoadingCounterparties: boolean;
  isLoadingDetail: boolean;
  counterpartyError: boolean;
  loadCounterparties: (kind: 'members' | 'guests') => Promise<void>;
  loadMemberDetail: (userId: string) => Promise<void>;
  loadGuestDetail: (phoneHash: string) => Promise<void>;
  clearDetail: () => void;
}

export const useSettlementStore = create<SettlementState>((set) => ({
  membersOweYou: [],
  membersYouOwe: [],
  guests: [],
  memberDetail: null,
  guestDetail: null,
  isLoadingCounterparties: false,
  isLoadingDetail: false,
  counterpartyError: false,

  loadCounterparties: async (kind) => {
    set({ isLoadingCounterparties: true, counterpartyError: false });
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

  clearDetail: () => set({ memberDetail: null, guestDetail: null }),
}));
