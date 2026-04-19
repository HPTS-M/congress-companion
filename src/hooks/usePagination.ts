import { useState, useMemo, useEffect, useCallback } from 'react';

export interface UsePaginationResult<T> {
  paginatedItems: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  startIndex: number;
  endIndex: number;
}

export interface UsePaginationOptions {
  initialPage?: number;
  /** Optional controlled page — when provided, internal state is ignored */
  controlledPage?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

/**
 * Generic client-side pagination over an already-filtered array.
 * Resets to page 1 whenever the underlying length changes (e.g. filter applied).
 * Supports dynamic page size and optional controlled page (URL-driven).
 */
export function usePagination<T>(
  items: T[],
  initialPageSize = 10,
  options: UsePaginationOptions = {},
): UsePaginationResult<T> {
  const { controlledPage, onPageChange, onPageSizeChange } = options;
  const [internalPage, setInternalPage] = useState(options.initialPage ?? 1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const currentPage = controlledPage ?? internalPage;
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Reset when filter shrinks/grows the dataset
  useEffect(() => {
    if (controlledPage === undefined) {
      setInternalPage(1);
    } else {
      onPageChange?.(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalItems]);

  // Clamp current page if it falls out of range
  useEffect(() => {
    if (currentPage > totalPages) {
      if (controlledPage === undefined) setInternalPage(totalPages);
      else onPageChange?.(totalPages);
    }
  }, [currentPage, totalPages, controlledPage, onPageChange]);

  const setPage = useCallback(
    (page: number) => {
      if (controlledPage === undefined) setInternalPage(page);
      onPageChange?.(page);
    },
    [controlledPage, onPageChange],
  );

  const setPageSize = useCallback(
    (size: number) => {
      setPageSizeState(size);
      if (controlledPage === undefined) setInternalPage(1);
      else onPageChange?.(1);
      onPageSizeChange?.(size);
    },
    [controlledPage, onPageChange, onPageSizeChange],
  );

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  return {
    paginatedItems,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    setPage,
    setPageSize,
    startIndex,
    endIndex,
  };
}
