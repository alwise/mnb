export interface LBAUnit {
  id?: number;
  unit: string;
  lba_name: string;
  crop: string;
  season: string;
  unit_head: string;
  qci_name: string;
  lba_code: string;
  created_at?: string;
}

export interface Receipt {
  id?: number;
  lba_unit_id: number;
  lba_name?: string;
  date: string;
  whr_number: string;
  description: string;
  credit_amount: number;
  debit_amount: number;
  weight: number;
  balance_ghc: number;
  previous_balance: number;
  mts: number;
  bags: number;
  signature?: string;
  created_at?: string;
}

export interface ReceiptItem {
  id?: number;
  receipt_id: number;
  description: string;
  credit_amount: number;
  debit_amount: number;
  weight: number;
  mts: number;
  bags: number;
  item_order: number;
  signature?: string;
  created_at?: string;
}

export interface ReceiptTotals {
  lba_unit_id: number;
  cumulative_credit: number;
  cumulative_debit: number;
  cumulative_mts: number;
  cumulative_bags: number;
  last_updated?: string;
}

export interface ReceiptWithUnit extends Receipt {
  unit?: string;
  lba_code?: string;
  lba_name?: string;
  crop?: string;
  season?: string;
  unit_head?: string;
  qci_name?: string;
  item_signatures?: string;
  items?: ReceiptItem[];
}

export interface ReceiptGroupedByLBA {
  lba_unit_id: number;
  unit: string;
  lba_name: string;
  lba_code: string;
  crop?: string;
  season?: string;
  receipts: ReceiptWithUnit[];
  outstanding_balance: number;
}

export interface ReceiptHistory {
  id?: number;
  receipt_id: number;
  snapshot_data: string; // JSON string of the receipt and items at the time of update
  updated_at: string;
  change_summary?: string; // Optional summary of what changed
}
