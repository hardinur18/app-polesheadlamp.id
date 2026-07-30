import { useState, useMemo, useEffect, useCallback } from 'react';
import { Order } from '../../master-data/data';

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
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [filteredOrdersBase, statusFilter, cancelReasonFilter]);

  const requestSort = useCallback((key: string) => {
    setSortConfig(prev => {
      let direction: 'asc' | 'desc' | null = 'asc';
      if (prev && prev.key === key) {
        if (prev.direction === 'asc') {
          direction = 'desc';
        } else if (prev.direction === 'desc') {
          direction = null;
        }
      }
      return direction ? { key, direction } : null;
    });
  }, []);

  // Sorting
  const sortedOrders = useMemo(() => {
    let sortableItems = [...filteredOrders];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (sortConfig.key === 'price') {
          return sortConfig.direction === 'asc' ? (a.price - b.price) : (b.price - a.price);
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
