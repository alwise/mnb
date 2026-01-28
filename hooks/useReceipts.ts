import { useQuery } from '@tanstack/react-query';
import {
  getAllReceipts,
  getReceiptById,
  getReceiptsByUnitId,
  getReceiptsGroupedByLBA,
  getReceiptTotals,
  getDashboardStats,
  getReceiptsPaginated,
  PaginatedReceiptsParams,
} from '@/lib/receipts';
import type { ReceiptWithUnit } from '@/types';
import { usePaginatedQuery } from './usePaginatedQuery';
import { QUERY_KEYS } from '@/lib/queryKeys';

/**
 * Hook to fetch all receipts
 */
export function useReceipts() {
  return useQuery({
    queryKey: QUERY_KEYS.receipts.all,
    queryFn: getAllReceipts,
  });
}

/**
 * Hook to fetch a single receipt by ID
 */
export function useReceipt(id: number | undefined) {
  return useQuery({
    queryKey: id ? QUERY_KEYS.receipts.detail(id) : ['receipts', 'detail'],
    queryFn: () => (id ? getReceiptById(id) : null),
    enabled: !!id,
  });
}

/**
 * Hook to fetch receipts by unit ID
 */
export function useReceiptsByUnit(lbaUnitId: number | undefined) {
  return useQuery({
    queryKey: lbaUnitId ? QUERY_KEYS.receipts.byUnit(lbaUnitId) : ['receipts', 'unit'],
    queryFn: () => (lbaUnitId ? getReceiptsByUnitId(lbaUnitId) : []),
    enabled: !!lbaUnitId,
  });
}

/**
 * Hook to fetch receipts grouped by LBA
 */
export function useReceiptsGroupedByLBA() {
  return useQuery({
    queryKey: QUERY_KEYS.receipts.grouped,
    queryFn: getReceiptsGroupedByLBA,
  });
}

/**
 * Hook to fetch receipt totals for a unit
 */
export function useReceiptTotals(lbaUnitId: number | undefined) {
  return useQuery({
    queryKey: lbaUnitId ? QUERY_KEYS.receipts.totals(lbaUnitId) : ['receipts', 'totals'],
    queryFn: () => (lbaUnitId ? getReceiptTotals(lbaUnitId) : null),
    enabled: !!lbaUnitId,
  });
}

/**
 * Hook to fetch dashboard stats
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: QUERY_KEYS.receipts.stats,
    queryFn: getDashboardStats,
  });
}

/**
 * Hook to fetch paginated receipts with filters
 */
export function usePaginatedReceipts(
  filters?: PaginatedReceiptsParams['filters'],
  pageSize: number = 20
) {
  return usePaginatedQuery<ReceiptWithUnit>({
    queryKey: QUERY_KEYS.receipts.paginated(filters) as any,
    queryFn: async ({ limit, offset }) => {
      const result = await getReceiptsPaginated({
        limit,
        offset,
        filters,
      });
      return {
        data: result.data,
        hasMore: result.hasMore,
        total: result.total,
      };
    },
    pageSize,
  });
}
