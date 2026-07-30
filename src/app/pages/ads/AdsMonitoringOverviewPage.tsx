import {
  Activity,
  Bot,
  CircleAlert,
  Gauge,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { Card } from '@/app/components/ui/card';
import { Progress } from '@/app/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { AdsMonitoringWorkspaceFrame } from './components/AdsMonitoringWorkspaceFrame';
import { AdsMonitoringDetailDrawer } from './components/AdsMonitoringDetailDrawer';
import {
  formatAdsCurrency,
  formatAdsDateTime,
  formatAdsNumber,
  formatAdsPercent,
} from './adsMonitoringFormatters';
import { useAdsMonitoringWorkspaceData } from './useAdsMonitoringWorkspaceData';

function formatCompareDelta(current: number, previous: number, mode: 'currency' | 'number' | 'ratio') {
  const delta = current - previous;
  const isPositive = delta >= 0;
  const prefix = isPositive ? '+' : '';

  if (mode === 'currency') {
    return `${prefix}${formatAdsCurrency(delta)}`;
  }

  if (mode === 'ratio') {
    return `${prefix}${delta.toFixed(2)}x`;
  }

  return `${prefix}${formatAdsNumber(delta)}`;
}

function OverviewKpiCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'default' | 'emerald' | 'amber' | 'blue' | 'violet';
}) {
  const toneClassName =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/30'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30'
        : tone === 'blue'
          ? 'border-blue-200 bg-blue-50/80 dark:border-blue-900 dark:bg-blue-950/30'
          : tone === 'violet'
            ? 'border-violet-200 bg-violet-50/80 dark:border-violet-900 dark:bg-violet-950/30'
            : 'border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/40';

  return (
    <div className={`rounded-2xl border p-4 ${toneClassName}`}>
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </div>
      <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}

export function AdsMonitoringOverviewPage() {
  const {
    dateRange,
    setDateRange,
    readModel,
    diagnostics,
    recommendations,
    generatedAt,
    compareReadModel,
    workspaceControls,
    selectedDetail,
    setSelectedDetail,
  } = useAdsMonitoringWorkspaceData();

  const topRecommendation = recommendations[0] || null;
  const criticalCount = diagnostics.filter((item) => item.severity === 'critical').length;
  const highCount = diagnostics.filter((item) => item.severity === 'high').length;
  const overloadedCsCount = readModel.csMatrix.filter(
    (row) => row.orders >= 15 && row.closeRate < 0.3,
  ).length;
  const operationalRoas =
    readModel.summary.totalBurn > 0
      ? readModel.summary.totalRevenue / readModel.summary.totalBurn
      : 0;
  const attributionPercent = Math.round(readModel.summary.attributionCoverageRate * 100);
  const readinessLabel =
    attributionPercent >= 85 && criticalCount === 0
      ? 'Siap dibaca OpenClaw'
      : attributionPercent >= 70
        ? 'Perlu rapikan mapping'
        : 'Belum sehat untuk auto-decision';
  const capacityLabel =
    overloadedCsCount === 0
      ? 'Sehat'
      : overloadedCsCount === 1
        ? 'Perlu penjagaan'
        : 'Overload';

  return (
    <AdsMonitoringWorkspaceFrame
      title="Ads Monitoring • Ringkasan"
      description="State of the system untuk membaca kondisi akuisisi lead, bottleneck utama, dan kesiapan OpenClaw sebelum masuk ke workspace detail."
      dateRange={dateRange}
      setDateRange={setDateRange}
      badges={['Ads Monitoring', 'Ringkasan', 'OpenClaw Ready']}
      controls={workspaceControls}
      stats={[
        {
          label: 'Last Read',
          value: formatAdsDateTime(generatedAt),
          hint: 'Generated dari read model saat ini',
        },
        {
          label: 'Mode',
          value: 'Assisted',
          hint: 'Read-first, belum auto write',
        },
        {
          label: 'Data Health',
          value: `${attributionPercent}%`,
          hint: 'Coverage atribusi order ke akun iklan',
        },
        {
          label: 'Approval Pending',
          value: formatAdsNumber(
            recommendations.filter((recommendation) => recommendation.approvalRequired).length,
          ),
          hint: 'Recommendation yang butuh persetujuan',
        },
      ]}
    >
      <div className="grid gap-6">
        {compareReadModel ? (
          <Card className="border-blue-200 bg-blue-50/80 p-5 shadow-sm dark:border-blue-900 dark:bg-blue-950/30">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                  Compare Mode Aktif
                </div>
                <p className="mt-1 text-sm leading-6 text-blue-700/90 dark:text-blue-300/90">
                  Ringkasan saat ini sedang dibandingkan dengan periode sebelumnya yang setara.
                </p>
              </div>
              <Badge variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-300">
                vs previous period
              </Badge>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-blue-200/80 bg-white/80 p-4 dark:border-blue-900 dark:bg-slate-900/70">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  Delta Spend
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {formatCompareDelta(readModel.summary.totalSpend, compareReadModel.summary.totalSpend, 'currency')}
                </div>
              </div>
              <div className="rounded-2xl border border-blue-200/80 bg-white/80 p-4 dark:border-blue-900 dark:bg-slate-900/70">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  Delta Order
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {formatCompareDelta(readModel.summary.totalOrders, compareReadModel.summary.totalOrders, 'number')}
                </div>
              </div>
              <div className="rounded-2xl border border-blue-200/80 bg-white/80 p-4 dark:border-blue-900 dark:bg-slate-900/70">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  Delta Closing
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {formatCompareDelta(readModel.summary.completedOrders, compareReadModel.summary.completedOrders, 'number')}
                </div>
              </div>
              <div className="rounded-2xl border border-blue-200/80 bg-white/80 p-4 dark:border-blue-900 dark:bg-slate-900/70">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  Delta ROAS
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {formatCompareDelta(
                    operationalRoas,
                    compareReadModel.summary.totalBurn > 0
                      ? compareReadModel.summary.totalRevenue / compareReadModel.summary.totalBurn
                      : 0,
                    'ratio',
                  )}
                </div>
              </div>
            </div>
          </Card>
        ) : null}

        <Card className="border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  OpenClaw Action Strip
                </h2>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                Rekomendasi teratas yang saat ini paling layak dibuka lebih dulu.
              </p>
            </div>
            <Badge variant="outline" className="border-slate-200 dark:border-slate-700">
              {topRecommendation ? topRecommendation.priority.toUpperCase() : 'Watch'}
            </Badge>
          </div>

          {topRecommendation ? (
            <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
              <div className="rounded-2xl border border-violet-200 bg-violet-50/80 p-4 dark:border-violet-900 dark:bg-violet-950/30">
                <div className="text-sm font-medium text-violet-700 dark:text-violet-300">
                  {topRecommendation.title}
                </div>
                <p className="mt-2 text-sm leading-6 text-violet-700/90 dark:text-violet-300/90">
                  {topRecommendation.reason}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">confidence {Math.round(topRecommendation.confidence * 100)}%</Badge>
                  <Badge variant="outline">risk {topRecommendation.risk}</Badge>
                  <Badge variant="outline">
                    {topRecommendation.approvalRequired ? 'Perlu approval' : 'Bisa dieksekusi aman'}
                  </Badge>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      Diagnostics Aktif
                    </div>
                    <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                      {formatAdsNumber(diagnostics.length)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      High / Critical
                    </div>
                    <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                      {formatAdsNumber(highCount + criticalCount)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Belum ada recommendation aktif pada rentang ini.
            </div>
          )}
        </Card>

        <div className="grid gap-4 xl:grid-cols-6">
          <OverviewKpiCard
            label="Total Spend"
            value={formatAdsCurrency(readModel.summary.totalSpend)}
            hint="Spend media dari akun aktif pada rentang ini."
            tone="blue"
          />
          <OverviewKpiCard
            label="Total Burn"
            value={formatAdsCurrency(readModel.summary.totalBurn)}
            hint="Sudah termasuk PPN dan fee internal."
            tone="amber"
          />
          <OverviewKpiCard
            label="Order Masuk"
            value={formatAdsNumber(readModel.summary.totalOrders)}
            hint="Order operasional yang masuk pada rentang aktif."
          />
          <OverviewKpiCard
            label="Total Closing"
            value={formatAdsNumber(readModel.summary.completedOrders)}
            hint="Order yang sudah masuk status closing-like."
            tone="emerald"
          />
          <OverviewKpiCard
            label="Omzet"
            value={formatAdsCurrency(readModel.summary.totalRevenue)}
            hint="Revenue tertutup dari order yang sudah closing-like."
            tone="emerald"
          />
          <OverviewKpiCard
            label="ROAS Operasional"
            value={operationalRoas > 0 ? `${operationalRoas.toFixed(2)}x` : '-'}
            hint="Omzet tertutup dibanding burn operasional."
            tone="violet"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-6">
          <OverviewKpiCard
            label="CPL"
            value={
              readModel.summary.totalDashboardLeads > 0
                ? formatAdsCurrency(readModel.summary.costPerLead)
                : '-'
            }
            hint="Spend dibanding leads dashboard."
          />
          <OverviewKpiCard
            label="CPR"
            value={
              readModel.summary.totalOrders > 0
                ? formatAdsCurrency(readModel.summary.costPerOrder)
                : '-'
            }
            hint="Spend dibanding order masuk."
          />
          <OverviewKpiCard
            label="Closing Rate"
            value={formatAdsPercent(readModel.summary.closingRate)}
            hint="Closing dibanding total order masuk."
          />
          <OverviewKpiCard
            label="Attribution Quality"
            value={formatAdsPercent(readModel.summary.attributionCoverageRate)}
            hint={`${formatAdsNumber(readModel.summary.unresolvedOrders)} order belum terpetakan aman.`}
            tone={attributionPercent >= 85 ? 'emerald' : attributionPercent >= 70 ? 'amber' : 'violet'}
          />
          <OverviewKpiCard
            label="Capacity Health"
            value={capacityLabel}
            hint={`${formatAdsNumber(overloadedCsCount)} lane CS perlu perhatian.`}
            tone={overloadedCsCount === 0 ? 'emerald' : 'amber'}
          />
          <OverviewKpiCard
            label="OpenClaw Readiness"
            value={readinessLabel}
            hint="Kualitas data sebelum rekomendasi naik ke mode lanjut."
            tone={attributionPercent >= 85 && criticalCount === 0 ? 'emerald' : 'amber'}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
          <Card className="border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <CircleAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Diagnostics Rail
              </h2>
            </div>
            <div className="mt-4 space-y-3">
              {diagnostics.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Belum ada anomaly utama pada rentang ini.
                </div>
              ) : (
                diagnostics.slice(0, 4).map((diagnostic) => (
                  <div
                    key={diagnostic.id}
                    className="cursor-pointer rounded-2xl border border-slate-200 p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-800 dark:hover:border-blue-800 dark:hover:bg-blue-950/20"
                    onClick={() => setSelectedDetail({ type: 'diagnostic', id: diagnostic.id })}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {diagnostic.title}
                      </div>
                      <Badge variant="outline">{diagnostic.severity}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                      {diagnostic.summary}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                State of the System
              </h2>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Margin Estimate
                </div>
                <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {formatAdsCurrency(readModel.summary.estimatedGrossMargin)}
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Omzet tertutup dikurangi burn operasional.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <Gauge className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  Capacity Pressure
                </div>
                <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {capacityLabel}
                </div>
                <Progress
                  value={Math.min(100, overloadedCsCount === 0 ? 22 : overloadedCsCount * 34)}
                  className="mt-3 h-2.5 bg-slate-100 dark:bg-slate-800"
                  indicatorClassName={
                    overloadedCsCount === 0
                      ? 'bg-emerald-500'
                      : overloadedCsCount === 1
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                  }
                />
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  OpenClaw Mode
                </div>
                <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Assisted
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Masih read-first dan guardrail penuh aktif.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Advertiser Teratas
                </div>
                <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {readModel.advertiserLeaderboard[0]?.name || '-'}
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {readModel.advertiserLeaderboard[0]
                    ? `${formatAdsNumber(readModel.advertiserLeaderboard[0].orders)} order masuk`
                    : 'Belum ada advertiser dominan'}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Akun Fokus
                </div>
                <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {readModel.accountMatrix[0]?.accountName || '-'}
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {readModel.accountMatrix[0]
                    ? `${formatAdsCurrency(readModel.accountMatrix[0].spend)} spend`
                    : 'Belum ada akun aktif pada rentang ini'}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Account Coverage
                </div>
                <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {formatAdsNumber(readModel.summary.activeAccountCount)}
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Akun aktif yang punya spend atau order terbaca.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Top Advertiser
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Ringkasan advertiser dengan order dan omzet tertinggi.
                </p>
              </div>
              <Badge variant="outline">{formatAdsNumber(readModel.advertiserLeaderboard.length)} advertiser</Badge>
            </div>
            <div className="mt-4 overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Advertiser</TableHead>
                    <TableHead className="text-right">Order</TableHead>
                    <TableHead className="text-right">Closing</TableHead>
                    <TableHead className="text-right">Omzet</TableHead>
                    <TableHead className="text-right">Close Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {readModel.advertiserLeaderboard.slice(0, 5).map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedDetail({ type: 'advertiser', id: row.id })}
                    >
                      <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                        {row.name}
                      </TableCell>
                      <TableCell className="text-right">{formatAdsNumber(row.orders)}</TableCell>
                      <TableCell className="text-right">
                        {formatAdsNumber(row.completedOrders)}
                      </TableCell>
                      <TableCell className="text-right">{formatAdsCurrency(row.revenue)}</TableCell>
                      <TableCell className="text-right">{formatAdsPercent(row.closeRate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Card className="border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Account Focus
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Lane akun yang perlu dibuka lebih dulu setelah ringkasan global.
                </p>
              </div>
              <Badge variant="outline">{formatAdsNumber(readModel.accountMatrix.length)} akun</Badge>
            </div>
            <div className="mt-4 overflow-x-auto">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Akun</TableHead>
                    <TableHead>Advertiser</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                    <TableHead className="text-right">Order</TableHead>
                    <TableHead className="text-right">Closing</TableHead>
                    <TableHead className="text-right">Close Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {readModel.accountMatrix.slice(0, 6).map((row) => (
                    <TableRow
                      key={row.adAccountId}
                      className="cursor-pointer"
                      onClick={() => setSelectedDetail({ type: 'account', id: row.adAccountId })}
                    >
                      <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                        {row.accountName}
                      </TableCell>
                      <TableCell>{row.advertiserName}</TableCell>
                      <TableCell className="text-right">{formatAdsCurrency(row.spend)}</TableCell>
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
          </Card>
        </div>

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
