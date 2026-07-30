import { Badge } from '@/app/components/ui/badge';
import { Card } from '@/app/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/app/components/ui/sheet';
import {
  formatAdsCurrency,
  formatAdsNumber,
  formatAdsPercent,
} from '../adsMonitoringFormatters';
import type { AdsMonitoringDiagnostic, AdsMonitoringRecommendation } from '../openclaw-foundation';
import type { AdsMonitoringReadModel } from '../openclaw-foundation/read-model';
import type { AdsMonitoringDetailSelection } from '../useAdsMonitoringWorkspaceData';

type AdsMonitoringDetailDrawerProps = {
  open: boolean;
  selection: AdsMonitoringDetailSelection | null;
  onOpenChange: (open: boolean) => void;
  readModel: AdsMonitoringReadModel;
  diagnostics: AdsMonitoringDiagnostic[];
  recommendations: AdsMonitoringRecommendation[];
};

function DetailMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      {hint ? (
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function AdsMonitoringDetailDrawer({
  open,
  selection,
  onOpenChange,
  readModel,
  diagnostics,
  recommendations,
}: AdsMonitoringDetailDrawerProps) {
  const advertiserRow =
    selection?.type === 'advertiser'
      ? readModel.advertiserLeaderboard.find((row) => row.id === selection.id) || null
      : null;
  const accountRow =
    selection?.type === 'account'
      ? readModel.accountMatrix.find((row) => row.adAccountId === selection.id) || null
      : null;
  const csRow =
    selection?.type === 'cs'
      ? readModel.csMatrix.find((row) => row.id === selection.id) || null
      : null;
  const diagnostic =
    selection?.type === 'diagnostic'
      ? diagnostics.find((item) => item.id === selection.id) || null
      : null;
  const recommendation =
    selection?.type === 'recommendation'
      ? recommendations.find((item) => item.id === selection.id) || null
      : null;

  const relatedAccountIds =
    advertiserRow != null
      ? readModel.accountMatrix
          .filter((row) => row.advertiserId === advertiserRow.id)
          .map((row) => row.adAccountId)
      : accountRow != null
        ? [accountRow.adAccountId]
        : [];

  const relatedDiagnostics = diagnostics.filter((item) => {
    if (diagnostic) return item.id === diagnostic.id;
    if (recommendation) {
      return recommendation.relatedDiagnosticIds.includes(item.id);
    }
    if (advertiserRow) {
      return (
        item.relatedEntityIds?.includes(advertiserRow.id) ||
        item.relatedEntityIds?.some((id) => relatedAccountIds.includes(id))
      );
    }
    if (accountRow) {
      return item.relatedEntityIds?.includes(accountRow.adAccountId);
    }
    if (csRow) {
      return item.relatedEntityIds?.includes(csRow.id);
    }
    return false;
  });

  const relatedRecommendations = recommendations.filter((item) => {
    if (recommendation) return item.id === recommendation.id;
    return item.relatedDiagnosticIds.some((diagnosticId) =>
      relatedDiagnostics.some((diagnosticItem) => diagnosticItem.id === diagnosticId),
    );
  });

  const drawerTitle = advertiserRow
    ? advertiserRow.name
    : accountRow
      ? accountRow.accountName
      : csRow
        ? csRow.name
        : diagnostic
          ? diagnostic.title
          : recommendation
            ? recommendation.title
            : 'Detail';

  const drawerDescription = advertiserRow
    ? 'Detail advertiser untuk membaca kontribusi spend, order, closing, dan konteks OpenClaw.'
    : accountRow
      ? 'Detail akun untuk membaca performa spend, leads, order, closing, dan gap yang masih aktif.'
      : csRow
        ? 'Detail lane CS untuk melihat tekanan order, hasil closing, dan bottleneck.'
        : diagnostic
          ? 'Diagnostic detail beserta bukti yang dipakai sistem.'
          : recommendation
            ? 'Recommendation detail untuk dibaca sebelum masuk approval atau simulasi.'
            : 'Belum ada data detail.';

  const isOpen = open && !!selection;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[400px] sm:w-[560px] sm:max-w-[560px] overflow-y-auto border-l border-slate-200 bg-white p-0 dark:border-slate-800 dark:bg-slate-900"
      >
        <SheetHeader className="border-b border-slate-100 px-6 py-5 text-left dark:border-slate-800">
          <SheetTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {drawerTitle}
          </SheetTitle>
          <SheetDescription className="text-sm text-slate-500 dark:text-slate-400">
            {drawerDescription}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 p-6">
          {advertiserRow ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailMetric label="Order" value={formatAdsNumber(advertiserRow.orders)} />
                <DetailMetric
                  label="Closing"
                  value={formatAdsNumber(advertiserRow.completedOrders)}
                />
                <DetailMetric label="Spend" value={formatAdsCurrency(advertiserRow.spend)} />
                <DetailMetric label="Burn" value={formatAdsCurrency(advertiserRow.burn)} />
                <DetailMetric label="Omzet" value={formatAdsCurrency(advertiserRow.revenue)} />
                <DetailMetric
                  label="Close Rate"
                  value={formatAdsPercent(advertiserRow.closeRate)}
                />
              </div>

              <Card className="border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Account di Dalam Advertiser
                </div>
                <div className="mt-3 space-y-3">
                  {readModel.accountMatrix
                    .filter((row) => row.advertiserId === advertiserRow.id)
                    .slice(0, 8)
                    .map((row) => (
                      <div
                        key={row.adAccountId}
                        className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800"
                      >
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {row.accountName}
                        </div>
                        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {row.platformName} • {formatAdsCurrency(row.spend)} spend •{' '}
                          {formatAdsNumber(row.attributedOrders)} order
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            </>
          ) : null}

          {accountRow ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailMetric label="Platform" value={accountRow.platformName} />
              <DetailMetric label="Advertiser" value={accountRow.advertiserName} />
              <DetailMetric label="Spend" value={formatAdsCurrency(accountRow.spend)} />
              <DetailMetric label="Burn" value={formatAdsCurrency(accountRow.burn)} />
              <DetailMetric label="Leads" value={formatAdsNumber(accountRow.dashboardLeads)} />
              <DetailMetric
                label="Order"
                value={formatAdsNumber(accountRow.attributedOrders)}
                hint="Order hasil atribusi engine"
              />
              <DetailMetric
                label="Closing"
                value={formatAdsNumber(accountRow.completedOrders)}
              />
              <DetailMetric
                label="Close Rate"
                value={formatAdsPercent(accountRow.closeRate)}
              />
            </div>
          ) : null}

          {csRow ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailMetric label="Order Masuk" value={formatAdsNumber(csRow.orders)} />
              <DetailMetric
                label="Closing"
                value={formatAdsNumber(csRow.completedOrders)}
              />
              <DetailMetric label="Close Rate" value={formatAdsPercent(csRow.closeRate)} />
              <DetailMetric label="Omzet" value={formatAdsCurrency(csRow.revenue)} />
            </div>
          ) : null}

          {diagnostic ? (
            <Card className="border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  Summary
                </div>
                <Badge variant="outline">{diagnostic.severity}</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {diagnostic.summary}
              </p>
            </Card>
          ) : null}

          {recommendation ? (
            <Card className="border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{recommendation.priority}</Badge>
                <Badge variant="outline">
                  confidence {Math.round(recommendation.confidence * 100)}%
                </Badge>
                <Badge variant="outline">risk {recommendation.risk}</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {recommendation.reason}
              </p>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                <span className="font-medium">Rollback plan:</span> {recommendation.rollbackPlan}
              </div>
            </Card>
          ) : null}

          <Card className="border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Evidence & Diagnostics
            </div>
            <div className="mt-3 space-y-3">
              {relatedDiagnostics.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Belum ada diagnostic terkait untuk item ini.
                </div>
              ) : (
                relatedDiagnostics.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {item.title}
                      </div>
                      <Badge variant="outline">{item.severity}</Badge>
                    </div>
                    <ul className="mt-3 space-y-1 text-sm text-slate-500 dark:text-slate-400">
                      {item.evidence.map((evidence) => (
                        <li key={evidence}>• {evidence}</li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Related Recommendations
            </div>
            <div className="mt-3 space-y-3">
              {relatedRecommendations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Belum ada recommendation terkait untuk item ini.
                </div>
              ) : (
                relatedRecommendations.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {item.title}
                      </div>
                      <Badge variant="outline">{item.priority}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                      {item.reason}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
