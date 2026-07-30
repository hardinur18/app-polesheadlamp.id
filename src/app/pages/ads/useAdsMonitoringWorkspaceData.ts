import React from 'react';
import type { DateRange } from 'react-day-picker';
import {
  differenceInCalendarDays,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  subDays,
} from 'date-fns';

import { useMasterData } from '@/app/pages/master-data/context';
import { isAdvertiserRole } from '@/app/data/roleHelpers';
import { useAdsMonitoringFoundation } from './openclaw-foundation';

export type AdsMonitoringWorkspaceOption = {
  id: string;
  name: string;
};

export type AdsMonitoringWorkspaceMode = 'manual' | 'assisted' | 'semi-auto';
export type AdsMonitoringDetailSelection =
  | {
      type: 'advertiser';
      id: string;
    }
  | {
      type: 'account';
      id: string;
    }
  | {
      type: 'cs';
      id: string;
    }
  | {
      type: 'diagnostic';
      id: string;
    }
  | {
      type: 'recommendation';
      id: string;
    };

const toDateRangeParams = (dateRange: DateRange | undefined) => {
  const fallback = new Date();
  const from = dateRange?.from || startOfMonth(fallback);
  const to = dateRange?.to || dateRange?.from || endOfMonth(fallback);

  return {
    from: format(from, 'yyyy-MM-dd'),
    to: format(to, 'yyyy-MM-dd'),
  };
};

const createPreviousRange = (range: { from: string; to: string }) => {
  const fromDate = parseISO(range.from);
  const toDate = parseISO(range.to);
  const spanDays = Math.max(0, differenceInCalendarDays(toDate, fromDate));
  const previousTo = subDays(fromDate, 1);
  const previousFrom = subDays(previousTo, spanDays);

  return {
    from: format(previousFrom, 'yyyy-MM-dd'),
    to: format(previousTo, 'yyyy-MM-dd'),
  };
};

export const useAdsMonitoringWorkspaceData = () => {
  const { orders, dailyAds, adAccounts, platforms, subChannels, users } = useMasterData();
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(() => ({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  }));
  const [selectedPlatformId, setSelectedPlatformId] = React.useState('all');
  const [selectedAdvertiserId, setSelectedAdvertiserId] = React.useState('all');
  const [openClawMode, setOpenClawMode] =
    React.useState<AdsMonitoringWorkspaceMode>('assisted');
  const [compareMode, setCompareMode] = React.useState(false);
  const [selectedDetail, setSelectedDetail] = React.useState<AdsMonitoringDetailSelection | null>(
    null,
  );

  const range = React.useMemo(() => toDateRangeParams(dateRange), [dateRange]);
  const advertiserOptions = React.useMemo<AdsMonitoringWorkspaceOption[]>(
    () =>
      users
        .filter((user) => isAdvertiserRole(user.role) && user.status === 'active')
        .map((user) => ({ id: user.id, name: user.name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [users],
  );
  const platformOptions = React.useMemo<AdsMonitoringWorkspaceOption[]>(
    () =>
      platforms
        .filter((platform) => platform.status === 'active')
        .map((platform) => ({ id: platform.id, name: platform.name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [platforms],
  );
  const filteredAdAccounts = React.useMemo(
    () =>
      adAccounts.filter((account) => {
        if (selectedPlatformId !== 'all' && account.platformId !== selectedPlatformId) return false;
        if (selectedAdvertiserId !== 'all' && account.advertiserId !== selectedAdvertiserId) return false;
        return true;
      }),
    [adAccounts, selectedAdvertiserId, selectedPlatformId],
  );
  const filteredAccountIds = React.useMemo(
    () => new Set(filteredAdAccounts.map((account) => account.id)),
    [filteredAdAccounts],
  );
  const filteredOrders = React.useMemo(
    () =>
      orders.filter((order) => {
        if (selectedPlatformId !== 'all' && order.platformId !== selectedPlatformId) return false;
        if (selectedAdvertiserId !== 'all' && order.advertiserId !== selectedAdvertiserId) return false;
        return true;
      }),
    [orders, selectedAdvertiserId, selectedPlatformId],
  );
  const filteredDailyAds = React.useMemo(
    () =>
      dailyAds.filter((row) => {
        if (filteredAccountIds.size > 0) {
          return filteredAccountIds.has(row.adAccountId);
        }
        if (selectedPlatformId !== 'all' && row.platformId !== selectedPlatformId) return false;
        if (selectedAdvertiserId !== 'all' && row.advertiserId !== selectedAdvertiserId) return false;
        return selectedPlatformId === 'all' && selectedAdvertiserId === 'all';
      }),
    [dailyAds, filteredAccountIds, selectedAdvertiserId, selectedPlatformId],
  );
  const compareRange = React.useMemo(() => createPreviousRange(range), [range]);
  const foundation = useAdsMonitoringFoundation({
    range,
    orders: filteredOrders,
    dailyAds: filteredDailyAds,
    adAccounts: filteredAdAccounts,
    platforms,
    subChannels,
    users,
  });
  const compareFoundation = useAdsMonitoringFoundation({
    range: compareRange,
    orders: filteredOrders,
    dailyAds: filteredDailyAds,
    adAccounts: filteredAdAccounts,
    platforms,
    subChannels,
    users,
  });
  const workspaceControls = React.useMemo(
    () => ({
      platformOptions,
      advertiserOptions,
      selectedPlatformId,
      selectedAdvertiserId,
      openClawMode,
      compareMode,
      activeFilterCount:
        (selectedPlatformId !== 'all' ? 1 : 0) + (selectedAdvertiserId !== 'all' ? 1 : 0),
      onPlatformChange: setSelectedPlatformId,
      onAdvertiserChange: setSelectedAdvertiserId,
      onOpenClawModeChange: setOpenClawMode,
      onCompareModeChange: setCompareMode,
    }),
    [
      advertiserOptions,
      compareMode,
      openClawMode,
      platformOptions,
      selectedAdvertiserId,
      selectedPlatformId,
    ],
  );

  return {
    dateRange,
    setDateRange,
    range,
    compareRange,
    selectedPlatformId,
    setSelectedPlatformId,
    selectedAdvertiserId,
    setSelectedAdvertiserId,
    openClawMode,
    setOpenClawMode,
    compareMode,
    setCompareMode,
    selectedDetail,
    setSelectedDetail,
    platformOptions,
    advertiserOptions,
    activeFilterCount:
      (selectedPlatformId !== 'all' ? 1 : 0) + (selectedAdvertiserId !== 'all' ? 1 : 0),
    compareReadModel: compareMode ? compareFoundation.readModel : null,
    compareDiagnostics: compareMode ? compareFoundation.diagnostics : [],
    compareRecommendations: compareMode ? compareFoundation.recommendations : [],
    workspaceControls,
    ...foundation,
  };
};
