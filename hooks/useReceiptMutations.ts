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
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to create a new receipt
 */
export function useCreateReceipt() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: {
      receipt: Omit<Receipt, 'id' | 'created_at'>;
      items?: Omit<ReceiptItem, 'id' | 'receipt_id' | 'created_at'>[];
    }) => {
      return await createReceipt(data.receipt, data.items);
    },
    invalidateQueries: user?.id
      ? [
          QUERY_KEYS.receipts.list(user.id) as any,
          QUERY_KEYS.receipts.paginated(user.id) as any,
          QUERY_KEYS.receipts.grouped(user.id) as any,
          QUERY_KEYS.receipts.stats(user.id) as any,
          ['receipts', user.id, 'totals'] as any,
        ]
      : [],
  });
}

/**
 * Hook to update an existing receipt
 */
export function useUpdateReceipt() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: {
      id: number;
      receipt: Omit<Receipt, 'id' | 'created_at' | 'lba_unit_id'>;
      items?: Omit<ReceiptItem, 'id' | 'receipt_id' | 'created_at'>[];
    }) => {
      return await updateReceipt(data.id, data.receipt, data.items);
    },
    invalidateQueries: user?.id
      ? [
          QUERY_KEYS.receipts.list(user.id) as any,
          QUERY_KEYS.receipts.paginated(user.id) as any,
          QUERY_KEYS.receipts.grouped(user.id) as any,
          QUERY_KEYS.receipts.stats(user.id) as any,
          ['receipts', user.id, 'totals'] as any,
        ]
      : [],
  });
}

/**
 * Hook to delete a receipt
 */
export function useDeleteReceipt() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: number) => {
      return await deleteReceipt(id);
    },
    invalidateQueries: user?.id
      ? [
          QUERY_KEYS.receipts.list(user.id) as any,
          QUERY_KEYS.receipts.paginated(user.id) as any,
          QUERY_KEYS.receipts.grouped(user.id) as any,
          QUERY_KEYS.receipts.stats(user.id) as any,
          ['receipts', user.id, 'totals'] as any,
        ]
      : [],
  });
}

/**
 * Hook to create a new LBA unit
 */
export function useCreateLBAUnit() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (unit: Omit<LBAUnit, 'id' | 'created_at'>) => {
      return await createLBAUnit(unit);
    },
    invalidateQueries: user?.id
      ? [
          QUERY_KEYS.lbaUnits.list(user.id) as any,
          QUERY_KEYS.lbaUnits.paginated(user.id) as any,
        ]
      : [],
  });
}
