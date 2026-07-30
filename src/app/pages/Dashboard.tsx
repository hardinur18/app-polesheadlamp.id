import React from 'react';
import { useMasterData } from './master-data/context';
import { TechnicianDashboard } from './technician/TechnicianDashboard';
import { CSDashboard } from './cs/CSDashboard';
import { AdvertiserDashboard } from './advertiser/AdvertiserDashboard';
import { Megaphone, MessageSquare, Wrench, type LucideIcon } from 'lucide-react';
import { DASHBOARD_VIEW_PERMISSION_MAP, DashboardViewMode } from '../data/permissions';
import { normalizeRole } from '../data/roleHelpers';
import { cn } from '../components/ui/utils';

interface DashboardProps {
  viewMode?: DashboardViewMode;
  availableViewModes?: DashboardViewMode[];
  onViewModeChange?: (mode: DashboardViewMode) => void;
}

const DASHBOARD_VIEW_META: Record<DashboardViewMode, { label: string; icon: LucideIcon }> = {
  Advertiser: { label: 'Advertiser', icon: Megaphone },
  CS: { label: 'CS', icon: MessageSquare },
  Teknisi: { label: 'Teknisi', icon: Wrench },
};

function renderDashboardView(viewMode: DashboardViewMode) {
  if (viewMode === 'Teknisi') return <TechnicianDashboard />;
  if (viewMode === 'CS') return <CSDashboard />;
  return <AdvertiserDashboard />;
}

export default function Dashboard({
  viewMode,
  availableViewModes = [],
  onViewModeChange,
}: DashboardProps) {
  const { currentRole } = useMasterData();
  const effectiveRole = normalizeRole(viewMode || currentRole);
  const activeViewMode: DashboardViewMode =
    effectiveRole in DASHBOARD_VIEW_PERMISSION_MAP ? effectiveRole as DashboardViewMode : 'Advertiser';
  const visibleViewModes = availableViewModes.length > 0 ? availableViewModes : [activeViewMode];
  const canSwitchView = visibleViewModes.length > 1 && Boolean(onViewModeChange);

  return (
    <>
      {canSwitchView && (
        <div className="dashboardViewSwitcherWrap">
          <div
            role="tablist"
            aria-label="Dashboard view"
            className="dashboardViewSwitcher"
          >
            {visibleViewModes.map((mode) => {
              const isActive = mode === activeViewMode;
              const Icon = DASHBOARD_VIEW_META[mode].icon;

              return (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onViewModeChange?.(mode)}
                  className={cn('dashboardViewTab', isActive && 'active')}
                >
                  <Icon className="h-4 w-4" />
                  <span>{DASHBOARD_VIEW_META[mode].label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {renderDashboardView(activeViewMode)}
    </>
  );
}
