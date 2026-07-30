import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { StockSettings } from "./components/StockSettings";
import { ProductList } from "./components/ProductList";
import { StockTransactions } from "./components/StockTransactions";
import { StockValuationReport } from "./components/StockValuationReport";
import { Boxes, Package, Repeat, Settings, FileBarChart } from "lucide-react";
import { usePermissions } from "@/app/hooks/usePermissions";
import {
  OperationalPageHeader,
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
    const nextTab = determineInitialTab(defaultTab);
    setActiveTab((currentTab) => (currentTab === nextTab ? currentTab : nextTab));
  }, [defaultTab, hasPermission]);

  useEffect(() => {
    if (!isTabAllowed(activeTab)) {
      setActiveTab(determineInitialTab(defaultTab));
    }
  }, [activeTab, defaultTab, hasPermission]);

  return (
    <OperationalPageShell className="max-w-[1680px] space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <OperationalPageHeader
          icon={Boxes}
          eyebrow="Inventory"
          title="Manajemen Stok"
          subtitle="Kelola produk, mutasi barang, nilai aset, dan satuan stok operasional."
          className="overflow-hidden"
        >
          <div className="overflow-x-auto p-3">
            <TabsList className="h-auto min-w-max rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {hasPermission('inventory.view') && (
            <TabsTrigger value="products" className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-blue-300">
              <Package className="h-4 w-4" /> Data Produk
            </TabsTrigger>
          )}
          {hasPermission('stock.transaction.view') && (
            <TabsTrigger value="transactions" className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-blue-300">
              <Repeat className="h-4 w-4" /> Transaksi & Mutasi
            </TabsTrigger>
          )}
          {hasPermission('stock.valuation.view') && (
            <TabsTrigger value="valuation" className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-blue-300">
              <FileBarChart className="h-4 w-4" /> Laporan Valuasi
            </TabsTrigger>
          )}
          {hasPermission('stock.settings.manage') && (
            <TabsTrigger value="settings" className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-blue-300">
              <Settings className="h-4 w-4" /> Pengaturan
            </TabsTrigger>
          )}
            </TabsList>
          </div>
        </OperationalPageHeader>

        {hasPermission('inventory.view') && (
          <TabsContent value="products" className="mt-0 space-y-4">
            <ProductList />
          </TabsContent>
        )}

        {hasPermission('stock.transaction.view') && (
          <TabsContent value="transactions" className="mt-0 space-y-4">
            <StockTransactions />
          </TabsContent>
        )}

        {hasPermission('stock.valuation.view') && (
          <TabsContent value="valuation" className="mt-0 space-y-4">
            <StockValuationReport />
          </TabsContent>
        )}

        {hasPermission('stock.settings.manage') && (
          <TabsContent value="settings" className="mt-0 space-y-4">
            <StockSettings />
          </TabsContent>
        )}
      </Tabs>
    </OperationalPageShell>
  );
}
