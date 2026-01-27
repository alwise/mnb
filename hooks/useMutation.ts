import {
  useMutation as useReactQueryMutation,
  UseMutationOptions as UseReactQueryMutationOptions,
  useQueryClient,
} from "@tanstack/react-query";

export interface UseMutationOptions<
  TData,
  TError = Error,
  TVariables = void,
> extends Omit<
  UseReactQueryMutationOptions<TData, TError, TVariables>,
  "mutationFn"
> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  invalidateQueries?: string[][];
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: TError, variables: TVariables) => void | Promise<void>;
}

/**
 * Enhanced mutation hook that automatically invalidates queries after successful mutations
 *
 * @example
 * const createReceipt = useMutation({
 *   mutationFn: createReceiptMutation,
 *   invalidateQueries: [['receipts']],
 *   onSuccess: () => {
 *     console.log('Receipt created!');
 *   },
 * });
 */
export function useMutation<TData, TError = Error, TVariables = void>(
  options: UseMutationOptions<TData, TError, TVariables>,
) {
  const queryClient = useQueryClient();
  const {
    invalidateQueries = [],
    onSuccess,
    onError,
    ...restOptions
  } = options;

  return useReactQueryMutation({
    ...restOptions,
    onSuccess: async (data, variables, context) => {
      // Invalidate specified queries
      for (const queryKey of invalidateQueries) {
        await queryClient.invalidateQueries({ queryKey });
      }

      // Call custom onSuccess if provided
      if (onSuccess) {
        await onSuccess(data, variables);
      }
    },
    onError: async (error, variables, context) => {
      if (onError) {
        await onError(error, variables);
      }
    },
  });
}
