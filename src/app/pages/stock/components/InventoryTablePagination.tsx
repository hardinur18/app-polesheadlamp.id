import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

export const INVENTORY_TABLE_PAGE_SIZE = 50;

export function useInventoryTablePagination<T>(items: T[], resetKey?: unknown) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const totalPages = Math.max(1, Math.ceil(items.length / INVENTORY_TABLE_PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * INVENTORY_TABLE_PAGE_SIZE;
  const paginatedItems = useMemo(
    () => items.slice(startIndex, startIndex + INVENTORY_TABLE_PAGE_SIZE),
    [items, startIndex],
  );

  return {
    page: safePage,
    totalPages,
    totalItems: items.length,
    startIndex,
    startItem: items.length === 0 ? 0 : startIndex + 1,
    endItem: Math.min(items.length, startIndex + INVENTORY_TABLE_PAGE_SIZE),
    paginatedItems,
    setPage,
  };
}

interface InventoryTablePaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  startItem: number;
  endItem: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}

export function InventoryTablePagination({
  page,
  totalPages,
  totalItems,
  startItem,
  endItem,
  setPage,
}: InventoryTablePaginationProps) {
  if (totalItems === 0) {
    return null;
  }

  return (
    <div className="inventoryTablePagination">
      <span className="inventoryTablePaginationMeta">
        Menampilkan {startItem}-{endItem} dari {totalItems} data, maks. {INVENTORY_TABLE_PAGE_SIZE} baris per halaman
      </span>
      <div className="inventoryTablePaginationControls">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="inventoryPaginationButton"
          disabled={page <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="inventoryTablePaginationPage">
          {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="inventoryPaginationButton"
          disabled={page >= totalPages}
          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          aria-label="Halaman berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
