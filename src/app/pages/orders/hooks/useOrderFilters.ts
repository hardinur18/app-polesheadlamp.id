import { useState, useMemo, useEffect, useCallback } from 'react';
import { DateRange } from 'react-day-picker';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { Order } from '../../master-data/data';
import { normalizeReasonFilterValue } from '../orderHelpers';
import { getCancelReasonOptions } from '../cancelReasonOptions';
import {
  isAdminManagementRole,
  isAdvertiserRole,
  isCsRole,
  isFinanceRole,
  isTechnicianRole,
} from '@/app/data/roleHelpers';

interface UseOrderFiltersParams {
  orders: Order[];
  users: any[];
  services: any[];
  vehicles: any[];
  branches: any[];
  platforms: any[];
  subChannels: any[];
  cancelReasons: any[];
  currentUser: any;
  currentRole: string;
  conflictOrderIds?: ReadonlySet<string>;
}

export function useOrderFilters({
  orders,
  users,
  services,
  vehicles,
  branches,
  platforms,
  subChannels,
  cancelReasons,
  currentUser,
  currentRole,
  conflictOrderIds,
}: UseOrderFiltersParams) {
  // Role flags
  const isAdminManagementUser = isAdminManagementRole(currentRole);
  const isAdvertiserUser = isAdvertiserRole(currentRole);
  const isCsUser = isCsRole(currentRole);
  const isTechnicianUser = isTechnicianRole(currentRole);
  const isFinanceUser = isFinanceRole(currentRole);
  const canAccessAllOrders = isAdminManagementUser || isFinanceUser;

  // Search
  const [search, setSearch] = useState('');

  // View & Status
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cancelReasonFilter, setCancelReasonFilter] = useState<string>('all');

  // Filters
  const [technicianFilter, setTechnicianFilter] = useState<string>('all');
  const [csFilter, setCsFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<string>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [advertiserFilter, setAdvertiserFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [paymentValidationFilter, setPaymentValidationFilter] = useState<string>('all');
  const [affiliateFilter, setAffiliateFilter] = useState<string>('all');
  const [subChannelFilter, setSubChannelFilter] = useState<string>('all');
  const [scheduleConflictFilter, setScheduleConflictFilter] = useState<string>('all');

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date()
  });
  const [dateFilterMode, setDateFilterMode] = useState<'service' | 'lead'>('service');

  // Derived filter lists
  const technicians = users.filter((u) => isTechnicianRole(u.role) && u.status === 'active');
  const csUsers = users.filter((u) => isCsRole(u.role) && u.status === 'active');
  const advertisers = users.filter((u) => isAdvertiserRole(u.role) && u.status === 'active');
  const activeServices = services.filter(s => s.status === 'active');
  const serviceCategories = Array.from(new Set(services.map(s => s.category)));
  const affiliateNames = Array.from(new Set(orders.map(o => o.affiliateName).filter(Boolean))) as string[];

  // Accessible orders (role scoping)
  const accessibleOrders = useMemo(() => {
    return orders.filter(order => {
      if (canAccessAllOrders) return true;
      if (isCsUser) return order.csId === currentUser?.id;
      if (isTechnicianUser) return order.technicianId === currentUser?.id;
      if (isAdvertiserUser) {
        const subordinateCsIds = users
          .filter((u) => u.parentUserId === currentUser?.id)
          .map((u) => u.id);
        return order.advertiserId === currentUser?.id || (order.csId && subordinateCsIds.includes(order.csId));
      }
      return false;
    });
  }, [canAccessAllOrders, currentUser, isAdvertiserUser, isCsUser, isTechnicianUser, orders, users]);

  // Available filter options based on accessible orders
  const availableBranches = useMemo(() => {
    const usedIds = new Set(accessibleOrders.map(o => o.branchId).filter(Boolean));
    return branches.filter(b => usedIds.has(b.id));
  }, [accessibleOrders, branches]);

  const availableTechnicians = useMemo(() => {
    const usedIds = new Set(accessibleOrders.map(o => o.technicianId).filter(Boolean));
    return technicians.filter(t => usedIds.has(t.id));
  }, [accessibleOrders, technicians]);

  const availableCS = useMemo(() => {
    const usedIds = new Set(accessibleOrders.map(o => o.csId).filter(Boolean));
    return csUsers.filter(c => usedIds.has(c.id));
  }, [accessibleOrders, csUsers]);

  const availablePlatforms = useMemo(() => {
    const usedIds = new Set(accessibleOrders.map(o => o.platformId).filter(Boolean));
    return platforms.filter(p => usedIds.has(p.id));
  }, [accessibleOrders, platforms]);

  const availableSubChannels = useMemo(() => {
    const usedIds = new Set(accessibleOrders.map(o => (o as any).subChannelId).filter(Boolean));
    return subChannels.filter(s => usedIds.has(s.id));
  }, [accessibleOrders, subChannels]);

  // Base filtered orders (all filters except status)
  const filteredOrdersBase = useMemo(() => {
    return orders.filter(order => {
      // Role-based Access Control
      let hasAccess = true;

      if (canAccessAllOrders) {
        hasAccess = true;
      } else if (isCsUser) {
        hasAccess = order.csId === currentUser?.id;
      } else if (isTechnicianUser) {
        hasAccess = order.technicianId === currentUser?.id;
      } else if (isAdvertiserUser) {
        const subordinateCsIds = users
          .filter(u => u.parentUserId === currentUser?.id)
          .map(u => u.id);
        hasAccess = order.advertiserId === currentUser?.id || (order.csId && subordinateCsIds.includes(order.csId));
      } else {
        hasAccess = false;
      }

      if (!hasAccess) return false;

      const matchesSearch =
        order.customerName.toLowerCase().includes(search.toLowerCase()) ||
        order.id.toLowerCase().includes(search.toLowerCase()) ||
        order.customerPhone.toLowerCase().includes(search.toLowerCase()) ||
        order.address.toLowerCase().includes(search.toLowerCase()) ||
        order.price.toString().includes(search);

      const matchesTechnician = technicianFilter === 'all' || order.technicianId === technicianFilter;
      const matchesCS = csFilter === 'all' || order.csId === csFilter;
      const matchesService = serviceFilter === 'all' || order.serviceId === serviceFilter;
      const matchesAdvertiser = advertiserFilter === 'all' || order.advertiserId === advertiserFilter;
      const matchesBranch = branchFilter === 'all' || order.branchId === branchFilter;

      const matchesServiceCategory = serviceCategoryFilter === 'all' || order.serviceCategory === serviceCategoryFilter;
      const matchesVehicle = vehicleFilter === 'all' || order.vehicleId === vehicleFilter;
      const matchesPlatform = platformFilter === 'all' || order.platformId === platformFilter;
      const matchesArea = areaFilter === 'all' || order.areaId === areaFilter;
      const matchesPaymentType = paymentTypeFilter === 'all' || order.paymentType === paymentTypeFilter;
      const matchesPaymentMethod = paymentMethodFilter === 'all' || order.paymentMethodId === paymentMethodFilter;
      const matchesPaymentStatus = paymentStatusFilter === 'all' || order.paymentStatus === paymentStatusFilter;
      const matchesPaymentValidation = paymentValidationFilter === 'all' || order.paymentValidation === paymentValidationFilter;
      const matchesAffiliate = affiliateFilter === 'all' || order.affiliateName === affiliateFilter;
      const matchesSubChannel = subChannelFilter === 'all' || (order as any).subChannelId === subChannelFilter;
      const matchesScheduleConflict = scheduleConflictFilter === 'all' || Boolean(conflictOrderIds?.has(order.id));

      let matchesDate = true;
      if (dateRange?.from) {
        let orderDate: Date;
        if (dateFilterMode === 'service') {
          orderDate = new Date(`${order.serviceDate}T${order.serviceTime || '00:00'}`);
        } else {
          orderDate = new Date(`${order.leadDate}T00:00:00`);
        }

        if (!isNaN(orderDate.getTime())) {
          const start = startOfDay(dateRange.from);
          const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
          matchesDate = isWithinInterval(orderDate, { start, end });
        } else {
          matchesDate = false;
        }
      }

      return matchesSearch && matchesTechnician && matchesCS && matchesService && matchesAdvertiser && matchesBranch &&
             matchesServiceCategory && matchesVehicle && matchesPlatform && matchesArea && matchesPaymentType &&
             matchesPaymentMethod && matchesPaymentStatus && matchesPaymentValidation && matchesAffiliate && matchesDate && matchesSubChannel &&
             matchesScheduleConflict;
    });
  }, [advertiserFilter, affiliateFilter, areaFilter, branchFilter, canAccessAllOrders, csFilter, currentUser,
      conflictOrderIds,
      dateRange, dateFilterMode, isAdvertiserUser, isCsUser, isTechnicianUser, orders, paymentMethodFilter,
      paymentStatusFilter, paymentTypeFilter, paymentValidationFilter, platformFilter, search, serviceCategoryFilter,
      scheduleConflictFilter, serviceFilter, subChannelFilter, technicianFilter, users, vehicleFilter
  ]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredOrdersBase.forEach(o => {
      const status = o.status || 'pending';
      counts[status] = (counts[status] || 0) + 1;
      if (status === 'teknisi_completed') {
        counts['qc'] = (counts['qc'] || 0) + 1;
      }
    });
    return counts;
  }, [filteredOrdersBase]);

  // Cancel reason filter options
  const cancelReasonFilterOptions = useMemo(() => {
    const reasonCounts = new Map<string, { label: string; count: number }>();

    filteredOrdersBase.forEach((order) => {
      if (order.status !== 'cancelled') return;
      const reasonLabel = order.cancelReason?.trim();
      if (!reasonLabel) return;

      const normalizedLabel = normalizeReasonFilterValue(reasonLabel);
      const existing = reasonCounts.get(normalizedLabel);
      if (existing) {
        existing.count += 1;
        return;
      }
      reasonCounts.set(normalizedLabel, { label: reasonLabel, count: 1 });
    });

    const preferredOrder = getCancelReasonOptions('cancelled', cancelReasons).map((reason) =>
      normalizeReasonFilterValue(reason.label),
    );
    const seen = new Set<string>();
    const options: Array<{ label: string; count: number }> = [];

    preferredOrder.forEach((normalizedLabel) => {
      const option = reasonCounts.get(normalizedLabel);
      if (!option || seen.has(normalizedLabel)) return;
      options.push(option);
      seen.add(normalizedLabel);
    });

    Array.from(reasonCounts.entries())
      .filter(([normalizedLabel]) => !seen.has(normalizedLabel))
      .sort((left, right) => left[1].label.localeCompare(right[1].label, 'id'))
      .forEach(([, option]) => {
        options.push(option);
      });

    return options;
  }, [filteredOrdersBase, cancelReasons]);

  // Final filtered orders (status + cancel reason applied)
  const filteredOrders = useMemo(() => {
    return filteredOrdersBase.filter((order) => {
      const matchesStatus =
        statusFilter === 'all' ||
        order.status === statusFilter ||
        (statusFilter === 'qc' && order.status === 'teknisi_completed');

      if (!matchesStatus) return false;

      if (statusFilter !== 'cancelled' || cancelReasonFilter === 'all') {
        return true;
      }

      return normalizeReasonFilterValue(order.cancelReason) === normalizeReasonFilterValue(cancelReasonFilter);
    });
  }, [filteredOrdersBase, statusFilter, cancelReasonFilter]);

  // Auto-reset cancel reason filter
  useEffect(() => {
    if (statusFilter !== 'cancelled') {
      setCancelReasonFilter('all');
      return;
    }

    if (
      cancelReasonFilter !== 'all' &&
      !cancelReasonFilterOptions.some(
        (option) =>
          normalizeReasonFilterValue(option.label) === normalizeReasonFilterValue(cancelReasonFilter),
      )
    ) {
      setCancelReasonFilter('all');
    }
  }, [statusFilter, cancelReasonFilter, cancelReasonFilterOptions]);

  // Statistics
  const stats = useMemo(() => {
    const data = filteredOrdersBase;
    const total = data.length;
    const done = data.filter(o => o.status === 'done').length;
    const pending = data.filter(o => o.status === 'pending').length;
    const reschedule = data.filter(o => o.status === 'reschedule').length;
    const cancelled = data.filter(o => o.status === 'cancelled').length;
    const processing = data.filter(o => o.status === 'processing').length;
    const otw = data.filter(o => o.status === 'otw').length;
    const working = data.filter(o => o.status === 'working').length;
    const qc = data.filter(o => o.status === 'qc' || o.status === 'teknisi_completed').length;

    const revenue = data
      .filter(o => o.status === 'done')
      .reduce((acc, curr) => acc + (curr.price || 0), 0);

    const doneUnits = data
      .filter(o => o.status === 'done')
      .reduce((acc, curr) => acc + (curr.units || 1), 0);

    return { total, done, pending, reschedule, cancelled, processing, otw, working, qc, revenue, doneUnits };
  }, [filteredOrdersBase]);

  // Active filter count
  const activeFilterCount = [
    technicianFilter, csFilter, advertiserFilter, branchFilter,
    serviceFilter, serviceCategoryFilter, vehicleFilter, platformFilter,
    subChannelFilter, areaFilter, scheduleConflictFilter, paymentTypeFilter, paymentMethodFilter,
    paymentStatusFilter, paymentValidationFilter, affiliateFilter, cancelReasonFilter
  ].filter(f => f !== 'all').length;

  // Reset all sheet filters
  const resetSheetFilters = useCallback(() => {
    setTechnicianFilter('all');
    setCsFilter('all');
    setAdvertiserFilter('all');
    setBranchFilter('all');
    setServiceFilter('all');
    setServiceCategoryFilter('all');
    setVehicleFilter('all');
    setPlatformFilter('all');
    setSubChannelFilter('all');
    setAreaFilter('all');
    setScheduleConflictFilter('all');
    setPaymentTypeFilter('all');
    setPaymentMethodFilter('all');
    setPaymentStatusFilter('all');
    setPaymentValidationFilter('all');
    setAffiliateFilter('all');
    setCancelReasonFilter('all');
  }, []);

  return {
    // Search
    search, setSearch,
    // Status
    statusFilter, setStatusFilter,
    cancelReasonFilter, setCancelReasonFilter,
    // Filters
    technicianFilter, setTechnicianFilter,
    csFilter, setCsFilter,
    serviceFilter, setServiceFilter,
    serviceCategoryFilter, setServiceCategoryFilter,
    vehicleFilter, setVehicleFilter,
    platformFilter, setPlatformFilter,
    advertiserFilter, setAdvertiserFilter,
    branchFilter, setBranchFilter,
    areaFilter, setAreaFilter,
    paymentTypeFilter, setPaymentTypeFilter,
    paymentMethodFilter, setPaymentMethodFilter,
    paymentStatusFilter, setPaymentStatusFilter,
    paymentValidationFilter, setPaymentValidationFilter,
    affiliateFilter, setAffiliateFilter,
    subChannelFilter, setSubChannelFilter,
    scheduleConflictFilter, setScheduleConflictFilter,
    // Date
    dateRange, setDateRange,
    dateFilterMode, setDateFilterMode,
    // Computed
    filteredOrdersBase,
    filteredOrders,
    statusCounts,
    cancelReasonFilterOptions,
    stats,
    activeFilterCount,
    accessibleOrders,
    // Available filter options
    availableBranches,
    availableTechnicians,
    availableCS,
    availablePlatforms,
    availableSubChannels,
    // Derived lists
    technicians,
    csUsers,
    advertisers,
    activeServices,
    serviceCategories,
    affiliateNames,
    // Reset
    resetSheetFilters,
    // Role flags (pass-through)
    canAccessAllOrders,
    isAdminManagementUser,
    isAdvertiserUser,
    isCsUser,
    isTechnicianUser,
    isFinanceUser,
  };
}
