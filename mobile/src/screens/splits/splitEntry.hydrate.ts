import type { AiStage, SplitMode } from '@letssplyt/shared/event.types';
import { isWithinMoneyTolerance, type SplitEntryTab } from './splitEntry.utils';
import type { SplitPath } from '../../components/splits/SplitPathToggle';

interface HydrateParticipant {
  id: string;
  amount_owed?: number | null;
  is_organiser?: boolean;
}

export function hydrateSplitEntryState(params: {
  participants: HydrateParticipant[];
  splitMode: SplitMode | null;
  aiStage: AiStage;
  currency: string;
  hasReceiptItems: boolean;
  storedSplits?: Array<{ participant_id: string; amount_owed: number }>;
}): {
  amountInputs: Record<string, string>;
  percentInputs: Record<string, string>;
  portionInputs: Record<string, string>;
  activeTab: SplitEntryTab;
  splitPath: SplitPath;
} {
  const { participants, splitMode, currency, hasReceiptItems, storedSplits } = params;
  const emptyInputs = Object.fromEntries(participants.map((p) => [p.id, '']));

  const sourceAmounts = new Map<string, number>();
  if (storedSplits?.length) {
    for (const split of storedSplits) {
      sourceAmounts.set(split.participant_id, split.amount_owed);
    }
  } else {
    for (const participant of participants) {
      if (participant.amount_owed != null) {
        sourceAmounts.set(participant.id, participant.amount_owed);
      }
    }
  }

  const amountInputs = { ...emptyInputs };
  for (const participant of participants) {
    const amount = sourceAmounts.get(participant.id);
    if (amount != null) {
      amountInputs[participant.id] = String(amount);
    }
  }

  let activeTab: SplitEntryTab = 'even';
  if (sourceAmounts.size > 0) {
    const memberAmounts = participants
      .filter((p) => !p.is_organiser || sourceAmounts.has(p.id))
      .map((p) => sourceAmounts.get(p.id) ?? 0)
      .filter((amount) => amount > 0);

    if (
      splitMode === 'equal' ||
      (memberAmounts.length > 1 &&
        memberAmounts.every((amount) => isWithinMoneyTolerance(amount, memberAmounts[0], currency)))
    ) {
      activeTab = 'even';
    } else {
      activeTab = 'amount';
    }
  }

  let splitPath: SplitPath = 'custom';
  if (splitMode === 'itemised' || (hasReceiptItems && splitMode !== 'equal' && splitMode !== 'portion')) {
    splitPath = 'itemised';
  }

  return {
    amountInputs,
    percentInputs: { ...emptyInputs },
    portionInputs: Object.fromEntries(participants.map((p) => [p.id, '1'])),
    activeTab,
    splitPath,
  };
}

export function assignmentsFromApiRows(
  rows: Array<{ item_id: string; participant_ids: string[] }>,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    map.set(row.item_id, row.participant_ids);
  }
  return map;
}
