'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import { ErrorState } from './error-state';
import { LoadingState } from './loading-state';

interface QueryStateProps<T> {
  query: UseQueryResult<T>;
  loading?: React.ReactNode;
  /** Rendered instead of children when `isEmpty(data)` is true. */
  empty?: React.ReactNode;
  isEmpty?: (data: T) => boolean;
  errorTitle?: string;
  compactError?: boolean;
  children: (data: T) => React.ReactNode;
}

/** Renders loading, error (with retry), empty and success states for a query. */
export function QueryState<T>({
  query,
  loading,
  empty,
  isEmpty,
  errorTitle,
  compactError,
  children,
}: QueryStateProps<T>) {
  if (query.isPending) {
    return <>{loading ?? <LoadingState />}</>;
  }
  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        title={errorTitle}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        size={compactError ? 'compact' : 'default'}
      />
    );
  }
  const data = query.data as T;
  if (empty && isEmpty?.(data)) return <>{empty}</>;
  return <>{children(data)}</>;
}
