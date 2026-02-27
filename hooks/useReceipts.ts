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
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to fetch all receipts
 */
export function useReceipts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: user?.id ? QUERY_KEYS.receipts.all(user.id) : ['receipts', 'all'],
    queryFn: getAllReceipts,
    enabled: !!user?.id,
  });
}

/**
 * Hook to fetch a single receipt by ID
 */
export function useReceipt(id: number | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: user?.id && id ? QUERY_KEYS.receipts.detail(user.id, id) : ['receipts', 'detail'],
    queryFn: () => (id ? getReceiptById(id) : null),
    enabled: !!id && !!user?.id,
  });
}

/**
 * Hook to fetch receipts by unit ID
 */
export function useReceiptsByUnit(lbaUnitId: number | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: user?.id && lbaUnitId ? QUERY_KEYS.receipts.byUnit(user.id, lbaUnitId) : ['receipts', 'unit'],
    queryFn: () => (lbaUnitId ? getReceiptsByUnitId(lbaUnitId) : []),
    enabled: !!lbaUnitId && !!user?.id,
  });
}

/**
 * Hook to fetch receipts grouped by LBA
 */
export function useReceiptsGroupedByLBA() {
  const { user } = useAuth();
  return useQuery({
    queryKey: user?.id ? QUERY_KEYS.receipts.grouped(user.id) : ['receipts', 'grouped'],
    queryFn: getReceiptsGroupedByLBA,
    enabled: !!user?.id,
  });
}

/**
 * Hook to fetch receipt totals for a unit
 */
export function useReceiptTotals(lbaUnitId: number | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: user?.id && lbaUnitId ? QUERY_KEYS.receipts.totals(user.id, lbaUnitId) : ['receipts', 'totals'],
    queryFn: () => (lbaUnitId ? getReceiptTotals(lbaUnitId) : null),
    enabled: !!lbaUnitId && !!user?.id,
  });
}

/**
 * Hook to fetch dashboard stats
 */
export function useDashboardStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: user?.id ? QUERY_KEYS.receipts.stats(user.id) : ['receipts', 'stats'],
    queryFn: getDashboardStats,
    enabled: !!user?.id,
  });
}

/**
 * Hook to fetch paginated receipts with filters
 */
export function usePaginatedReceipts(
  filters?: PaginatedReceiptsParams['filters'],
  pageSize: number = 20
) {
  const { user } = useAuth();
  return usePaginatedQuery<ReceiptWithUnit>({
    queryKey: user?.id ? (QUERY_KEYS.receipts.paginated(user.id, filters) as any) : ['receipts', 'paginated'],
    enabled: !!user?.id,
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
