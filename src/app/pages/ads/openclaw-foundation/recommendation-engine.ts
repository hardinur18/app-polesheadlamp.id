import type { AdsMonitoringRecommendation } from './contracts';
import type { AdsMonitoringDiagnostic } from './contracts';

export const createAdsMonitoringRecommendations = (
  diagnostics: AdsMonitoringDiagnostic[],
): AdsMonitoringRecommendation[] => {
  return diagnostics.map<AdsMonitoringRecommendation>((diagnostic) => {
    switch (diagnostic.type) {
      case 'attribution-gap':
        return {
          id: 'rec-repair-attribution',
          type: 'repair-attribution',
          priority: diagnostic.severity === 'high' ? 'p1' : 'p2',
          title: 'Audit mapping CS dan subchannel per akun iklan',
          reason: diagnostic.summary,
          evidence: diagnostic.evidence,
          confidence: 0.89,
          risk: 'low',
          approvalRequired: false,
          rollbackPlan: 'Kembalikan view ke fallback manual jika hasil mapping baru menurunkan coverage.',
          relatedDiagnosticIds: [diagnostic.id],
        };
      case 'spend-without-order':
        return {
          id: 'rec-manual-audit-spend-without-order',
          type: 'manual-audit',
          priority: 'p1',
          title: 'Audit akun dengan spend tanpa order terbaca',
          reason: diagnostic.summary,
          evidence: diagnostic.evidence,
          confidence: 0.92,
          risk: 'medium',
          approvalRequired: true,
          rollbackPlan: 'Batalkan rekomendasi dan tandai akun sebagai watch-only jika data manual belum lengkap.',
          relatedDiagnosticIds: [diagnostic.id],
        };
      case 'burn-risk':
        return {
          id: 'rec-review-budget-burn',
          type: 'review-budget',
          priority: 'p2',
          title: 'Review burn ratio dan margin advertiser',
          reason: diagnostic.summary,
          evidence: diagnostic.evidence,
          confidence: 0.78,
          risk: 'low',
          approvalRequired: true,
          rollbackPlan: 'Tidak ada perubahan data operasional; cukup tandai recommendation sebagai rejected.',
          relatedDiagnosticIds: [diagnostic.id],
        };
      case 'cs-overload':
        return {
          id: 'rec-rebalance-cs',
          type: 'rebalance-cs',
          priority: 'p1',
          title: 'Rebalance beban CS yang overload',
          reason: diagnostic.summary,
          evidence: diagnostic.evidence,
          confidence: 0.84,
          risk: 'medium',
          approvalRequired: true,
          rollbackPlan: 'Kembalikan assignment CS ke pola sebelumnya jika service level turun.',
          relatedDiagnosticIds: [diagnostic.id],
        };
      case 'advertiser-concentration':
        return {
          id: 'rec-watch-advertiser-concentration',
          type: 'watch',
          priority: 'p3',
          title: 'Pantau konsentrasi advertiser',
          reason: diagnostic.summary,
          evidence: diagnostic.evidence,
          confidence: 0.75,
          risk: 'low',
          approvalRequired: false,
          rollbackPlan: 'Tidak ada rollback; rekomendasi ini bersifat observasional.',
          relatedDiagnosticIds: [diagnostic.id],
        };
      default:
        return {
          id: `rec-${diagnostic.id}`,
          type: 'watch',
          priority: 'p3',
          title: diagnostic.title,
          reason: diagnostic.summary,
          evidence: diagnostic.evidence,
          confidence: 0.6,
          risk: 'low',
          approvalRequired: false,
          rollbackPlan: 'Tidak ada rollback karena rekomendasi ini belum mengeksekusi aksi.',
          relatedDiagnosticIds: [diagnostic.id],
        };
    }
  });
};
