/**
 * Centralized React Query keys for the application.
 * All keys are scoped by userId to ensure user-specific cache isolation.
 */
export const QUERY_KEYS = {
    receipts: {
        all: (userId: number | string) => ['receipts', userId, 'all'] as const,
        list: (userId: number | string) => ['receipts', userId] as const,
        detail: (userId: number | string, id: number | string) => ['receipts', userId, id] as const,
        byUnit: (userId: number | string, lbaUnitId: number | string) => ['receipts', userId, 'unit', lbaUnitId] as const,
        grouped: (userId: number | string) => ['receipts', userId, 'grouped'] as const,
        totals: (userId: number | string, lbaUnitId: number | string) => ['receipts', userId, 'totals', lbaUnitId] as const,
        stats: (userId: number | string) => ['receipts', userId, 'stats'] as const,
        paginated: (userId: number | string, filters?: any) => ['receipts', userId, 'paginated', filters] as const,
    },
    lbaUnits: {
        all: (userId: number | string) => ['lba-units', userId, 'all'] as const,
        list: (userId: number | string) => ['lba-units', userId] as const,
        detail: (userId: number | string, id: number | string) => ['lba-units', userId, id] as const,
        paginated: (userId: number | string) => ['lba-units', userId, 'paginated'] as const,
    },
    settings: {
        companyLogo: (userId: number | string) => ['settings', userId, 'companyLogo'] as const,
    },
} as const;
