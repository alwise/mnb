import { useQuery } from '@tanstack/react-query';
import {
  getAllLBAUnits,
  getLBAUnitById,
  getLBAUnitsPaginated,
  PaginatedLBAUnitsParams,
} from '@/lib/receipts';
import type { LBAUnit } from '@/types';
import { usePaginatedQuery } from './usePaginatedQuery';
import { QUERY_KEYS } from '@/lib/queryKeys';

/**
 * Hook to fetch all LBA units
 */
export function useLBAUnits() {
  return useQuery({
    queryKey: QUERY_KEYS.lbaUnits.all,
    queryFn: getAllLBAUnits,
  });
}

/**
 * Hook to fetch a single LBA unit by ID
 */
export function useLBAUnit(id: number | undefined) {
  return useQuery({
    queryKey: id ? QUERY_KEYS.lbaUnits.detail(id) : ['lba-units', 'detail'],
    queryFn: () => (id ? getLBAUnitById(id) : null),
    enabled: !!id,
  });
}

/**
 * Hook to fetch paginated LBA units
 */
export function usePaginatedLBAUnits(pageSize: number = 20) {
  return usePaginatedQuery<LBAUnit>({
    queryKey: QUERY_KEYS.lbaUnits.paginated(),
    queryFn: async ({ limit, offset }) => {
      const result = await getLBAUnitsPaginated({ limit, offset });
      return {
        data: result.data,
        hasMore: result.hasMore,
        total: result.total,
      };
    },
    pageSize,
  });
}
