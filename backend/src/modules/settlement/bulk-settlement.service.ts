import { AppError } from '../../infrastructure/errors';
import { getGuestDetail } from './guest-detail.service';
import { getMemberDetail } from './member-detail.service';
import {
  confirmPayment,
  disputePayment,
  markParticipantPaid,
  selfReportPayment,
  type MarkParticipantPaidInput,
  type SelfReportInput,
} from './settlement.service';

export interface BulkSettlementResultItem {
  event_id: string;
  participant_id: string;
  payment_status: string;
}

export interface BulkSelfReportAllResult {
  updated_count: number;
  results: BulkSettlementResultItem[];
}

export interface BulkConfirmAllResult {
  updated_count: number;
  events_fully_settled: string[];
  results: BulkSettlementResultItem[];
}

export interface BulkDisputeAllResult {
  updated_count: number;
  results: BulkSettlementResultItem[];
}

function isSkippableBulkError(err: unknown): boolean {
  if (err instanceof AppError) {
    return err.code === 'INVALID_PAYMENT_STATUS' || err.statusCode === 409;
  }
  if (err instanceof Error && err.message.startsWith('Invalid settlement transition')) {
    return true;
  }
  return false;
}

async function applyBulkAction<T extends BulkSettlementResultItem>(
  targets: Array<{ event_id: string; participant_id: string }>,
  action: (eventId: string, participantId: string) => Promise<T>,
): Promise<{ updated_count: number; results: T[] }> {
  const results: T[] = [];
  for (const row of targets) {
    try {
      const result = await action(row.event_id, row.participant_id);
      results.push(result);
    } catch (err) {
      if (isSkippableBulkError(err)) {
        continue;
      }
      throw err;
    }
  }
  return { updated_count: results.length, results };
}

export async function memberSelfReportAll(
  viewerId: string,
  counterpartyUserId: string,
  input: SelfReportInput,
): Promise<BulkSelfReportAllResult> {
  const detail = await getMemberDetail(viewerId, counterpartyUserId);
  const targets = detail.outstanding.filter(
    (row) => row.direction === 'i_owe' && row.payment_status === 'pending',
  );

  const { updated_count, results } = await applyBulkAction(
    targets,
    async (eventId, participantId) => {
      const result = await selfReportPayment(viewerId, eventId, participantId, input);
      return {
        event_id: eventId,
        participant_id: participantId,
        payment_status: result.payment_status,
      };
    },
  );

  return { updated_count, results };
}

export async function memberConfirmAll(
  viewerId: string,
  counterpartyUserId: string,
): Promise<BulkConfirmAllResult> {
  const detail = await getMemberDetail(viewerId, counterpartyUserId);
  const targets = detail.outstanding.filter(
    (row) => row.direction === 'owed_to_me' && row.payment_status === 'self_reported',
  );

  const eventsFullySettled: string[] = [];
  const results: BulkSettlementResultItem[] = [];

  for (const row of targets) {
    try {
      const result = await confirmPayment(viewerId, row.event_id, row.participant_id);
      results.push({
        event_id: row.event_id,
        participant_id: row.participant_id,
        payment_status: result.payment_status,
      });
      if (result.event_fully_settled) {
        eventsFullySettled.push(row.event_id);
      }
    } catch (err) {
      if (isSkippableBulkError(err)) {
        continue;
      }
      throw err;
    }
  }

  return {
    updated_count: results.length,
    events_fully_settled: eventsFullySettled,
    results,
  };
}

export async function memberDisputeAll(
  viewerId: string,
  counterpartyUserId: string,
  input: { note?: string },
): Promise<BulkDisputeAllResult> {
  const detail = await getMemberDetail(viewerId, counterpartyUserId);
  const targets = detail.outstanding.filter(
    (row) => row.direction === 'owed_to_me' && row.payment_status === 'self_reported',
  );

  const { updated_count, results } = await applyBulkAction(
    targets,
    async (eventId, participantId) => {
      const result = await disputePayment(viewerId, eventId, participantId, input);
      return {
        event_id: eventId,
        participant_id: participantId,
        payment_status: result.payment_status,
      };
    },
  );

  return { updated_count, results };
}

export async function memberMarkPaidAll(
  viewerId: string,
  counterpartyUserId: string,
  input: MarkParticipantPaidInput,
): Promise<BulkConfirmAllResult> {
  const detail = await getMemberDetail(viewerId, counterpartyUserId);
  const targets = detail.outstanding.filter(
    (row) => row.direction === 'owed_to_me' && row.payment_status === 'pending',
  );

  const eventsFullySettled: string[] = [];
  const results: BulkSettlementResultItem[] = [];

  for (const row of targets) {
    try {
      const result = await markParticipantPaid(viewerId, row.event_id, row.participant_id, input);
      results.push({
        event_id: row.event_id,
        participant_id: row.participant_id,
        payment_status: result.payment_status,
      });
      if (result.event_fully_settled) {
        eventsFullySettled.push(row.event_id);
      }
    } catch (err) {
      if (isSkippableBulkError(err)) {
        continue;
      }
      throw err;
    }
  }

  return {
    updated_count: results.length,
    events_fully_settled: eventsFullySettled,
    results,
  };
}

export async function guestConfirmAll(
  viewerId: string,
  phoneHash: string,
): Promise<BulkConfirmAllResult> {
  const detail = await getGuestDetail(viewerId, phoneHash);
  const targets = detail.outstanding.filter((row) => row.payment_status === 'self_reported');

  const eventsFullySettled: string[] = [];
  const results: BulkSettlementResultItem[] = [];

  for (const row of targets) {
    try {
      const result = await confirmPayment(viewerId, row.event_id, row.participant_id);
      results.push({
        event_id: row.event_id,
        participant_id: row.participant_id,
        payment_status: result.payment_status,
      });
      if (result.event_fully_settled) {
        eventsFullySettled.push(row.event_id);
      }
    } catch (err) {
      if (isSkippableBulkError(err)) {
        continue;
      }
      throw err;
    }
  }

  return {
    updated_count: results.length,
    events_fully_settled: eventsFullySettled,
    results,
  };
}

export async function guestDisputeAll(
  viewerId: string,
  phoneHash: string,
  input: { note?: string },
): Promise<BulkDisputeAllResult> {
  const detail = await getGuestDetail(viewerId, phoneHash);
  const targets = detail.outstanding.filter((row) => row.payment_status === 'self_reported');

  const { updated_count, results } = await applyBulkAction(
    targets,
    async (eventId, participantId) => {
      const result = await disputePayment(viewerId, eventId, participantId, input);
      return {
        event_id: eventId,
        participant_id: participantId,
        payment_status: result.payment_status,
      };
    },
  );

  return { updated_count, results };
}

export async function guestMarkPaidAll(
  viewerId: string,
  phoneHash: string,
  input: MarkParticipantPaidInput,
): Promise<BulkConfirmAllResult> {
  const detail = await getGuestDetail(viewerId, phoneHash);
  const targets = detail.outstanding.filter((row) => row.payment_status === 'pending');

  const eventsFullySettled: string[] = [];
  const results: BulkSettlementResultItem[] = [];

  for (const row of targets) {
    try {
      const result = await markParticipantPaid(viewerId, row.event_id, row.participant_id, input);
      results.push({
        event_id: row.event_id,
        participant_id: row.participant_id,
        payment_status: result.payment_status,
      });
      if (result.event_fully_settled) {
        eventsFullySettled.push(row.event_id);
      }
    } catch (err) {
      if (isSkippableBulkError(err)) {
        continue;
      }
      throw err;
    }
  }

  return {
    updated_count: results.length,
    events_fully_settled: eventsFullySettled,
    results,
  };
}
