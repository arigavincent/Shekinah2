import { useEffect, useMemo, useState, type DependencyList } from "react";

export function usePaginatedItems<T>(items: T[], pageSize: number, resetDeps: DependencyList) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, resetDeps);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const currentPage = Math.min(page, totalPages);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [currentPage, items, pageSize]);

  return {
    page: currentPage,
    setPage,
    totalPages,
    pagedItems
  };
}
