import type { AdsMonitoringDiagnostic } from './contracts';
import type { AdsMonitoringReadModel } from './read-model';

export const createAdsMonitoringDiagnostics = (
  readModel: AdsMonitoringReadModel,
): AdsMonitoringDiagnostic[] => {
  const diagnostics: AdsMonitoringDiagnostic[] = [];

  if (readModel.summary.totalOrders > 0 && readModel.summary.attributionCoverageRate < 0.8) {
    diagnostics.push({
      id: 'diag-attribution-gap',
      type: 'attribution-gap',
      severity: readModel.summary.attributionCoverageRate < 0.6 ? 'high' : 'medium',
      title: 'Coverage atribusi akun iklan masih rendah',
      summary:
        'Sebagian order belum berhasil dipetakan aman ke akun iklan spesifik. Ini mengurangi akurasi CPL dan breakdown performa.',
      evidence: [
        `Coverage saat ini ${Math.round(readModel.summary.attributionCoverageRate * 100)}%`,
        `${readModel.summary.unresolvedOrders} order masih unresolved`,
      ],
    });
  }

  const spendWithoutOrders = readModel.accountMatrix.filter(
    (row) => row.spend > 0 && row.attributedOrders === 0,
  );
  if (spendWithoutOrders.length > 0) {
    diagnostics.push({
      id: 'diag-spend-without-order',
      type: 'spend-without-order',
      severity: spendWithoutOrders.length >= 3 ? 'high' : 'medium',
      title: 'Ada akun dengan spend tetapi order belum terbaca',
      summary:
        'Lane media terbaca, tetapi order belum berhasil masuk ke akun tertentu. Perlu audit mapping CS, subchannel, atau histori daily ads.',
      evidence: spendWithoutOrders.slice(0, 4).map((row) => `${row.accountName} • spend Rp${row.spend.toLocaleString('id-ID')}`),
      relatedEntityIds: spendWithoutOrders.map((row) => row.adAccountId),
    });
  }

  const highBurnRows = readModel.accountMatrix.filter(
    (row) => row.spend > 0 && row.burn / row.spend >= 1.17,
  );
  if (highBurnRows.length > 0) {
    diagnostics.push({
      id: 'diag-burn-risk',
      type: 'burn-risk',
      severity: 'medium',
      title: 'Burn ratio beberapa akun cukup tinggi',
      summary:
        'PPN dan fee membuat burn naik cukup jauh dari spend bersih. Ini perlu dipakai saat evaluasi advertiser dan margin.',
      evidence: highBurnRows.slice(0, 4).map((row) => `${row.accountName} • burn ratio ${(row.burn / row.spend).toFixed(2)}x`),
      relatedEntityIds: highBurnRows.map((row) => row.adAccountId),
    });
  }

  const overloadedCs = readModel.csMatrix.filter(
    (row) => row.orders >= 15 && row.closeRate < 0.3,
  );
  if (overloadedCs.length > 0) {
    diagnostics.push({
      id: 'diag-cs-overload',
      type: 'cs-overload',
      severity: overloadedCs.length >= 2 ? 'high' : 'medium',
      title: 'Ada CS dengan beban tinggi dan close rate rendah',
      summary:
        'Distribusi order masuk perlu diaudit. Ini kandidat kuat untuk rebalance atau bantuan follow-up.',
      evidence: overloadedCs.map((row) => `${row.name} • ${row.orders} order • rate ${Math.round(row.closeRate * 100)}%`),
      relatedEntityIds: overloadedCs.map((row) => row.id),
    });
  }

  const topAdvertiser = readModel.advertiserLeaderboard[0];
  if (topAdvertiser && readModel.summary.totalOrders > 0) {
    const concentration = topAdvertiser.orders / readModel.summary.totalOrders;
    if (concentration >= 0.55) {
      diagnostics.push({
        id: 'diag-advertiser-concentration',
        type: 'advertiser-concentration',
        severity: concentration >= 0.7 ? 'high' : 'medium',
        title: 'Distribusi order terlalu terkonsentrasi',
        summary:
          'Satu advertiser menyumbang porsi order yang terlalu dominan. Ini penting untuk risk management dan evaluasi kapasitas.',
        evidence: [
          `${topAdvertiser.name} menyumbang ${Math.round(concentration * 100)}% dari order`,
          `${topAdvertiser.orders} dari total ${readModel.summary.totalOrders} order`,
        ],
        relatedEntityIds: [topAdvertiser.id],
      });
    }
  }

  return diagnostics;
};
