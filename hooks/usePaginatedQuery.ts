import {
  useInfiniteQuery,
  UseInfiniteQueryOptions,
  UseInfiniteQueryResult,
  InfiniteData,
  QueryKey,
} from "@tanstack/react-query";

export interface PaginatedResponse<T> {
  data: T[];
  hasMore: boolean;
  total?: number;
}

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface UsePaginatedQueryOptions<TData, TError = Error> extends Omit<
  UseInfiniteQueryOptions<
    PaginatedResponse<TData>,
    TError,
    InfiniteData<PaginatedResponse<TData>, number>,
    QueryKey,
    number
  >,
  "queryFn" | "queryKey" | "getNextPageParam" | "initialPageParam"
> {
  queryKey: QueryKey;
  queryFn: (params: PaginationParams) => Promise<PaginatedResponse<TData>>;
  pageSize?: number;
}

/**
 * Reusable hook for paginated queries with "load more" functionality
 *
 * @example
 * const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = usePaginatedQuery({
 *   queryKey: ['receipts'],
 *   queryFn: async ({ limit, offset }) => {
 *     const receipts = await getReceiptsPaginated({ limit, offset });
 *     return {
 *       data: receipts,
 *       hasMore: receipts.length === limit,
 *     };
 *   },
 *   pageSize: 20,
 * });
 */
export function usePaginatedQuery<TData, TError = Error>(
  options: UsePaginatedQueryOptions<TData, TError>,
): UseInfiniteQueryResult<InfiniteData<PaginatedResponse<TData>, number>, TError> {
  const { queryKey, queryFn, pageSize = 20, ...restOptions } = options;

  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 0 }) => {
      return queryFn({
        limit: pageSize,
        offset: pageParam as number,
      });
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) {
        return undefined;
      }
      return allPages.reduce((total, page) => total + page.data.length, 0);
    },
    initialPageParam: 0,
    ...restOptions,
  });
}
