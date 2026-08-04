import React, { useState, useEffect, useLayoutEffect } from 'react';
import { Tabs, TabsContent, TabsRail, TabsTrigger, TabsViewport } from "@/app/components/ui/tabs";
import { StockSettings } from "./components/StockSettings";
import { ProductList } from "./components/ProductList";
import { StockTransactions } from "./components/StockTransactions";
import { StockValuationReport } from "./components/StockValuationReport";
import { Boxes, Package, Repeat, Settings, FileBarChart } from "lucide-react";
import { usePermissions } from "@/app/hooks/usePermissions";
import {
  OperationalPageShell,
} from "@/app/components/ui/operational-page";

interface StockManagementPageProps {
  defaultTab?: string;
}

type StockTab = 'products' | 'transactions' | 'valuation' | 'settings';
const STOCK_TABS: StockTab[] = ['products', 'transactions', 'valuation', 'settings'];

const isStockTab = (value: string): value is StockTab => STOCK_TABS.includes(value as StockTab);

export function StockManagementPage({ defaultTab = 'products' }: StockManagementPageProps) {
  const { hasPermission } = usePermissions();

  const isTabAllowed = (tab: StockTab) => {
    if (tab === 'products') return hasPermission('inventory.view');
    if (tab === 'transactions') return hasPermission('stock.transaction.view');
    if (tab === 'valuation') return hasPermission('stock.valuation.view');
    if (tab === 'settings') return hasPermission('stock.settings.manage');

    return false;
  };

  const determineInitialTab = (preferredTab: string): StockTab => {
    if (
      (preferredTab === 'products' ||
        preferredTab === 'transactions' ||
        preferredTab === 'valuation' ||
        preferredTab === 'settings') &&
      isTabAllowed(preferredTab)
    ) {
      return preferredTab;
    }

    if (isTabAllowed('products')) return 'products';
    if (isTabAllowed('transactions')) return 'transactions';
    if (isTabAllowed('valuation')) return 'valuation';
    if (isTabAllowed('settings')) return 'settings';

    return 'products';
  };

  const [activeTab, setActiveTab] = useState<StockTab>(() => determineInitialTab(defaultTab));

  const handleTabChange = (value: string) => {
    if (isStockTab(value) && isTabAllowed(value)) {
      setActiveTab(value);
    }
  };

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    const nextTab = determineInitialTab(defaultTab);
    setActiveTab((currentTab) => (currentTab === nextTab ? currentTab : nextTab));
  }, [defaultTab, hasPermission]);

  useEffect(() => {
    if (!isTabAllowed(activeTab)) {
      setActiveTab(determineInitialTab(defaultTab));
    }
  }, [activeTab, defaultTab, hasPermission]);

  useLayoutEffect(() => {
    const resetInventoryScroll = () => {
      const workspace = document.querySelector<HTMLElement>('.workspaceViewport');
      workspace?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document
        .querySelectorAll<HTMLElement>('.inventoryPage .tableScroller, .inventoryPage .uiDataTableScroller')
        .forEach((scroller) => {
          scroller.scrollTop = 0;
          scroller.scrollLeft = 0;
        });
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    };

    const animationFrame = window.requestAnimationFrame(resetInventoryScroll);
    const restoreTimers = [50, 180, 420, 800, 1200].map((delay) =>
      window.setTimeout(resetInventoryScroll, delay)
    );

    return () => {
      window.cancelAnimationFrame(animationFrame);
      restoreTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [activeTab, defaultTab]);

  return (
    <OperationalPageShell className="inventoryPage pb-48 md:pb-32">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="inventoryShell">
        <section className="topbar inventoryTopbar">
          <div className="topbarTitle">
            <div className="eyebrowLine">
              <Boxes className="h-4 w-4" />
              Inventory
            </div>
            <h1>Manajemen Stok</h1>
            <p>Kelola produk, mutasi barang, nilai aset, dan satuan stok operasional.</p>
          </div>
        </section>

        <TabsViewport className="inventoryTabsViewport">
          <TabsRail className="masterDataTabs inventoryTabs min-w-max">
            {hasPermission('inventory.view') && (
              <TabsTrigger value="products" className="masterDataTab inventoryTab">
                <Package className="h-4 w-4" /> Data Produk
              </TabsTrigger>
            )}
            {hasPermission('stock.transaction.view') && (
              <TabsTrigger value="transactions" className="masterDataTab inventoryTab">
                <Repeat className="h-4 w-4" /> Transaksi & Mutasi
              </TabsTrigger>
            )}
            {hasPermission('stock.valuation.view') && (
              <TabsTrigger value="valuation" className="masterDataTab inventoryTab">
                <FileBarChart className="h-4 w-4" /> Laporan Valuasi
              </TabsTrigger>
            )}
            {hasPermission('stock.settings.manage') && (
              <TabsTrigger value="settings" className="masterDataTab inventoryTab">
                <Settings className="h-4 w-4" /> Pengaturan
              </TabsTrigger>
            )}
          </TabsRail>
        </TabsViewport>

        {hasPermission('inventory.view') && (
          <TabsContent value="products" className="inventoryTabContent">
            <ProductList />
          </TabsContent>
        )}

        {hasPermission('stock.transaction.view') && (
          <TabsContent value="transactions" className="inventoryTabContent">
            <StockTransactions />
          </TabsContent>
        )}

        {hasPermission('stock.valuation.view') && (
          <TabsContent value="valuation" className="inventoryTabContent">
            <StockValuationReport />
          </TabsContent>
        )}

        {hasPermission('stock.settings.manage') && (
          <TabsContent value="settings" className="inventoryTabContent">
            <StockSettings />
          </TabsContent>
        )}
      </Tabs>
    </OperationalPageShell>
  );
}
