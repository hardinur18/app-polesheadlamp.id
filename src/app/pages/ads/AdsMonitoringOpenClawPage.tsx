import { Bot, ShieldCheck, Sparkles } from 'lucide-react';

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
import { createSandboxActionFromRecommendation } from './openclaw-foundation';
import { AdsMonitoringDetailDrawer } from './components/AdsMonitoringDetailDrawer';
import { AdsMonitoringWorkspaceFrame } from './components/AdsMonitoringWorkspaceFrame';
import { formatAdsNumber } from './adsMonitoringFormatters';
import { useAdsMonitoringWorkspaceData } from './useAdsMonitoringWorkspaceData';

export function AdsMonitoringOpenClawPage() {
  const {
    dateRange,
    setDateRange,
    diagnostics,
    recommendations,
    workspaceControls,
    readModel,
    selectedDetail,
    setSelectedDetail,
  } = useAdsMonitoringWorkspaceData();
  const sandboxPreview = recommendations.map((recommendation) =>
    createSandboxActionFromRecommendation(recommendation),
  );

  const approvalRequiredCount = recommendations.filter((item) => item.approvalRequired).length;

  return (
    <AdsMonitoringWorkspaceFrame
      title="Ads Monitoring • OpenClaw"
      description="Konsol robot advertiser untuk membaca antrian rekomendasi, tingkat keyakinan, pagar kendali, dan preview aksi sebelum masuk simulasi."
      dateRange={dateRange}
      setDateRange={setDateRange}
      controls={workspaceControls}
      badges={['Ads Monitoring', 'OpenClaw', 'Mode Assisted']}
      stats={[
        {
          label: 'Mode Aktif',
          value: 'Assisted',
        },
        {
          label: 'Diagnostik',
          value: formatAdsNumber(diagnostics.length),
        },
        {
          label: 'Antrian Rekomendasi',
          value: formatAdsNumber(recommendations.length),
        },
        {
          label: 'Perlu Approval',
          value: formatAdsNumber(approvalRequiredCount),
        },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <Bot className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Guardrail Status
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  OpenClaw saat ini masih mode aman dan belum mengeksekusi auto-write.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
                <div className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="h-4 w-4" />
                  Read-first enabled
                </div>
                <p className="mt-2 text-sm leading-6 text-emerald-700/80 dark:text-emerald-300/80">
                  Engine hanya membaca, menyusun diagnosis, dan menyiapkan aksi proposal.
                </p>
              </div>
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-900/20">
                <div className="flex items-center gap-2 font-medium text-violet-700 dark:text-violet-300">
                  <Sparkles className="h-4 w-4" />
                  Rekomendasi aktif
                </div>
                <p className="mt-2 text-sm leading-6 text-violet-700/80 dark:text-violet-300/80">
                  Semua rekomendasi disiapkan untuk approval flow sebelum masuk simulasi.
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Antrian OpenClaw
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Preview tindakan yang siap dibawa ke Simulasi Aksi.
                </p>
              </div>
              <Badge variant="outline">{formatAdsNumber(sandboxPreview.length)} action</Badge>
            </div>

            <div className="mt-4 overflow-x-auto">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Aksi</TableHead>
                    <TableHead>Source Recommendation</TableHead>
                    <TableHead className="text-right">Confidence</TableHead>
                    <TableHead className="text-right">Risk</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    <TableHead className="text-right">Approval</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sandboxPreview.map((action, index) => {
                    const source = recommendations[index];
                    return (
                      <TableRow
                        key={action.id}
                        className="cursor-pointer"
                        onClick={() =>
                          source &&
                          setSelectedDetail({ type: 'recommendation', id: source.id })
                        }
                      >
                        <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                          {action.title}
                        </TableCell>
                        <TableCell>{source?.type || '-'}</TableCell>
                        <TableCell className="text-right">
                          {source ? `${Math.round(source.confidence * 100)}%` : '-'}
                        </TableCell>
                        <TableCell className="text-right">{source?.risk || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{action.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {source?.approvalRequired ? 'Ya' : 'Tidak'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
