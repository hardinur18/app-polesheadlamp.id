import { Badge } from '@/app/components/ui/badge';
import { Card } from '@/app/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { AdsMonitoringDetailDrawer } from './components/AdsMonitoringDetailDrawer';
import { AdsMonitoringWorkspaceFrame } from './components/AdsMonitoringWorkspaceFrame';
import {
  formatAdsCurrency,
  formatAdsNumber,
  formatAdsPercent,
} from './adsMonitoringFormatters';
import { useAdsMonitoringWorkspaceData } from './useAdsMonitoringWorkspaceData';

export function AdsMonitoringAdvertiserMatrixPage() {
  const {
    dateRange,
    setDateRange,
    readModel,
    diagnostics,
    recommendations,
    workspaceControls,
    selectedDetail,
    setSelectedDetail,
  } = useAdsMonitoringWorkspaceData();

  const advertiserRows = readModel.advertiserLeaderboard.map((row) => {
    const advertiserAccounts = readModel.accountMatrix.filter((account) => account.advertiserId === row.id);
    const accountIds = advertiserAccounts.map((account) => account.adAccountId);
    const dashboardLeads = advertiserAccounts.reduce(
      (sum, account) => sum + account.dashboardLeads,
      0,
    );
    const advertiserDiagnostics = diagnostics.filter((diagnostic) => {
      if (!diagnostic.relatedEntityIds?.length) return false;
      return (
        diagnostic.relatedEntityIds.includes(row.id) ||
        diagnostic.relatedEntityIds.some((entityId) => accountIds.includes(entityId))
      );
    });
    const advertiserRecommendations = recommendations.filter((recommendation) =>
      recommendation.relatedDiagnosticIds.some((diagnosticId) =>
        advertiserDiagnostics.some((diagnostic) => diagnostic.id === diagnosticId),
      ),
    );
    const openClawStatus = advertiserDiagnostics.some(
      (diagnostic) => diagnostic.severity === 'critical' || diagnostic.severity === 'high',
    )
      ? 'Perlu aksi'
      : advertiserRecommendations.length > 0
        ? 'Perlu review'
        : 'Stabil';

    return {
      ...row,
      accountCount: advertiserAccounts.filter(
        (account) => account.spend > 0 || account.attributedOrders > 0,
      ).length,
      dashboardLeads,
      cpl: dashboardLeads > 0 ? row.spend / dashboardLeads : null,
      cpr: row.orders > 0 ? row.spend / row.orders : null,
      roas: row.burn > 0 ? row.revenue / row.burn : null,
      openClawStatus,
      recommendationCount: advertiserRecommendations.length,
    };
  });

  const actionNeededCount = advertiserRows.filter((row) => row.openClawStatus === 'Perlu aksi').length;

  return (
    <AdsMonitoringWorkspaceFrame
      title="Ads Monitoring • Matriks Advertiser"
      description="Matriks utama advertiser untuk membaca spend, burn, leads, order, omzet, dan status OpenClaw dalam satu permukaan kerja."
      dateRange={dateRange}
      setDateRange={setDateRange}
      controls={workspaceControls}
      badges={['Ads Monitoring', 'Matriks Advertiser', 'Matrix-first']}
      stats={[
        {
          label: 'Advertiser Aktif',
          value: formatAdsNumber(readModel.summary.advertiserCount),
        },
        {
          label: 'Order Masuk',
          value: formatAdsNumber(readModel.summary.totalOrders),
        },
        {
          label: 'Omzet',
          value: formatAdsCurrency(readModel.summary.totalRevenue),
        },
        {
          label: 'Perlu Aksi',
          value: formatAdsNumber(actionNeededCount),
          hint: 'Advertiser dengan diagnostic high/critical',
        },
      ]}
    >
      <div className="grid gap-6">
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Matriks Advertiser
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Tabel utama advertiser untuk membaca kontribusi akun, performa revenue, dan status tindak lanjut.
                </p>
              </div>
              <Badge variant="outline" className="border-slate-200 dark:border-slate-700">
                {formatAdsNumber(advertiserRows.length)} advertiser
              </Badge>
            </div>

            <div className="mt-4 overflow-x-auto">
              <Table className="min-w-[1360px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Advertiser</TableHead>
                    <TableHead className="text-right">Akun Aktif</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Order</TableHead>
                    <TableHead className="text-right">Closing</TableHead>
                    <TableHead className="text-right">Close Rate</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                    <TableHead className="text-right">Burn</TableHead>
                    <TableHead className="text-right">CPL</TableHead>
                    <TableHead className="text-right">CPR</TableHead>
                    <TableHead className="text-right">Omzet</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                    <TableHead className="text-right">OpenClaw</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {advertiserRows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedDetail({ type: 'advertiser', id: row.id })}
                    >
                      <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                        {row.name}
                      </TableCell>
                      <TableCell className="text-right">{formatAdsNumber(row.accountCount)}</TableCell>
                      <TableCell className="text-right">{formatAdsNumber(row.dashboardLeads)}</TableCell>
                      <TableCell className="text-right">{formatAdsNumber(row.orders)}</TableCell>
                      <TableCell className="text-right">
                        {formatAdsNumber(row.completedOrders)}
                      </TableCell>
                      <TableCell className="text-right">{formatAdsPercent(row.closeRate)}</TableCell>
                      <TableCell className="text-right">{formatAdsCurrency(row.spend)}</TableCell>
                      <TableCell className="text-right">{formatAdsCurrency(row.burn)}</TableCell>
                      <TableCell className="text-right">
                        {row.cpl != null ? formatAdsCurrency(row.cpl) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.cpr != null ? formatAdsCurrency(row.cpr) : '-'}
                      </TableCell>
                      <TableCell className="text-right">{formatAdsCurrency(row.revenue)}</TableCell>
                      <TableCell className="text-right">
                        {row.roas != null ? `${row.roas.toFixed(2)}x` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={
                            row.openClawStatus === 'Perlu aksi'
                              ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300'
                              : row.openClawStatus === 'Perlu review'
                                ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
                          }
                        >
                          {row.openClawStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Top Account per Advertiser
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Membantu buka lane akun yang paling berpengaruh di dalam advertiser teratas.
                </p>
              </div>
              <Badge variant="outline">{formatAdsNumber(readModel.accountMatrix.length)} akun</Badge>
            </div>

            <div className="mt-4 overflow-x-auto">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Akun</TableHead>
                    <TableHead>Advertiser</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Order</TableHead>
                    <TableHead className="text-right">Closing</TableHead>
                    <TableHead className="text-right">Close Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {readModel.accountMatrix.slice(0, 10).map((row) => (
                    <TableRow
                      key={row.adAccountId}
                      className="cursor-pointer"
                      onClick={() => setSelectedDetail({ type: 'account', id: row.adAccountId })}
                    >
                      <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                        {row.accountName}
                      </TableCell>
                      <TableCell>{row.advertiserName}</TableCell>
                      <TableCell>{row.platformName}</TableCell>
                      <TableCell className="text-right">{formatAdsCurrency(row.spend)}</TableCell>
                      <TableCell className="text-right">
                        {formatAdsNumber(row.dashboardLeads)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatAdsNumber(row.attributedOrders)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatAdsNumber(row.completedOrders)}
                      </TableCell>
                      <TableCell className="text-right">{formatAdsPercent(row.closeRate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </Card>

        <AdsMonitoringDetailDrawer
          open={!!selectedDetail}
          selection={selectedDetail}
          onOpenChange={(open) => {
            if (!open) setSelectedDetail(null);
          }}
          readModel={readModel}
          diagnostics={diagnostics}
          recommendations={recommendations}
        />
      </div>
    </AdsMonitoringWorkspaceFrame>
  );
}
