import { useState, useMemo, useEffect, useCallback } from 'react';
import { Order } from '../../master-data/data';

const normalizePrice = (value: Order['price']) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

interface UseOrderPaginationParams {
  filteredOrders: Order[];
  filteredOrdersBase: Order[];
  statusFilter: string;
  cancelReasonFilter: string;
}

export function useOrderPagination({
  filteredOrders,
  filteredOrdersBase,
  statusFilter,
  cancelReasonFilter,
}: UseOrderPaginationParams) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [filteredOrdersBase, statusFilter, cancelReasonFilter]);

  const requestSort = useCallback((key: string) => {
    setCurrentPage(1);
    setSortConfig(prev => {
      const firstDirection: 'asc' | 'desc' = key === 'price' ? 'desc' : 'asc';
      if (!prev || prev.key !== key) {
        return { key, direction: firstDirection };
      }

      if (key === 'price') {
        return { key, direction: prev.direction === 'desc' ? 'asc' : 'desc' };
      }

      return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  }, []);

  // Sorting
  const sortedOrders = useMemo(() => {
    let sortableItems = [...filteredOrders];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (sortConfig.key === 'price') {
          const priceA = normalizePrice(a.price);
          const priceB = normalizePrice(b.price);
          const priceDelta = sortConfig.direction === 'asc' ? (priceA - priceB) : (priceB - priceA);
          return priceDelta || a.id.localeCompare(b.id);
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredOrders, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedOrders.slice(start, start + itemsPerPage);
  }, [sortedOrders, currentPage, itemsPerPage]);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginatedOrders.map(o => o.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [paginatedOrders]);

  const handleSelectRow = useCallback((id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const newSelected = new Set(prev);
      if (checked) newSelected.add(id);
      else newSelected.delete(id);
      return newSelected;
    });
  }, []);

  return {
    currentPage, setCurrentPage,
    itemsPerPage, setItemsPerPage,
    selectedIds, setSelectedIds,
    sortConfig,
    requestSort,
    sortedOrders,
    totalPages,
    paginatedOrders,
    handleSelectAll,
    handleSelectRow,
  };
}
