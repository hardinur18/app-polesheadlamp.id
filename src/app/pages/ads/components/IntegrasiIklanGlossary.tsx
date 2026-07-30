import { ChevronDown } from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { Card } from '@/app/components/ui/card';
import { integrasiIklanGlossary } from '../integrasiIklanContent';

export function IntegrasiIklanGlossary() {
  return (
    <Card className="border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Glosarium Integrasi Iklan
              </h2>
              <Badge variant="outline" className="border-slate-200 dark:border-slate-700">
                Istilah Acuan
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Buka jika ingin melihat definisi istilah, label, dan aturan baca fitur ini.
            </p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 group-open:rotate-180 dark:text-slate-400" />
        </summary>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {integrasiIklanGlossary.map((item) => (
            <div
              key={item.term}
              className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/50"
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {item.term}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </details>
    </Card>
  );
}
