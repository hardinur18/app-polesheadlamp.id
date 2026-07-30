import type {
  AdAccount,
  DailyAd,
  Order,
  Platform,
  SubChannel,
  User,
} from '@/app/pages/master-data/data';
import { isAdvertiserRole, isCsRole } from '@/app/data/roleHelpers';

import { attributeOrdersToAdAccounts, type AdsMonitoringAttributionResult } from './attribution-engine';
import {
  type AdsMonitoringDateRange,
  getDailyAdDateKey,
  getOrderCreatedDateKey,
  isClosedOrderLike,
  isDateWithinRange,
} from './contracts';

export type AdsMonitoringReadModelInput = {
  range: AdsMonitoringDateRange;
  orders: Order[];
  dailyAds: DailyAd[];
  adAccounts: AdAccount[];
  platforms: Platform[];
  subChannels: SubChannel[];
  users: User[];
};

export type AdsMonitoringLeaderboardRow = {
  id: string;
  name: string;
  orders: number;
  completedOrders: number;
  spend: number;
  burn: number;
  revenue: number;
  closeRate: number;
};

export type AdsMonitoringAccountReadRow = {
  adAccountId: string;
  accountName: string;
  advertiserId: string;
  advertiserName: string;
  platformId: string;
  platformName: string;
  spend: number;
  burn: number;
  dashboardLeads: number;
  attributedOrders: number;
  completedOrders: number;
  revenue: number;
  closeRate: number;
};

export type AdsMonitoringReadModel = {
  range: AdsMonitoringDateRange;
  summary: {
    totalOrders: number;
    completedOrders: number;
    totalSpend: number;
    totalBurn: number;
    totalDashboardLeads: number;
    totalRevenue: number;
    estimatedGrossMargin: number;
    costPerLead: number;
    costPerOrder: number;
    costPerClosing: number;
    closingRate: number;
    advertiserCount: number;
    csCount: number;
    activeAccountCount: number;
    attributionCoverageRate: number;
    unresolvedOrders: number;
  };
  advertiserLeaderboard: AdsMonitoringLeaderboardRow[];
  csMatrix: AdsMonitoringLeaderboardRow[];
  accountMatrix: AdsMonitoringAccountReadRow[];
  attribution: AdsMonitoringAttributionResult;
};

const getOrderRevenue = (order: Pick<Order, 'income' | 'price' | 'units'>) => {
  const income = Number(order.income || 0);
  if (income > 0) return income;

  const price = Number(order.price || 0);
  const units = Math.max(1, Number(order.units || 0) || 1);
  return price * units;
};

export const createAdsMonitoringReadModel = (
  input: AdsMonitoringReadModelInput,
): AdsMonitoringReadModel => {
  const relevantOrders = input.orders.filter((order) =>
    isDateWithinRange(getOrderCreatedDateKey(order), input.range),
  );
  const relevantDailyAds = input.dailyAds.filter((row) =>
    isDateWithinRange(getDailyAdDateKey(row), input.range),
  );

  const advertiserMap = new Map(
    input.users
      .filter((user) => isAdvertiserRole(user.role))
      .map((advertiser) => [advertiser.id, advertiser.name]),
  );
  const csMap = new Map(
    input.users.filter((user) => isCsRole(user.role)).map((cs) => [cs.id, cs.name]),
  );
  const platformMap = new Map(input.platforms.map((platform) => [platform.id, platform.name]));

  const attribution = attributeOrdersToAdAccounts(
    relevantOrders,
    input.adAccounts,
    relevantDailyAds,
    input.range,
  );
  const relevantOrdersById = new Map(relevantOrders.map((order) => [order.id, order]));
  const attributedClosedStatsByAccountId = attribution.attributedOrders.reduce<
    Map<
      string,
      {
        completedOrders: number;
        revenue: number;
      }
    >
  >((acc, attributedOrder) => {
    if (!attributedOrder.adAccountId) return acc;

    const sourceOrder = relevantOrdersById.get(attributedOrder.orderId);
    if (!sourceOrder || !isClosedOrderLike(sourceOrder)) return acc;

    const current = acc.get(attributedOrder.adAccountId) || {
      completedOrders: 0,
      revenue: 0,
    };

    current.completedOrders += 1;
    current.revenue += getOrderRevenue(sourceOrder);
    acc.set(attributedOrder.adAccountId, current);
    return acc;
  }, new Map());

  const dailyAdsByAccount = relevantDailyAds.reduce<Map<string, DailyAd[]>>((acc, row) => {
    const current = acc.get(row.adAccountId) || [];
    current.push(row);
    acc.set(row.adAccountId, current);
    return acc;
  }, new Map());

  const accountMatrix = input.adAccounts
    .filter((account) => account.status === 'active')
    .map<AdsMonitoringAccountReadRow>((account) => {
      const accountDailyAds = dailyAdsByAccount.get(account.id) || [];
      const spend = accountDailyAds.reduce((sum, row) => sum + (row.amountSpent || 0), 0);
      const burn = accountDailyAds.reduce(
        (sum, row) => sum + (row.amountSpent || 0) + (row.ppnAmount || 0) + (row.feeAmount || 0),
        0,
      );
      const dashboardLeads = accountDailyAds.reduce((sum, row) => sum + (row.leadsDashboard || 0), 0);
      const attributionCounter = attribution.counters.find((counter) => counter.adAccountId === account.id);
      const attributedClosedStats = attributedClosedStatsByAccountId.get(account.id);
      const attributedOrders = attributionCounter?.totalOrders || 0;
      const completedOrders = attributedClosedStats?.completedOrders || 0;

      return {
        adAccountId: account.id,
        accountName: account.accountName,
        advertiserId: account.advertiserId,
        advertiserName: advertiserMap.get(account.advertiserId) || 'Advertiser belum terdaftar',
        platformId: account.platformId,
        platformName: platformMap.get(account.platformId) || 'Platform belum terdaftar',
        spend,
        burn,
        dashboardLeads,
        attributedOrders,
        completedOrders,
        revenue: attributedClosedStats?.revenue || 0,
        closeRate: attributedOrders > 0 ? completedOrders / attributedOrders : 0,
      };
    })
    .sort((left, right) => right.attributedOrders - left.attributedOrders || right.spend - left.spend);

  const advertiserLeaderboard = [...advertiserMap.entries()]
    .map<AdsMonitoringLeaderboardRow>(([advertiserId, name]) => {
      const advertiserOrders = relevantOrders.filter((order) => order.advertiserId === advertiserId);
      const advertiserAccounts = accountMatrix.filter((row) => row.advertiserId === advertiserId);
      const spend = advertiserAccounts.reduce((sum, row) => sum + row.spend, 0);
      const burn = advertiserAccounts.reduce((sum, row) => sum + row.burn, 0);
      const completedOrders = advertiserOrders.filter((order) => isClosedOrderLike(order)).length;
      const revenue = advertiserOrders
        .filter((order) => isClosedOrderLike(order))
        .reduce((sum, order) => sum + getOrderRevenue(order), 0);

      return {
        id: advertiserId,
        name,
        orders: advertiserOrders.length,
        completedOrders,
        spend,
        burn,
        revenue,
        closeRate: advertiserOrders.length > 0 ? completedOrders / advertiserOrders.length : 0,
      };
    })
    .filter((row) => row.orders > 0 || row.spend > 0)
    .sort((left, right) => right.orders - left.orders || right.spend - left.spend);

  const csMatrix = [...csMap.entries()]
    .map<AdsMonitoringLeaderboardRow>(([csId, name]) => {
      const csOrders = relevantOrders.filter((order) => order.csId === csId);
      const completedOrders = csOrders.filter((order) => isClosedOrderLike(order)).length;
      const revenue = csOrders
        .filter((order) => isClosedOrderLike(order))
        .reduce((sum, order) => sum + getOrderRevenue(order), 0);

      return {
        id: csId,
        name,
        orders: csOrders.length,
        completedOrders,
        spend: 0,
        burn: 0,
        revenue,
        closeRate: csOrders.length > 0 ? completedOrders / csOrders.length : 0,
      };
    })
    .filter((row) => row.orders > 0)
    .sort((left, right) => right.orders - left.orders || right.closeRate - left.closeRate);

  const totalSpend = accountMatrix.reduce((sum, row) => sum + row.spend, 0);
  const totalBurn = accountMatrix.reduce((sum, row) => sum + row.burn, 0);
  const totalDashboardLeads = accountMatrix.reduce((sum, row) => sum + row.dashboardLeads, 0);
  const completedOrders = relevantOrders.filter((order) => isClosedOrderLike(order)).length;
  const totalRevenue = relevantOrders
    .filter((order) => isClosedOrderLike(order))
    .reduce((sum, order) => sum + getOrderRevenue(order), 0);

  return {
    range: input.range,
    summary: {
      totalOrders: relevantOrders.length,
      completedOrders,
      totalSpend,
      totalBurn,
      totalDashboardLeads,
      totalRevenue,
      estimatedGrossMargin: totalRevenue - totalBurn,
      costPerLead: totalDashboardLeads > 0 ? totalSpend / totalDashboardLeads : 0,
      costPerOrder: relevantOrders.length > 0 ? totalSpend / relevantOrders.length : 0,
      costPerClosing: completedOrders > 0 ? totalSpend / completedOrders : 0,
      closingRate: relevantOrders.length > 0 ? completedOrders / relevantOrders.length : 0,
      advertiserCount: advertiserLeaderboard.length,
      csCount: csMatrix.length,
      activeAccountCount: accountMatrix.filter((row) => row.spend > 0 || row.attributedOrders > 0).length,
      attributionCoverageRate: attribution.coverageRate,
      unresolvedOrders: attribution.unresolvedOrders,
    },
    advertiserLeaderboard,
    csMatrix,
    accountMatrix,
    attribution,
  };
};
