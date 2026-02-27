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
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to fetch all LBA units
 */
export function useLBAUnits() {
  const { user } = useAuth();
  return useQuery({
    queryKey: user?.id ? QUERY_KEYS.lbaUnits.all(user.id) : ['lba-units', 'all'],
    queryFn: getAllLBAUnits,
    enabled: !!user?.id,
  });
}

/**
 * Hook to fetch a single LBA unit by ID
 */
export function useLBAUnit(id: number | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: user?.id && id ? QUERY_KEYS.lbaUnits.detail(user.id, id) : ['lba-units', 'detail'],
    queryFn: () => (id ? getLBAUnitById(id) : null),
    enabled: !!id && !!user?.id,
  });
}

/**
 * Hook to fetch paginated LBA units
 */
export function usePaginatedLBAUnits(pageSize: number = 20) {
  const { user } = useAuth();
  return usePaginatedQuery<LBAUnit>({
    queryKey: user?.id ? QUERY_KEYS.lbaUnits.paginated(user.id) : ['lba-units', 'paginated'],
    enabled: !!user?.id,
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
