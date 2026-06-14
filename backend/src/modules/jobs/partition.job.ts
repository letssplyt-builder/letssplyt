import { AppError } from '../../infrastructure/errors';
import logger from '../../infrastructure/logger';
import { supabaseAdmin } from '../../infrastructure/supabase';

export interface AnalyticsPartitionResult {
  partition: string;
  created: boolean;
  startDate: string;
  endDate: string;
}

export interface AnalyticsPartitionOptions {
  year?: number;
  month?: number;
}

function resolveTargetMonth(year?: number, month?: number): { year: number; month: number } {
  if (year !== undefined && month !== undefined) {
    if (month < 1 || month > 12) {
      throw new AppError('INVALID_PARTITION_MONTH', 'Month must be 1–12', 400);
    }
    return { year, month };
  }

  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1;
  const targetYear = currentMonth === 12 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  const targetMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  return { year: targetYear, month: targetMonth };
}

function formatUtcDate(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function buildPartitionSpec(year: number, month: number): {
  partitionName: string;
  startDate: string;
  endDate: string;
} {
  const partitionName = `analytics_events_${year}_${String(month).padStart(2, '0')}`;
  const endYear = month === 12 ? year + 1 : year;
  const endMonth = month === 12 ? 1 : month + 1;

  return {
    partitionName,
    startDate: formatUtcDate(year, month),
    endDate: formatUtcDate(endYear, endMonth),
  };
}

/**
 * Creates the monthly analytics_events partition (IF NOT EXISTS via RPC).
 * Default target: next calendar month from now.
 */
export async function runAnalyticsPartitionCreation(
  options: AnalyticsPartitionOptions = {},
): Promise<AnalyticsPartitionResult> {
  const { year, month } = resolveTargetMonth(options.year, options.month);
  const { partitionName, startDate, endDate } = buildPartitionSpec(year, month);

  const { error } = await supabaseAdmin.rpc('create_analytics_partition', {
    partition_name: partitionName,
    start_date: startDate,
    end_date: endDate,
  });

  if (error) {
    throw new AppError('ANALYTICS_PARTITION_FAILED', error.message, 500);
  }

  logger.info({
    msg: 'Analytics partition created',
    partition: partitionName,
    startDate,
    endDate,
  });

  return {
    partition: partitionName,
    created: true,
    startDate,
    endDate,
  };
}
