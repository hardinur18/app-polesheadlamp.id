import type { ReactNode } from 'react';

import { Badge } from '@/app/components/ui/badge';
import { Switch } from '@/app/components/ui/switch';
import { Card } from '@/app/components/ui/card';
import { SmartFilterDate } from '@/app/components/SmartFilterDate';
import type { DateRange } from 'react-day-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import type {
  AdsMonitoringWorkspaceMode,
  AdsMonitoringWorkspaceOption,
} from '../useAdsMonitoringWorkspaceData';

function ControlField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      {children}
    </div>
  );
}

type AdsMonitoringWorkspaceControls = {
  platformOptions: AdsMonitoringWorkspaceOption[];
  advertiserOptions: AdsMonitoringWorkspaceOption[];
  selectedPlatformId: string;
  selectedAdvertiserId: string;
  openClawMode: AdsMonitoringWorkspaceMode;
  compareMode: boolean;
  activeFilterCount?: number;
  onPlatformChange: (value: string) => void;
  onAdvertiserChange: (value: string) => void;
  onOpenClawModeChange: (value: AdsMonitoringWorkspaceMode) => void;
  onCompareModeChange: (value: boolean) => void;
};

type AdsMonitoringWorkspaceFrameProps = {
  title: string;
  description: string;
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  badges?: string[];
  stats?: Array<{
    label: string;
    value: string;
    hint?: string;
  }>;
  controls?: AdsMonitoringWorkspaceControls;
  children: ReactNode;
};

export function AdsMonitoringWorkspaceFrame({
  title,
  description,
  dateRange,
  setDateRange,
  badges = [],
  stats = [],
  controls,
  children,
}: AdsMonitoringWorkspaceFrameProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-0">
      <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {badges.map((badge) => (
                  <Badge
                    key={badge}
                    variant="outline"
                    className="border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
                  >
                    {badge}
                  </Badge>
                ))}
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  {title}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              </div>
            </div>

            <div className="w-full xl:max-w-[340px]">
              <SmartFilterDate date={dateRange} setDate={setDateRange} />
            </div>
          </div>

          {stats.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/40"
                >
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {stat.label}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    {stat.value}
                  </div>
                  {stat.hint ? (
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {stat.hint}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Card>

      {controls ? (
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Global Control Bar
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Filter workspace, pilih mode kendali, dan aktifkan compare tanpa keluar dari lane yang sedang dibaca.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-slate-200 dark:border-slate-700">
                  {controls.activeFilterCount || 0} filter aktif
                </Badge>
                <Badge variant="outline" className="border-slate-200 dark:border-slate-700">
                  mode {controls.openClawMode}
                </Badge>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(280px,1.2fr)_repeat(3,minmax(0,1fr))_minmax(180px,0.9fr)]">
              <ControlField label="Rentang Waktu">
                <SmartFilterDate date={dateRange} setDate={setDateRange} className="w-full" />
              </ControlField>

              <ControlField label="Platform">
                <Select value={controls.selectedPlatformId} onValueChange={controls.onPlatformChange}>
                  <SelectTrigger className="w-full min-w-0 bg-white dark:bg-slate-900">
                    <SelectValue placeholder="Semua platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua platform</SelectItem>
                    {controls.platformOptions.map((platform) => (
                      <SelectItem key={platform.id} value={platform.id}>
                        {platform.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ControlField>

              <ControlField label="Advertiser">
                <Select
                  value={controls.selectedAdvertiserId}
                  onValueChange={controls.onAdvertiserChange}
                >
                  <SelectTrigger className="w-full min-w-0 bg-white dark:bg-slate-900">
                    <SelectValue placeholder="Semua advertiser" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua advertiser</SelectItem>
                    {controls.advertiserOptions.map((advertiser) => (
                      <SelectItem key={advertiser.id} value={advertiser.id}>
                        {advertiser.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ControlField>

              <ControlField label="OpenClaw Mode">
                <Select
                  value={controls.openClawMode}
                  onValueChange={(value) =>
                    controls.onOpenClawModeChange(value as AdsMonitoringWorkspaceMode)
                  }
                >
                  <SelectTrigger className="w-full min-w-0 bg-white dark:bg-slate-900">
                    <SelectValue placeholder="Pilih mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="assisted">Assisted</SelectItem>
                    <SelectItem value="semi-auto">Semi Auto</SelectItem>
                  </SelectContent>
                </Select>
              </ControlField>

              <ControlField label="Compare">
                <div className="flex h-9 items-center justify-between rounded-xl border border-slate-200 px-3 dark:border-slate-800">
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    Bandingkan vs periode sebelumnya
                  </span>
                  <Switch
                    checked={controls.compareMode}
                    onCheckedChange={controls.onCompareModeChange}
                  />
                </div>
              </ControlField>
            </div>
          </div>
        </Card>
      ) : null}

      {children}
    </div>
  );
}
