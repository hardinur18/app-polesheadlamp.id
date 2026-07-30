import { FileClock, Shield } from 'lucide-react';

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
import {
  createRecommendationAuditEvent,
  createSandboxActionFromRecommendation,
  createSandboxAuditEvent,
} from './openclaw-foundation';
import { AdsMonitoringDetailDrawer } from './components/AdsMonitoringDetailDrawer';
import { AdsMonitoringWorkspaceFrame } from './components/AdsMonitoringWorkspaceFrame';
import { formatAdsNumber } from './adsMonitoringFormatters';
import { useAdsMonitoringWorkspaceData } from './useAdsMonitoringWorkspaceData';

export function AdsMonitoringActionSandboxPage() {
  const {
    dateRange,
    setDateRange,
    recommendations,
    workspaceControls,
    readModel,
    diagnostics,
    selectedDetail,
    setSelectedDetail,
  } = useAdsMonitoringWorkspaceData();

  const sandboxActions = recommendations.map((recommendation) =>
    createSandboxActionFromRecommendation(recommendation),
  );

  const auditEvents = sandboxActions.flatMap((action, index) => {
    const recommendation = recommendations[index];
    if (!recommendation) return [];
    return [
      createRecommendationAuditEvent(recommendation),
      createSandboxAuditEvent(action, 'sandbox-action-proposed'),
    ];
  });

  return (
    <AdsMonitoringWorkspaceFrame
      title="Ads Monitoring • Simulasi Aksi"
      description="Ruang aman untuk proposal aksi, approval flow, dan audit event sebelum ada tindakan nyata ke sistem operasional."
      dateRange={dateRange}
      setDateRange={setDateRange}
      controls={workspaceControls}
      badges={['Ads Monitoring', 'Simulasi Aksi', 'Baca Saja']}
      stats={[
        {
          label: 'Sandbox Actions',
          value: formatAdsNumber(sandboxActions.length),
        },
        {
          label: 'Audit Events',
          value: formatAdsNumber(auditEvents.length),
        },
        {
          label: 'Pending Approval',
          value: formatAdsNumber(
            recommendations.filter((recommendation) => recommendation.approvalRequired).length,
          ),
        },
        {
          label: 'Write Mode',
          value: 'Off',
          hint: 'Belum menulis ke core data',
        },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-slate-700 dark:text-slate-300" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Proposed Actions
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Semua aksi masih berupa proposal terkontrol dan belum menulis balik ke data inti.
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Tindakan</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Approval</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sandboxActions.map((action, index) => {
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
                        <TableCell>{action.type}</TableCell>
                        <TableCell className="text-right">
                          {source?.approvalRequired ? 'Ya' : 'Tidak'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{action.status}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <FileClock className="h-5 w-5 text-slate-700 dark:text-slate-300" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Audit Trail
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Jejak event sistem dari recommendation hingga sandbox proposal.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {auditEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{event.type}</div>
                    <Badge variant="outline">{event.actor}</Badge>
                  </div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    entity: {event.entityId}
                  </div>
                </div>
              ))}
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
