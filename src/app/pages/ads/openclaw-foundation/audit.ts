import type {
  AdsMonitoringAuditEvent,
  AdsMonitoringRecommendation,
  AdsMonitoringSandboxAction,
} from './contracts';

export const createAdsMonitoringAuditEvent = (
  event: Omit<AdsMonitoringAuditEvent, 'id' | 'occurredAt'> & { id?: string; occurredAt?: string },
): AdsMonitoringAuditEvent => {
  const occurredAt = event.occurredAt || new Date().toISOString();

  return {
    id: event.id || `audit-${occurredAt}`,
    type: event.type,
    entityId: event.entityId,
    actor: event.actor,
    occurredAt,
    payload: event.payload,
  };
};

export const createRecommendationAuditEvent = (
  recommendation: AdsMonitoringRecommendation,
): AdsMonitoringAuditEvent =>
  createAdsMonitoringAuditEvent({
    type: 'recommendation-created',
    entityId: recommendation.id,
    actor: 'system',
    payload: {
      type: recommendation.type,
      priority: recommendation.priority,
      confidence: recommendation.confidence,
      risk: recommendation.risk,
    },
  });

export const createSandboxAuditEvent = (
  action: AdsMonitoringSandboxAction,
  eventType:
    | 'sandbox-action-proposed'
    | 'sandbox-action-approved'
    | 'sandbox-action-rejected'
    | 'sandbox-action-executed'
    | 'sandbox-action-rolled-back',
): AdsMonitoringAuditEvent =>
  createAdsMonitoringAuditEvent({
    type: eventType,
    entityId: action.id,
    actor: 'system',
    payload: {
      actionType: action.type,
      status: action.status,
      recommendationId: action.recommendationId,
    },
  });
