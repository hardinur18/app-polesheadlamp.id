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

export function AdsMonitoringCsMatrixPage() {
  const {
    dateRange,
    setDateRange,
    readModel,
    diagnostics,
    workspaceControls,
    recommendations,
    selectedDetail,
    setSelectedDetail,
  } = useAdsMonitoringWorkspaceData();

  const overloadedRows = readModel.csMatrix.filter((row) => row.orders >= 15 && row.closeRate < 0.3);

  return (
    <AdsMonitoringWorkspaceFrame
      title="Ads Monitoring • Matriks CS"
      description="Matriks Customer Service untuk membaca tekanan lane, hasil closing, dan bottleneck follow-up yang perlu dibantu."
      dateRange={dateRange}
      setDateRange={setDateRange}
      controls={workspaceControls}
      badges={['Ads Monitoring', 'Matriks CS', 'Ops-first']}
      stats={[
        {
          label: 'CS Aktif',
          value: formatAdsNumber(readModel.summary.csCount),
        },
        {
          label: 'Order Masuk',
          value: formatAdsNumber(readModel.summary.totalOrders),
        },
        {
          label: 'Total Closing',
          value: formatAdsNumber(readModel.summary.completedOrders),
        },
        {
          label: 'CS Overload',
          value: formatAdsNumber(overloadedRows.length),
          hint: 'Order tinggi dengan close rate lemah',
        },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Matriks Customer Service
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Menunjukkan volume order, hasil closing, omzet tertutup, dan tekanan lane masing-masing CS.
                </p>
              </div>
              <Badge variant="outline" className="border-slate-200 dark:border-slate-700">
                {formatAdsNumber(readModel.csMatrix.length)} CS
              </Badge>
            </div>

            <div className="mt-4 overflow-x-auto">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Service</TableHead>
                    <TableHead className="text-right">Order Masuk</TableHead>
                    <TableHead className="text-right">Closing</TableHead>
                    <TableHead className="text-right">Close Rate</TableHead>
                    <TableHead className="text-right">Omzet</TableHead>
                    <TableHead className="text-right">Pressure</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {readModel.csMatrix.map((row) => {
                    const isOverloaded = row.orders >= 15 && row.closeRate < 0.3;
                    const shouldWatch = row.orders >= 10 && row.closeRate < 0.4;

                    return (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedDetail({ type: 'cs', id: row.id })}
                      >
                        <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                          {row.name}
                        </TableCell>
                        <TableCell className="text-right">{formatAdsNumber(row.orders)}</TableCell>
                        <TableCell className="text-right">
                          {formatAdsNumber(row.completedOrders)}
                        </TableCell>
                        <TableCell className="text-right">{formatAdsPercent(row.closeRate)}</TableCell>
                        <TableCell className="text-right">{formatAdsCurrency(row.revenue)}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={
                              isOverloaded
                                ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300'
                                : shouldWatch
                                  ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
                            }
                          >
                            {isOverloaded ? 'Overload' : shouldWatch ? 'Perlu jaga' : 'Stabil'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </Card>

        <div className="grid gap-6">
          <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="p-5">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Lane yang Perlu Bantuan
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                CS dengan kombinasi beban tinggi dan hasil close yang belum sehat.
              </p>

              <div className="mt-4 space-y-3">
                {overloadedRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    Belum ada lane CS yang masuk kategori overload.
                  </div>
                ) : (
                  overloadedRows.map((row) => (
                    <div
                      key={row.id}
                      className="cursor-pointer rounded-2xl border border-amber-200 bg-amber-50/80 p-4 transition-colors hover:border-amber-300 dark:border-amber-900 dark:bg-amber-950/30"
                      onClick={() => setSelectedDetail({ type: 'cs', id: row.id })}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {row.name}
                        </div>
                        <Badge variant="outline">{formatAdsPercent(row.closeRate)}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        {formatAdsNumber(row.orders)} order masuk dengan {formatAdsNumber(row.completedOrders)} closing.
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="p-5">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Diagnostic Context
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Temuan sistem yang terkait bottleneck operasional dan distribusi order.
              </p>

              <div className="mt-4 space-y-3">
                {diagnostics.filter((item) => item.type === 'cs-overload').length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    Belum ada diagnostic CS overload aktif.
                  </div>
                ) : (
                  diagnostics
                    .filter((item) => item.type === 'cs-overload')
                    .map((diagnostic) => (
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
