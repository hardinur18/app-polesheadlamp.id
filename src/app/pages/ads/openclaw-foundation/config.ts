import { ADS_MONITORING_FEATURE_ID } from './contracts';

export const ADS_MONITORING_FOUNDATION_CONFIG = {
  featureId: ADS_MONITORING_FEATURE_ID,
  historyWindowDays: 90,
  historySnapshotMinFreshMinutes: 720,
  historyWarmIntervalMs: 21_600_000,
  todayLiveMinFreshMinutes: 10,
  todayLiveRefreshIntervalMs: 900_000,
  todayLiveStaleToleranceMinutes: 15,
  snapshotFinalizeDeadlineWib: '00:15',
  cacheNamespace: `${ADS_MONITORING_FEATURE_ID}:cache`,
  sandboxNamespace: `${ADS_MONITORING_FEATURE_ID}:sandbox`,
  auditNamespace: `${ADS_MONITORING_FEATURE_ID}:audit`,
} as const;
