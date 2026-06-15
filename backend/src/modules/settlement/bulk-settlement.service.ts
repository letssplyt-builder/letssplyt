import { AppError } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { getGuestDetail } from './guest-detail.service';
import { getMemberDetail } from './member-detail.service';
import { isOutstandingPaymentStatus } from './outstanding';
import { notifyCreatorMemberPaidAll } from './settlement-push';
import {
  confirmPayment,
  disputePayment,
  markParticipantPaid,
  payerConfirmOffset,
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

function collectMemberDisputeTargets(
  detail: Awaited<ReturnType<typeof getMemberDetail>>,
): Array<{ event_id: string; participant_id: string }> {
  const rows = [...detail.outstanding, ...detail.history];
  return rows
    .filter(
      (row) =>
        row.direction === 'owed_to_me' &&
        (row.payment_status === 'confirmed' || row.payment_status === 'self_reported'),
    )
    .map((row) => ({
      event_id: row.event_id,
      participant_id: row.participant_id,
    }));
}

function collectGuestDisputeTargets(
  detail: Awaited<ReturnType<typeof getGuestDetail>>,
): Array<{ event_id: string; participant_id: string }> {
  const rows = [...detail.outstanding, ...detail.history];
  return rows
    .filter(
      (row) => row.payment_status === 'confirmed' || row.payment_status === 'self_reported',
    )
    .map((row) => ({
      event_id: row.event_id,
      participant_id: row.participant_id,
    }));
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

async function fetchUserDisplayName(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data?.display_name) {
    return 'Someone';
  }

  return data.display_name as string;
}

export async function memberNetSettle(
  viewerId: string,
  counterpartyUserId: string,
  input: SelfReportInput,
): Promise<BulkSelfReportAllResult> {
  const detail = await getMemberDetail(viewerId, counterpartyUserId);

  const owedToMe = detail.outstanding.filter(
    (row) => row.direction === 'owed_to_me' && isOutstandingPaymentStatus(row.payment_status),
  );
  const iOwe = detail.outstanding.filter(
    (row) => row.direction === 'i_owe' && isOutstandingPaymentStatus(row.payment_status),
  );

  const owedToMeTotal = owedToMe.reduce((sum, row) => sum + row.amount, 0);
  const iOweTotal = iOwe.reduce((sum, row) => sum + row.amount, 0);
  const netAmount = owedToMeTotal - iOweTotal;

  if (netAmount > 0) {
    throw new AppError(
      'NET_POSITIVE',
      'Counterparty owes you net — use mark paid or wait for them to pay',
      400,
    );
  }

  if (iOwe.length > 0 && !input.payment_method) {
    throw new AppError('VALIDATION_ERROR', 'payment_method is required when you owe', 400);
  }

  const results: BulkSettlementResultItem[] = [];

  for (const row of owedToMe) {
    try {
      const result = await payerConfirmOffset(
        viewerId,
        row.event_id,
        row.participant_id,
        'net_settlement_offset',
      );
      results.push({
        event_id: row.event_id,
        participant_id: row.participant_id,
        payment_status: result.payment_status,
      });
    } catch (err) {
      if (isSkippableBulkError(err)) continue;
      throw err;
    }
  }

  const paymentInput: SelfReportInput =
    netAmount === 0 && iOwe.length > 0
      ? { payment_method: 'other', note: 'net_settlement_offset' }
      : input;

  for (const row of iOwe) {
    try {
      const result = await selfReportPayment(
        viewerId,
        row.event_id,
        row.participant_id,
        paymentInput,
        { suppressCreatorPaymentPush: true },
      );
      results.push({
        event_id: row.event_id,
        participant_id: row.participant_id,
        payment_status: result.payment_status,
      });
    } catch (err) {
      if (isSkippableBulkError(err)) continue;
      throw err;
    }
  }

  const paidIoweTotal = iOwe.reduce((sum, row) => {
    const paid = results.some(
      (entry) =>
        entry.event_id === row.event_id &&
        entry.participant_id === row.participant_id &&
        entry.payment_status === 'confirmed',
    );
    return paid ? sum + row.amount : sum;
  }, 0);

  if (paidIoweTotal > 0) {
    const memberName = await fetchUserDisplayName(viewerId);
    notifyCreatorMemberPaidAll(
      counterpartyUserId,
      memberName,
      paidIoweTotal,
      detail.currency,
      'en-US',
    );
  }

  return { updated_count: results.length, results };
}

/** @deprecated Alias — implements true net settlement between members. */
export async function memberSelfReportAll(
  viewerId: string,
  counterpartyUserId: string,
  input: SelfReportInput,
): Promise<BulkSelfReportAllResult> {
  return memberNetSettle(viewerId, counterpartyUserId, input);
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
  const targets = collectMemberDisputeTargets(detail);

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
  const targets = collectGuestDisputeTargets(detail);

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
