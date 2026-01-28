/**
 * Centralized React Query keys for the application.
 * Using a nested object structure to group related keys.
 */
export const QUERY_KEYS = {
    receipts: {
        all: ['receipts', 'all'] as const,
        list: () => ['receipts'] as const,
        detail: (id: number | string) => ['receipts', id] as const,
        byUnit: (lbaUnitId: number | string) => ['receipts', 'unit', lbaUnitId] as const,
        grouped: ['receipts', 'grouped'] as const,
        totals: (lbaUnitId: number | string) => ['receipts', 'totals', lbaUnitId] as const,
        stats: ['receipts', 'stats'] as const,
        paginated: (filters?: any) => ['receipts', 'paginated', filters] as const,
    },
    lbaUnits: {
        all: ['lba-units', 'all'] as const,
        list: () => ['lba-units'] as const,
        detail: (id: number | string) => ['lba-units', id] as const,
        paginated: () => ['lba-units', 'paginated'] as const,
    },
    settings: {
        companyLogo: ['settings', 'companyLogo'] as const,
    },
} as const;
