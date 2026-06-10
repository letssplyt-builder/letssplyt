/** Receipt types — shared between mobile and backend */

export interface ReceiptUploadUrlResponse {
  upload_url: string;
  storage_path: string;
  /** Token for `uploadToSignedUrl` when direct PUT to upload_url fails on a device */
  upload_token: string;
}

export interface ReceiptParseResultItem {
  name: string;
  unit_price: number;
  quantity: number;
  confidence?: 'high' | 'low';
}

/** Placeholder parse response until E07-S02 A1 agent fills real items. */
export interface ReceiptParseResponse {
  items: ReceiptParseResultItem[];
  tax_amount: number;
  tip_amount: number;
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
  is_shared: boolean;
  ai_extracted: boolean;
}
