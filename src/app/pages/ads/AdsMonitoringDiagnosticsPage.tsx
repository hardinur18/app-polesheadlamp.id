import { AlertTriangle, ShieldAlert, Siren, Stethoscope } from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { Card } from '@/app/components/ui/card';
import { AdsMonitoringDetailDrawer } from './components/AdsMonitoringDetailDrawer';
import { AdsMonitoringWorkspaceFrame } from './components/AdsMonitoringWorkspaceFrame';
import { formatAdsNumber, formatAdsPercent } from './adsMonitoringFormatters';
import { useAdsMonitoringWorkspaceData } from './useAdsMonitoringWorkspaceData';

export function AdsMonitoringDiagnosticsPage() {
  const {
    dateRange,
    setDateRange,
    diagnostics,
    recommendations,
    readModel,
    workspaceControls,
    selectedDetail,
    setSelectedDetail,
  } = useAdsMonitoringWorkspaceData();

  const criticalCount = diagnostics.filter((item) => item.severity === 'critical').length;
  const highCount = diagnostics.filter((item) => item.severity === 'high').length;

  return (
    <AdsMonitoringWorkspaceFrame
      title="Ads Monitoring • Diagnostik"
      description="Pusat diagnostik untuk membaca anomali, gap atribusi, risiko burn, dan bottleneck lane marketing-operasional."
      dateRange={dateRange}
      setDateRange={setDateRange}
      controls={workspaceControls}
      badges={['Ads Monitoring', 'Diagnostik', 'Baca Saja']}
      stats={[
        {
          label: 'Diagnostik',
          value: formatAdsNumber(diagnostics.length),
        },
        {
          label: 'High / Critical',
          value: formatAdsNumber(highCount + criticalCount),
        },
        {
          label: 'Recommendations',
          value: formatAdsNumber(recommendations.length),
        },
        {
          label: 'Attribution Quality',
          value: formatAdsPercent(readModel.summary.attributionCoverageRate),
          hint: `${formatAdsNumber(readModel.summary.unresolvedOrders)} unresolved order`,
        },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <Stethoscope className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Antrian Diagnostik
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Temuan prioritas yang dibaca dari read model dan engine diagnosis.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {diagnostics.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Belum ada anomaly yang terdeteksi untuk rentang ini.
                </div>
              ) : (
                diagnostics.map((diagnostic) => (
                  <div
                    key={diagnostic.id}
                    className="cursor-pointer rounded-2xl border border-slate-200 p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-800 dark:hover:border-blue-800 dark:hover:bg-blue-950/20"
                    onClick={() => setSelectedDetail({ type: 'diagnostic', id: diagnostic.id })}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                            {diagnostic.title}
                          </h3>
                          <Badge variant="outline">{diagnostic.severity}</Badge>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                          {diagnostic.summary}
                        </p>
                      </div>
                    </div>
                    <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                      {diagnostic.evidence.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Daftar Rekomendasi
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Saran aksi yang siap dipindahkan ke OpenClaw atau Simulasi Aksi.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {recommendations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Belum ada recommendation pada rentang ini.
                </div>
              ) : (
                recommendations.map((recommendation) => (
                  <div
                    key={recommendation.id}
                    className="cursor-pointer rounded-2xl border border-slate-200 p-4 transition-colors hover:border-violet-300 hover:bg-violet-50/40 dark:border-slate-800 dark:hover:border-violet-800 dark:hover:bg-violet-950/20"
                    onClick={() =>
                      setSelectedDetail({ type: 'recommendation', id: recommendation.id })
                    }
                  >
                    <div className="flex items-center gap-2">
                      {recommendation.priority === 'p1' ? (
                        <Siren className="h-4 w-4 text-rose-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {recommendation.title}
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                      {recommendation.reason}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">{recommendation.priority}</Badge>
                      <Badge variant="outline">confidence {Math.round(recommendation.confidence * 100)}%</Badge>
                      <Badge variant="outline">risk {recommendation.risk}</Badge>
                      {recommendation.approvalRequired ? (
                        <Badge variant="outline">perlu approval</Badge>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
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
