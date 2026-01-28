import {
  createReceipt,
  updateReceipt,
  deleteReceipt,
  createLBAUnit,
} from '@/lib/receipts';
import type {
  Receipt,
  ReceiptItem,
  LBAUnit,
} from '@/types';
import { useMutation } from './useMutation';
import { QUERY_KEYS } from '@/lib/queryKeys';

/**
 * Hook to create a new receipt
 */
export function useCreateReceipt() {
  return useMutation({
    mutationFn: async (data: {
      receipt: Omit<Receipt, 'id' | 'created_at'>;
      items?: Omit<ReceiptItem, 'id' | 'receipt_id' | 'created_at'>[];
    }) => {
      return await createReceipt(data.receipt, data.items);
    },
    invalidateQueries: [
      QUERY_KEYS.receipts.list() as any,
      QUERY_KEYS.receipts.paginated() as any,
      QUERY_KEYS.receipts.grouped as any,
      QUERY_KEYS.receipts.stats as any,
      ['receipts', 'totals'] as any,
    ],
  });
}

/**
 * Hook to update an existing receipt
 */
export function useUpdateReceipt() {
  return useMutation({
    mutationFn: async (data: {
      id: number;
      receipt: Omit<Receipt, 'id' | 'created_at' | 'lba_unit_id'>;
      items?: Omit<ReceiptItem, 'id' | 'receipt_id' | 'created_at'>[];
    }) => {
      return await updateReceipt(data.id, data.receipt, data.items);
    },
    invalidateQueries: [
      QUERY_KEYS.receipts.list() as any,
      QUERY_KEYS.receipts.paginated() as any,
      QUERY_KEYS.receipts.grouped as any,
      QUERY_KEYS.receipts.stats as any,
      ['receipts', 'totals'] as any,
    ],
  });
}

/**
 * Hook to delete a receipt
 */
export function useDeleteReceipt() {
  return useMutation({
    mutationFn: async (id: number) => {
      return await deleteReceipt(id);
    },
    invalidateQueries: [
      QUERY_KEYS.receipts.list() as any,
      QUERY_KEYS.receipts.paginated() as any,
      QUERY_KEYS.receipts.grouped as any,
      QUERY_KEYS.receipts.stats as any,
      ['receipts', 'totals'] as any,
    ],
  });
}

/**
 * Hook to create a new LBA unit
 */
export function useCreateLBAUnit() {
  return useMutation({
    mutationFn: async (unit: Omit<LBAUnit, 'id' | 'created_at'>) => {
      return await createLBAUnit(unit);
    },
    invalidateQueries: [
      QUERY_KEYS.lbaUnits.list() as any,
      QUERY_KEYS.lbaUnits.paginated() as any,
    ],
  });
}
