import React from 'react';
import { useMasterData } from './master-data/context';
import { TechnicianDashboard } from './technician/TechnicianDashboard';
import { CSDashboard } from './cs/CSDashboard';
import { AdvertiserDashboard } from './advertiser/AdvertiserDashboard';
import { Megaphone, MessageSquare, Wrench, type LucideIcon } from 'lucide-react';
import { DASHBOARD_VIEW_PERMISSION_MAP, DashboardViewMode } from '../data/permissions';
import { normalizeRole } from '../data/roleHelpers';
import { Tabs, TabsContent, TabsRail, TabsTrigger, TabsViewport } from '../components/ui/tabs';

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

function DashboardViewContent({ viewMode }: { viewMode: DashboardViewMode }) {
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

  if (!canSwitchView) {
    return <DashboardViewContent viewMode={activeViewMode} />;
  }

  return (
    <Tabs
      value={activeViewMode}
      onValueChange={(value) => onViewModeChange?.(value as DashboardViewMode)}
      className="dashboardViewTabsRoot"
    >
      <div className="dashboardViewSwitcherWrap">
        <TabsViewport className="dashboardViewTabsViewport">
          <TabsRail className="dashboardViewTabsRail min-w-max" aria-label="Dashboard view">
            {visibleViewModes.map((mode) => {
              const Icon = DASHBOARD_VIEW_META[mode].icon;

              return (
                <TabsTrigger
                  key={mode}
                  value={mode}
                  className="dashboardViewTab"
                >
                  <Icon className="h-4 w-4" />
                  <span>{DASHBOARD_VIEW_META[mode].label}</span>
                </TabsTrigger>
              );
            })}
          </TabsRail>
        </TabsViewport>
      </div>

      {visibleViewModes.map((mode) => (
        <TabsContent key={mode} value={mode} className="dashboardViewContent">
          {mode === activeViewMode ? <DashboardViewContent viewMode={mode} /> : null}
        </TabsContent>
      ))}
    </Tabs>
  );
}
