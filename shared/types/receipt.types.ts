/** Receipt types — shared between mobile and backend */

export interface ReceiptUploadUrlResponse {
  upload_url: string;
  storage_path: string;
  /** Token for `uploadToSignedUrl` when direct PUT to upload_url fails on a device */
  upload_token: string;
}

export interface ReceiptParseResultItem {
  id?: string;
  name: string;
  unit_price: number;
  quantity: number;
  confidence?: 'high' | 'low';
}

export interface ReceiptAdditionalCharge {
  name: string;
  amount: number;
  confidence?: 'high' | 'low';
}

export type ReceiptDiscountType = 'percent' | 'amount';

export interface ReceiptDiscountLine {
  name: string;
  type: ReceiptDiscountType;
  value: number;
}

/** Editable receipt snapshot for Item Review (from parse or GET event). */
export interface ReceiptReviewSnapshot {
  items: ReceiptParseResultItem[];
  additional_charges: ReceiptAdditionalCharge[];
  discounts: ReceiptDiscountLine[];
  tax_amount: number;
  tip_amount: number;
  fees_amount: number;
  discount_amount: number;
  currency: string;
}

export interface ReceiptConfirmItemInput {
  id?: string;
  name: string;
  price: number;
  quantity: number;
}

export interface ReceiptConfirmChargeInput {
  name: string;
  amount: number;
}

export interface ReceiptConfirmDiscountInput {
  name: string;
  type: ReceiptDiscountType;
  value: number;
}

export interface ReceiptConfirmRequest {
  event_id: string;
  items: ReceiptConfirmItemInput[];
  additional_charges: ReceiptConfirmChargeInput[];
  discounts: ReceiptConfirmDiscountInput[];
  tax: number;
  fees: number;
  tip: number;
  discount_total: number;
}

export interface ReceiptConfirmResponse {
  confirmed: true;
  total_amount: number;
}

export interface ReceiptParseResponse {
  items: ReceiptParseResultItem[];
  additional_charges: ReceiptAdditionalCharge[];
  tax_amount: number;
  tip_amount: number;
  fees_amount: number;
  total_amount: number;
  currency: string;
  storage_path: string;
}

export interface ReceiptItem {
  id: string;
  event_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  confidence_score: number;
  is_low_confidence: boolean;
  is_tax: boolean;
  is_tip: boolean;
  is_fee: boolean;
  is_shared: boolean;
  ai_extracted: boolean;
}
