import { useQuery } from '@tanstack/react-query';
import {
  getAllLBAUnits,
  getLBAUnitById,
  getLBAUnitsPaginated,
  PaginatedLBAUnitsParams,
} from '@/lib/receipts';
import type { LBAUnit } from '@/types';
import { usePaginatedQuery } from './usePaginatedQuery';

/**
 * Hook to fetch all LBA units
 */
export function useLBAUnits() {
  return useQuery({
    queryKey: ['lba-units', 'all'],
    queryFn: getAllLBAUnits,
  });
}

/**
 * Hook to fetch a single LBA unit by ID
 */
export function useLBAUnit(id: number | undefined) {
  return useQuery({
    queryKey: ['lba-units', id],
    queryFn: () => (id ? getLBAUnitById(id) : null),
    enabled: !!id,
  });
}

/**
 * Hook to fetch paginated LBA units
 */
export function usePaginatedLBAUnits(pageSize: number = 20) {
  return usePaginatedQuery<LBAUnit>({
    queryKey: ['lba-units', 'paginated'],
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
