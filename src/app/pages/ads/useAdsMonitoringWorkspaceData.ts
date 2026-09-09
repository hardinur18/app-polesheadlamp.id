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
import { resolveAdAccountAttribution } from './adAccountAttribution';

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
  const {
    orders,
    dailyAds,
    adAccounts,
    adAccountAssignments,
    adAccountOwnerAssignments,
    platforms,
    subChannels,
    users,
  } = useMasterData();
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
  const getAccountAdvertiserIdForRange = React.useCallback(
    (account: { id: string; advertiserId: string }) => {
      const owner = [...adAccountOwnerAssignments]
        .filter(
          (assignment) =>
            assignment.adAccountId === account.id &&
            assignment.status === 'active' &&
            (!assignment.startDate || assignment.startDate <= range.to) &&
            (!assignment.endDate || assignment.endDate >= range.from),
        )
        .sort((left, right) => (right.startDate || '').localeCompare(left.startDate || ''))[0];

      return owner?.advertiserId || account.advertiserId;
    },
    [adAccountOwnerAssignments, range.from, range.to],
  );
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
        if (selectedAdvertiserId !== 'all' && getAccountAdvertiserIdForRange(account) !== selectedAdvertiserId) return false;
        return true;
      }),
    [adAccounts, getAccountAdvertiserIdForRange, selectedAdvertiserId, selectedPlatformId],
  );
  const filteredAccountIds = React.useMemo(
    () => new Set(filteredAdAccounts.map((account) => account.id)),
    [filteredAdAccounts],
  );
  const adAccountById = React.useMemo(
    () => new Map(adAccounts.map((account) => [account.id, account])),
    [adAccounts],
  );
  const resolveDailyAdRow = React.useCallback(
    (row: typeof dailyAds[number]) => {
      const account = adAccountById.get(row.adAccountId);
      if (!account) return row;

      const attribution = resolveAdAccountAttribution({
        account,
        date: row.date,
        ownerAssignments: adAccountOwnerAssignments,
        csAssignments: adAccountAssignments,
        preferredCsId: row.csId,
        fallbackToLatestCsAssignment: true,
      });

      return {
        ...row,
        advertiserId: attribution.advertiserId || row.advertiserId,
        platformId: attribution.platformId || row.platformId,
        subChannelId: attribution.subChannelId || row.subChannelId,
        csId: attribution.csId || row.csId,
      };
    },
    [adAccountAssignments, adAccountById, adAccountOwnerAssignments],
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
      dailyAds.map(resolveDailyAdRow).filter((row) => {
        if (filteredAccountIds.size > 0 && !filteredAccountIds.has(row.adAccountId)) return false;
        if (selectedPlatformId !== 'all' && row.platformId !== selectedPlatformId) return false;
        if (selectedAdvertiserId !== 'all' && row.advertiserId !== selectedAdvertiserId) return false;
        return true;
      }),
    [dailyAds, filteredAccountIds, resolveDailyAdRow, selectedAdvertiserId, selectedPlatformId],
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
