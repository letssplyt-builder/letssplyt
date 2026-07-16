import { create } from 'zustand';
import type { SplitLineResponse } from '../services/splits.service';
import type { SplitPersonExplainer } from '../screens/splits/splitEntry.utils';

interface SplitState {
  eventId: string | null;
  currency: string;
  billTotal: number;
  splits: SplitLineResponse[];
  totalCheck: number;
  /** Per-person item math for itemised splits (client-built). */
  personExplainers: SplitPersonExplainer[];
  hasItemDiscounts: boolean;
  setCalculated: (
    eventId: string,
    currency: string,
    billTotal: number,
    splits: SplitLineResponse[],
    totalCheck: number,
    personExplainers?: SplitPersonExplainer[],
    hasItemDiscounts?: boolean,
  ) => void;
  updateParticipantAmount: (participantId: string, amount: number) => void;
  clear: () => void;
}

export const useSplitStore = create<SplitState>((set) => ({
  eventId: null,
  currency: 'USD',
  billTotal: 0,
  splits: [],
  totalCheck: 0,
  personExplainers: [],
  hasItemDiscounts: false,

  setCalculated: (
    eventId,
    currency,
    billTotal,
    splits,
    totalCheck,
    personExplainers = [],
    hasItemDiscounts = false,
  ) => {
    set({
      eventId,
      currency,
      billTotal,
      splits,
      totalCheck,
      personExplainers,
      hasItemDiscounts,
    });
  },

  updateParticipantAmount: (participantId, amount) => {
    set((state) => {
      const splits = state.splits.map((row) =>
        row.participant_id === participantId ? { ...row, amount_owed: amount } : row,
      );
      const totalCheck = Number(
        splits.reduce((sum, row) => sum + row.amount_owed, 0).toFixed(2),
      );
      return { splits, totalCheck };
    });
  },

  clear: () => {
    set({
      eventId: null,
      currency: 'USD',
      billTotal: 0,
      splits: [],
      totalCheck: 0,
      personExplainers: [],
      hasItemDiscounts: false,
    });
  },
}));
