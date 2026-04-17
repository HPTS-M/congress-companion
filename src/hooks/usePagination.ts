import { useState, useMemo, useEffect } from 'react';

export interface UsePaginationResult<T> {
  paginatedItems: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  setPage: (page: number) => void;
  startIndex: number;
  endIndex: number;
}

/**
 * Generic client-side pagination over an already-filtered array.
 * Resets to page 1 whenever the underlying length changes (e.g. filter applied).
 */
export function usePagination<T>(items: T[], pageSize = 10): UsePaginationResult<T> {
  const [currentPage, setCurrentPage] = useState(1);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Reset when filter shrinks/grows the dataset
  useEffect(() => {
    setCurrentPage(1);
  }, [totalItems]);

  // Clamp current page if it falls out of range
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

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
    setPage: setCurrentPage,
    startIndex,
    endIndex,
  };
}
