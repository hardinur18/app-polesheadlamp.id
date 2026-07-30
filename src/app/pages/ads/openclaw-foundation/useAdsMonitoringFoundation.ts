import React from 'react';
import type {
  AdAccount,
  DailyAd,
  Order,
  Platform,
  SubChannel,
  User,
} from '@/app/pages/master-data/data';

import { ADS_MONITORING_FOUNDATION_CONFIG } from './config';
import { createAdsMonitoringDiagnostics } from './diagnostics-engine';
import { createAdsMonitoringRecommendations } from './recommendation-engine';
import { createAdsMonitoringReadModel } from './read-model';
import type { AdsMonitoringDateRange } from './contracts';

type UseAdsMonitoringFoundationInput = {
  range: AdsMonitoringDateRange;
  orders: Order[];
  dailyAds: DailyAd[];
  adAccounts: AdAccount[];
  platforms: Platform[];
  subChannels: SubChannel[];
  users: User[];
};

export const useAdsMonitoringFoundation = (input: UseAdsMonitoringFoundationInput) => {
  return React.useMemo(() => {
    const readModel = createAdsMonitoringReadModel(input);
    const diagnostics = createAdsMonitoringDiagnostics(readModel);
    const recommendations = createAdsMonitoringRecommendations(diagnostics);

    return {
      config: ADS_MONITORING_FOUNDATION_CONFIG,
      readModel,
      diagnostics,
      recommendations,
      generatedAt: new Date().toISOString(),
    };
  }, [
    input.adAccounts,
    input.dailyAds,
    input.orders,
    input.platforms,
    input.range.from,
    input.range.to,
    input.subChannels,
    input.users,
  ]);
};
