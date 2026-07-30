import type { AdAccount, DailyAd, Order } from '@/app/pages/master-data/data';

import {
  type AdsMonitoringAttributionMode,
  type AdsMonitoringDateRange,
  getOrderCreatedDateKey,
  isDateWithinRange,
} from './contracts';

type AccountAttributionProfile = {
  adAccountId: string;
  advertiserId: string;
  platformId: string;
  primaryCsId: string | null;
  primarySubChannelId: string | null;
  csHistory: string[];
  subChannelHistory: string[];
  spendWeight: number;
};

export type AdsMonitoringAttributedOrder = {
  orderId: string;
  adAccountId: string | null;
  advertiserId: string | null;
  platformId: string | null;
  mode: AdsMonitoringAttributionMode;
  dateKey: string | null;
};

export type AdsMonitoringAttributionCounter = {
  adAccountId: string;
  advertiserId: string;
  platformId: string;
  exactOrders: number;
  primaryCsOrders: number;
  primarySubChannelOrders: number;
  historicalSetOrders: number;
  proportionalOrders: number;
  totalOrders: number;
};

export type AdsMonitoringAttributionResult = {
  profiles: AccountAttributionProfile[];
  counters: AdsMonitoringAttributionCounter[];
  attributedOrders: AdsMonitoringAttributedOrder[];
  unresolvedOrders: number;
  coverageRate: number;
};

const buildGroupKey = (advertiserId?: string | null, platformId?: string | null) =>
  advertiserId && platformId ? `${advertiserId}::${platformId}` : null;

const buildHistoryCounter = (values: Array<string | undefined>) => {
  const counter = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counter.set(value, (counter.get(value) || 0) + 1);
  }
  return counter;
};

const getPrimaryValue = (counter: Map<string, number>) => {
  const ranked = [...counter.entries()].sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return left[0].localeCompare(right[0]);
  });
  return ranked[0]?.[0] || null;
};

export const buildAdsMonitoringAttributionProfiles = (
  adAccounts: AdAccount[],
  dailyAds: DailyAd[],
): AccountAttributionProfile[] => {
  return adAccounts.map((account) => {
    const history = dailyAds.filter((row) => row.adAccountId === account.id);
    const csCounter = buildHistoryCounter(history.map((row) => row.csId));
    const subChannelCounter = buildHistoryCounter(history.map((row) => row.subChannelId));
    const spendWeight = history.reduce((sum, row) => sum + Math.max(row.amountSpent || 0, 0), 0);

    return {
      adAccountId: account.id,
      advertiserId: account.advertiserId,
      platformId: account.platformId,
      primaryCsId: getPrimaryValue(csCounter),
      primarySubChannelId: getPrimaryValue(subChannelCounter),
      csHistory: [...csCounter.keys()],
      subChannelHistory: [...subChannelCounter.keys()],
      spendWeight,
    };
  });
};

const createCounterMap = (profiles: AccountAttributionProfile[]) =>
  profiles.reduce<Map<string, AdsMonitoringAttributionCounter>>((acc, profile) => {
    acc.set(profile.adAccountId, {
      adAccountId: profile.adAccountId,
      advertiserId: profile.advertiserId,
      platformId: profile.platformId,
      exactOrders: 0,
      primaryCsOrders: 0,
      primarySubChannelOrders: 0,
      historicalSetOrders: 0,
      proportionalOrders: 0,
      totalOrders: 0,
    });
    return acc;
  }, new Map());

const findCandidateProfiles = (
  profilesByGroup: Map<string, AccountAttributionProfile[]>,
  order: Pick<Order, 'advertiserId' | 'platformId'>,
) => {
  const groupKey = buildGroupKey(order.advertiserId, order.platformId);
  if (!groupKey) return [];
  return profilesByGroup.get(groupKey) || [];
};

export const attributeOrdersToAdAccounts = (
  orders: Order[],
  adAccounts: AdAccount[],
  dailyAds: DailyAd[],
  range: AdsMonitoringDateRange,
): AdsMonitoringAttributionResult => {
  const activeAccounts = adAccounts.filter((account) => account.status === 'active');
  const profiles = buildAdsMonitoringAttributionProfiles(activeAccounts, dailyAds);
  const profilesByGroup = profiles.reduce<Map<string, AccountAttributionProfile[]>>((acc, profile) => {
    const groupKey = buildGroupKey(profile.advertiserId, profile.platformId);
    if (!groupKey) return acc;
    const current = acc.get(groupKey) || [];
    current.push(profile);
    acc.set(groupKey, current);
    return acc;
  }, new Map());

  const counters = createCounterMap(profiles);
  const attributedOrders: AdsMonitoringAttributedOrder[] = [];
  const unresolvedByGroup = new Map<string, AdsMonitoringAttributedOrder[]>();

  const relevantOrders = orders.filter((order) =>
    isDateWithinRange(getOrderCreatedDateKey(order), range),
  );

  for (const order of relevantOrders) {
    const dateKey = getOrderCreatedDateKey(order);
    const candidates = findCandidateProfiles(profilesByGroup, order);

    if (candidates.length === 0) {
      attributedOrders.push({
        orderId: order.id,
        adAccountId: null,
        advertiserId: order.advertiserId || null,
        platformId: order.platformId || null,
        mode: 'unresolved',
        dateKey,
      });
      continue;
    }

    if (candidates.length === 1) {
      const only = candidates[0];
      const counter = counters.get(only.adAccountId);
      if (counter) {
        counter.exactOrders += 1;
        counter.totalOrders += 1;
      }
      attributedOrders.push({
        orderId: order.id,
        adAccountId: only.adAccountId,
        advertiserId: only.advertiserId,
        platformId: only.platformId,
        mode: 'single-account',
        dateKey,
      });
      continue;
    }

    const exactCandidate = candidates.find(
      (candidate) =>
        Boolean(order.csId && order.subChannelId) &&
        candidate.primaryCsId === order.csId &&
        candidate.primarySubChannelId === order.subChannelId,
    );

    if (exactCandidate) {
      const counter = counters.get(exactCandidate.adAccountId);
      if (counter) {
        counter.exactOrders += 1;
        counter.totalOrders += 1;
      }
      attributedOrders.push({
        orderId: order.id,
        adAccountId: exactCandidate.adAccountId,
        advertiserId: exactCandidate.advertiserId,
        platformId: exactCandidate.platformId,
        mode: 'exact',
        dateKey,
      });
      continue;
    }

    const primaryCsCandidate = candidates.find(
      (candidate) => Boolean(order.csId) && candidate.primaryCsId === order.csId,
    );
    if (primaryCsCandidate) {
      const counter = counters.get(primaryCsCandidate.adAccountId);
      if (counter) {
        counter.primaryCsOrders += 1;
        counter.totalOrders += 1;
      }
      attributedOrders.push({
        orderId: order.id,
        adAccountId: primaryCsCandidate.adAccountId,
        advertiserId: primaryCsCandidate.advertiserId,
        platformId: primaryCsCandidate.platformId,
        mode: 'primary-cs',
        dateKey,
      });
      continue;
    }

    const primarySubChannelCandidate = candidates.find(
      (candidate) =>
        Boolean(order.subChannelId) && candidate.primarySubChannelId === order.subChannelId,
    );
    if (primarySubChannelCandidate) {
      const counter = counters.get(primarySubChannelCandidate.adAccountId);
      if (counter) {
        counter.primarySubChannelOrders += 1;
        counter.totalOrders += 1;
      }
      attributedOrders.push({
        orderId: order.id,
        adAccountId: primarySubChannelCandidate.adAccountId,
        advertiserId: primarySubChannelCandidate.advertiserId,
        platformId: primarySubChannelCandidate.platformId,
        mode: 'primary-subchannel',
        dateKey,
      });
      continue;
    }

    const historicalSetCandidate = candidates.find(
      (candidate) =>
        (Boolean(order.csId) && candidate.csHistory.includes(order.csId || '')) ||
        (Boolean(order.subChannelId) &&
          candidate.subChannelHistory.includes(order.subChannelId || '')),
    );
    if (historicalSetCandidate) {
      const counter = counters.get(historicalSetCandidate.adAccountId);
      if (counter) {
        counter.historicalSetOrders += 1;
        counter.totalOrders += 1;
      }
      attributedOrders.push({
        orderId: order.id,
        adAccountId: historicalSetCandidate.adAccountId,
        advertiserId: historicalSetCandidate.advertiserId,
        platformId: historicalSetCandidate.platformId,
        mode: 'historical-set',
        dateKey,
      });
      continue;
    }

    const groupKey = buildGroupKey(order.advertiserId, order.platformId);
    const unresolvedOrder: AdsMonitoringAttributedOrder = {
      orderId: order.id,
      adAccountId: null,
      advertiserId: order.advertiserId || null,
      platformId: order.platformId || null,
      mode: 'proportional',
      dateKey,
    };

    attributedOrders.push(unresolvedOrder);
    if (groupKey) {
      const current = unresolvedByGroup.get(groupKey) || [];
      current.push(unresolvedOrder);
      unresolvedByGroup.set(groupKey, current);
    }
  }

  for (const [groupKey, unresolvedOrdersForGroup] of unresolvedByGroup.entries()) {
    const candidates = profilesByGroup.get(groupKey) || [];
    if (candidates.length === 0) continue;

    const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.spendWeight, 0);
    const weighted = candidates
      .map((candidate) => {
        const weight = totalWeight > 0 ? candidate.spendWeight / totalWeight : 1 / candidates.length;
        const share = weight * unresolvedOrdersForGroup.length;
        return {
          profile: candidate,
          base: Math.floor(share),
          fraction: share - Math.floor(share),
        };
      })
      .sort((left, right) => {
        if (right.fraction !== left.fraction) return right.fraction - left.fraction;
        if (right.profile.spendWeight !== left.profile.spendWeight) {
          return right.profile.spendWeight - left.profile.spendWeight;
        }
        return left.profile.adAccountId.localeCompare(right.profile.adAccountId);
      });

    let remaining = unresolvedOrdersForGroup.length;
    for (const item of weighted) {
      const allocated = item.base + (remaining > weighted.length ? 1 : 0);
      const next = Math.min(allocated, remaining);
      if (next > 0) {
        const counter = counters.get(item.profile.adAccountId);
        if (counter) {
          counter.proportionalOrders += next;
          counter.totalOrders += next;
        }
        remaining -= next;
      }
    }

    if (remaining > 0) {
      for (const item of weighted) {
        if (remaining <= 0) break;
        const counter = counters.get(item.profile.adAccountId);
        if (!counter) continue;
        counter.proportionalOrders += 1;
        counter.totalOrders += 1;
        remaining -= 1;
      }
    }
  }

  const resolvedOrders = attributedOrders.filter((order) => order.adAccountId).length;

  return {
    profiles,
    counters: [...counters.values()].sort((left, right) => right.totalOrders - left.totalOrders),
    attributedOrders,
    unresolvedOrders: attributedOrders.length - resolvedOrders,
    coverageRate: attributedOrders.length > 0 ? resolvedOrders / attributedOrders.length : 0,
  };
};
