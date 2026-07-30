import { Badge } from '@/app/components/ui/badge';
import { Card } from '@/app/components/ui/card';
import { integrasiIklanCopy } from '../integrasiIklanContent';

const legendToneClasses: Record<string, string> = {
  emerald:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
  amber:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
  blue:
    'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300',
  indigo:
    'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300',
};

type IntegrasiIklanHeroProps = {
  enabledAccountCount: number;
  platformCount: number;
  selectedRangeIncludesToday: boolean;
};

export function IntegrasiIklanHero({
  enabledAccountCount,
  platformCount,
  selectedRangeIncludesToday,
}: IntegrasiIklanHeroProps) {
  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-6 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.10),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.08),_transparent_32%)] p-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-blue-600 text-white border-blue-600 hover:bg-blue-600">
              {integrasiIklanCopy.badge}
            </Badge>
            {integrasiIklanCopy.secondaryBadges.map((badge) => (
              <Badge
                key={badge}
                variant="outline"
                className="border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
              >
                {badge}
              </Badge>
            ))}
          </div>

          <div className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Command Center Integrasi
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {integrasiIklanCopy.title}
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {integrasiIklanCopy.description}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Akun API Aktif
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {enabledAccountCount}
              </div>
              <div className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Akun yang benar-benar ikut tampil di fitur ini.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Lane Platform
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {platformCount}
              </div>
              <div className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {integrasiIklanCopy.heroHighlights.coverage.description}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Mode Rentang
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                {selectedRangeIncludesToday ? 'Snapshot + Live Cache' : 'Snapshot Database'}
              </div>
              <div className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {selectedRangeIncludesToday
                  ? integrasiIklanCopy.heroHighlights.today.description
                  : integrasiIklanCopy.heroHighlights.history.description}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Aturan Baca Data
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Ringkasan cepat sumber data dan cara sistem membaca angka di fitur ini.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {integrasiIklanCopy.sourceLegend.map((item) => (
              <div
                key={item.label}
                className={`rounded-2xl border p-3 ${legendToneClasses[item.tone]}`}
              >
                <div className="text-sm font-semibold">{item.label}</div>
                <p className="mt-1 text-xs leading-relaxed opacity-90">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
