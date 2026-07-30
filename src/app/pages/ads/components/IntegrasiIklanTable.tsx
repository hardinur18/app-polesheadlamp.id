import { Badge } from '@/app/components/ui/badge';
import { Card } from '@/app/components/ui/card';
import { integrasiIklanCopy } from '../integrasiIklanContent';
import type { UnifiedPerformanceRow } from '../integrasiIklanTypes';
import { IntegrasiIklanCopyHint } from './IntegrasiIklanCopyHint';

type IntegrasiIklanTableProps = {
  rows: UnifiedPerformanceRow[];
  accountCount: number;
  formatCurrency: (value: number) => string;
  formatNumber: (value: number) => string;
  formatPercent: (value: number | null | undefined) => string;
};

function HeaderCell({
  label,
  description,
  align = 'left',
}: {
  label: string;
  description: string;
  align?: 'left' | 'right';
}) {
  const justifyClass = align === 'right' ? 'justify-end' : '';

  return (
    <th className={`px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <div className={`flex items-center gap-1 ${justifyClass}`}>
        <span>{label}</span>
        <IntegrasiIklanCopyHint content={description} />
      </div>
    </th>
  );
}

export function IntegrasiIklanTable({
  rows,
  accountCount,
  formatCurrency,
  formatNumber,
  formatPercent,
}: IntegrasiIklanTableProps) {
  const getLiveStatusLabel = (row: UnifiedPerformanceRow) => {
    if (!row.liveError) return null;

    const isSnapshotFallback = row.liveLabel === 'Snapshot DB terakhir';
    const isRateLimited =
      row.liveLabel === 'Rate limit Google' || row.liveLabel === 'Menunggu sinkron otomatis';
    const isUnmapped = row.liveLabel === 'Belum dipetakan';

    return {
      label: row.liveLabel || 'Perlu cek',
      className:
        isSnapshotFallback
          ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
          : isRateLimited || row.source === 'internal'
            ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
            : isUnmapped
              ? 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
    };
  };

  const getLeadSourceLabel = (row: UnifiedPerformanceRow) => {
    if (row.leadSource === 'order-fallback') {
      return {
        label: 'order',
        className: 'text-blue-600 dark:text-blue-400',
      };
    }

    if (row.leadSource === 'order-share') {
      return {
        label: 'order*',
        className: 'text-indigo-600 dark:text-indigo-400',
      };
    }

    if (row.leadSource === 'dashboard') {
      return {
        label: 'manual',
        className: 'text-amber-600 dark:text-amber-400',
      };
    }

    return null;
  };

  return (
    <Card className="border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {integrasiIklanCopy.table.title}
          </h2>
        </div>
        <Badge variant="outline" className="border-slate-200 dark:border-slate-700">
          {formatNumber(accountCount)} akun
        </Badge>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[1120px] text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/80">
            <tr>
              <HeaderCell
                label={integrasiIklanCopy.table.columns.platform.label}
                description={integrasiIklanCopy.table.columns.platform.description}
              />
              <HeaderCell
                label={integrasiIklanCopy.table.columns.businessGroup.label}
                description={integrasiIklanCopy.table.columns.businessGroup.description}
              />
              <HeaderCell
                label={integrasiIklanCopy.table.columns.account.label}
                description={integrasiIklanCopy.table.columns.account.description}
              />
              <HeaderCell
                label={integrasiIklanCopy.table.columns.advertiser.label}
                description={integrasiIklanCopy.table.columns.advertiser.description}
              />
              <HeaderCell
                label={integrasiIklanCopy.table.columns.spend.label}
                description={integrasiIklanCopy.table.columns.spend.description}
                align="right"
              />
              <HeaderCell
                label={integrasiIklanCopy.table.columns.burn.label}
                description={integrasiIklanCopy.table.columns.burn.description}
                align="right"
              />
              <HeaderCell
                label={integrasiIklanCopy.table.columns.leads.label}
                description={integrasiIklanCopy.table.columns.leads.description}
                align="right"
              />
              <HeaderCell
                label={integrasiIklanCopy.table.columns.clicks.label}
                description={integrasiIklanCopy.table.columns.clicks.description}
                align="right"
              />
              <HeaderCell
                label={integrasiIklanCopy.table.columns.ctr.label}
                description={integrasiIklanCopy.table.columns.ctr.description}
                align="right"
              />
              <HeaderCell
                label={integrasiIklanCopy.table.columns.cpl.label}
                description={integrasiIklanCopy.table.columns.cpl.description}
                align="right"
              />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                  {integrasiIklanCopy.table.empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.uniqueId} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="border-slate-200 dark:border-slate-700">
                      {row.platformName}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.businessGroupName}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{row.accountName}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      {row.currency ? <span>{row.currency}</span> : null}
                      {getLiveStatusLabel(row) ? (
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${getLiveStatusLabel(row)?.className}`}
                          title={row.liveError || undefined}
                        >
                          {getLiveStatusLabel(row)?.label}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.advertiserName}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(row.spend)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(row.burn)}
                  </td>
                  <td
                    className="px-4 py-3 text-right text-slate-700 dark:text-slate-200"
                    title={
                      row.leadSource === 'order-fallback'
                        ? `Leads otomatis dari order masuk berdasarkan created_at. Order terakhir: ${row.lastOrderFallbackDate || '-'}`
                        : row.leadSource === 'order-share'
                          ? `Leads otomatis dari order masuk berdasarkan created_at. Sebagian order dibagi proporsional per akun dalam advertiser/platform yang sama. Order terakhir: ${row.lastOrderFallbackDate || '-'}`
                          : row.leadSource === 'dashboard'
                            ? `Order akun ini belum terbaca dengan aman, jadi sementara memakai leads dashboard manual. Input terakhir: ${row.lastLeadInputDate || '-'}`
                          : undefined
                    }
                  >
                    <div>
                      <div>{formatNumber(row.leads)}</div>
                      {getLeadSourceLabel(row) ? (
                        <div className={`mt-1 text-xs ${getLeadSourceLabel(row)?.className}`}>
                          {getLeadSourceLabel(row)?.label}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                    {formatNumber(row.clicks)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                    {formatPercent(row.ctr)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                    {row.leads > 0 ? (
                      <span
                        title={
                          row.leadSource === 'order-fallback'
                            ? `CPL ini dihitung dari order masuk berdasarkan created_at. Order terakhir: ${row.lastOrderFallbackDate || '-'}`
                            : row.leadSource === 'order-share'
                              ? `CPL ini dihitung dari order masuk berdasarkan created_at. Sebagian order dibagi proporsional per akun dalam advertiser/platform yang sama. Order terakhir: ${row.lastOrderFallbackDate || '-'}`
                              : row.leadSource === 'dashboard'
                                ? `CPL ini sementara memakai leads dashboard manual. Input terakhir: ${row.lastLeadInputDate || '-'}`
                              : undefined
                        }
                      >
                        {formatCurrency(row.cpl)}
                      </span>
                    ) : row.leadInputStatus === 'missing-in-range' ? (
                      <span
                        className="text-amber-600 dark:text-amber-400"
                        title={`Leads dashboard untuk akun ini belum diinput pada rentang yang dipilih. Input terakhir: ${row.lastLeadInputDate || '-'}`}
                      >
                        Belum input
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
