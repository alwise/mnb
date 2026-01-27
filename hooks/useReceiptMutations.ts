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
      ['receipts'],
      ['receipts', 'paginated'],
      ['receipts', 'grouped'],
      ['receipts', 'stats'],
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
      ['receipts'],
      ['receipts', 'paginated'],
      ['receipts', 'grouped'],
      ['receipts', 'stats'],
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
      ['receipts'],
      ['receipts', 'paginated'],
      ['receipts', 'grouped'],
      ['receipts', 'stats'],
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
      ['lba-units'],
      ['lba-units', 'paginated'],
    ],
  });
}
