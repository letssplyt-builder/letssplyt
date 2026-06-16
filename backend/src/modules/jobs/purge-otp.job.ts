import logger from '../../infrastructure/logger';
import { purgeExpiredOTPs } from '../../infrastructure/otp/otp.service';

export interface OtpPurgeResult {
  ok: true;
  deleted: number;
}

/** Delete expired unverified OTP rows (QStash schedule: every 15 minutes). */
export async function runExpiredOtpPurge(): Promise<OtpPurgeResult> {
  const deleted = await purgeExpiredOTPs();

  logger.info({
    msg: 'Expired OTP purge complete',
    deleted,
  });

  return { ok: true, deleted };
}
