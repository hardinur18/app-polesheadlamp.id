import React from 'react';
import { Calendar, Map as MapIcon, Settings, type LucideIcon } from 'lucide-react';

import { Tabs, TabsRail, TabsTrigger, TabsViewport } from '../../components/ui/tabs';

export type OrderViewMode = 'table' | 'map' | 'calendar';

type OrderViewModeOption = {
  value: OrderViewMode;
  label: string;
  icon: LucideIcon;
};

const ORDER_VIEW_MODES: OrderViewModeOption[] = [
  { value: 'table', label: 'List', icon: Settings },
  { value: 'map', label: 'Peta', icon: MapIcon },
  { value: 'calendar', label: 'Kalender', icon: Calendar },
];

type OrderViewModeTabsProps = {
  value: OrderViewMode;
  onChange: (value: OrderViewMode) => void;
  isAdvertiserUser: boolean;
};

export function OrderViewModeTabs({ value, onChange, isAdvertiserUser }: OrderViewModeTabsProps) {
  const visibleModes = ORDER_VIEW_MODES.filter((mode) => mode.value !== 'map' || !isAdvertiserUser);

  return (
    <Tabs
      value={value}
      onValueChange={(nextValue) => onChange(nextValue as OrderViewMode)}
      className="masterDataTabsShell orderViewTabsShell"
    >
      <TabsViewport className="orderViewTabsViewport">
        <TabsRail className="masterDataTabs orderViewTabs">
          {visibleModes.map((mode) => {
            const ModeIcon = mode.icon;

            return (
              <TabsTrigger key={mode.value} value={mode.value} className="masterDataTab orderViewTab">
                <ModeIcon className="h-4 w-4" />
                <span>{mode.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsRail>
      </TabsViewport>
    </Tabs>
  );
}
