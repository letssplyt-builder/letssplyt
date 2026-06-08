/** Receipt types — shared between mobile and backend */

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
