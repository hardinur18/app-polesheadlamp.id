import { Activity, Wallet } from 'lucide-react';

import { Card } from '@/app/components/ui/card';
import { integrasiIklanCopy } from '../integrasiIklanContent';
import type { IntegrasiIklanSummary } from '../integrasiIklanTypes';
import { IntegrasiIklanCopyHint } from './IntegrasiIklanCopyHint';

type IntegrasiIklanSummaryCardsProps = {
  summary: IntegrasiIklanSummary;
  formatCurrency: (value: number) => string;
  formatNumber: (value: number) => string;
};

export function IntegrasiIklanSummaryCards({
  summary,
  formatCurrency,
  formatNumber,
}: IntegrasiIklanSummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      <Card className="border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:col-span-2">
        <div className="flex items-center gap-3">
          <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <div>
            <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
              <span>{integrasiIklanCopy.summaries.spend.label}</span>
              <IntegrasiIklanCopyHint content={integrasiIklanCopy.summaries.spend.description} />
            </div>
            <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {formatCurrency(summary.spend)}
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:col-span-2">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <div>
            <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
              <span>{integrasiIklanCopy.summaries.burn.label}</span>
              <IntegrasiIklanCopyHint content={integrasiIklanCopy.summaries.burn.description} />
            </div>
            <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {formatCurrency(summary.burn)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              PPN {formatCurrency(summary.ppn)} • Fee {formatCurrency(summary.fee)}
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
          <span>{integrasiIklanCopy.summaries.leads.label}</span>
          <IntegrasiIklanCopyHint content={integrasiIklanCopy.summaries.leads.description} />
        </div>
        <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {formatNumber(summary.leads)}
        </div>
      </Card>

      <Card className="border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
          <span>{integrasiIklanCopy.summaries.clicks.label}</span>
          <IntegrasiIklanCopyHint content={integrasiIklanCopy.summaries.clicks.description} />
        </div>
        <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {formatNumber(summary.clicks)}
        </div>
      </Card>
    </div>
  );
}
