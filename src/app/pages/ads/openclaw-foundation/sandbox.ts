import type { AdsMonitoringRecommendation, AdsMonitoringSandboxAction } from './contracts';

export const createAdsMonitoringSandboxAction = (
  input: Omit<AdsMonitoringSandboxAction, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
    id?: string;
    status?: AdsMonitoringSandboxAction['status'];
  },
): AdsMonitoringSandboxAction => {
  const now = new Date().toISOString();
  return {
    id: input.id || `sandbox-${now}`,
    type: input.type,
    title: input.title,
    payload: input.payload,
    recommendationId: input.recommendationId,
    status: input.status || 'proposed',
    createdAt: now,
    updatedAt: now,
  };
};

export const createSandboxActionFromRecommendation = (
  recommendation: AdsMonitoringRecommendation,
): AdsMonitoringSandboxAction => {
  return createAdsMonitoringSandboxAction({
    type:
      recommendation.type === 'rebalance-cs'
        ? 'reassign-cs'
        : recommendation.type === 'repair-attribution'
          ? 'repair-attribution'
          : recommendation.type === 'review-budget'
            ? 'budget-shift'
            : 'request-manual-review',
    title: recommendation.title,
    recommendationId: recommendation.id,
    payload: {
      reason: recommendation.reason,
      evidence: recommendation.evidence,
      risk: recommendation.risk,
      approvalRequired: recommendation.approvalRequired,
    },
  });
};
