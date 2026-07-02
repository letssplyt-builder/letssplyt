import type { ReceiptReviewSnapshot } from '@letssplyt/shared/receipt.types';

/** Receipt quick view is available after shares went out and a scanned receipt exists. */
export function canViewSharedReceipt(
  messagesSentAt: string | null | undefined,
  receiptReview: ReceiptReviewSnapshot | undefined,
): boolean {
  return Boolean(messagesSentAt && receiptReview);
}
