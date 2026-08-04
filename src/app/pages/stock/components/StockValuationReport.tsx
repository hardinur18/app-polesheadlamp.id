import React, { useState, useEffect } from 'react';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { Loader2, Download, Printer, TrendingUp, DollarSign, Boxes } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import * as XLSX from 'xlsx';
import { toast } from "sonner";
import { usePermissions } from "@/app/hooks/usePermissions";
import { STOCK_UPDATED_EVENT, groupTransactionsByProduct, reconcileProductStock, type StockTransactionLike } from "../utils/stockLedger";
import { DataTable, TableText } from "@/app/components/ui/data-table";
import { MasterDataTableTitle } from "@/app/components/ui/master-data-table-title";
import {
  OperationalEmptyState,
  OperationalFilterPanel,
  OperationalKpiCard,
  OperationalKpiGrid,
  OperationalTableCard,
} from "@/app/components/ui/operational-page";
import { InventoryTablePagination, useInventoryTablePagination } from "./InventoryTablePagination";

interface Product {
  id: string;
  name: string;
  category: string;
  current_qty: number;
  average_cost: number;
  unit: string;
  recorded_qty?: number;
  stock_needs_review?: boolean;
}

const formatValuationCurrency = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatValuationNumber = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });

export function StockValuationReport() {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const { hasPermission } = usePermissions();

  useEffect(() => {
    fetchData();

    const handleStockUpdate = () => {
      fetchData();
    };

    window.addEventListener(STOCK_UPDATED_EVENT, handleStockUpdate);
    return () => window.removeEventListener(STOCK_UPDATED_EVENT, handleStockUpdate);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsRes, transactionsRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, category, current_qty, average_cost, unit')
          .order('name'),
        supabase
          .from('stock_transactions')
          .select('id, product_id, type, quantity, unit_price, total_value, date, created_at'),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (transactionsRes.error) throw transactionsRes.error;

      const transactionsByProduct = groupTransactionsByProduct((transactionsRes.data || []) as StockTransactionLike[]);
      const nextProducts = (productsRes.data || []).map((product) => {
        const stockState = reconcileProductStock(product, transactionsByProduct.get(product.id) || []);
        return {
          id: product.id,
          name: product.name,
          category: product.category,
          current_qty: stockState.effectiveQty,
          average_cost: stockState.effectiveAverageCost,
          unit: product.unit,
          recorded_qty: stockState.recordedQty,
          stock_needs_review: stockState.hasMismatch,
        } as Product;
      });

      setProducts(nextProducts);
    } catch (error) {
      console.error("Error fetching valuation:", error);
      toast.error("Gagal memuat laporan valuasi");
    } finally {
      setLoading(false);
    }
  };

  const totalAssetValue = products.reduce((sum, p) => sum + (p.current_qty * p.average_cost), 0);
  const totalItems = products.reduce((sum, p) => sum + p.current_qty, 0);
  const valuationPagination = useInventoryTablePagination(products);

  const handleExportExcel = () => {
    try {
      // Format data for Excel
      const excelData = products.map((p, index) => ({
        'No': index + 1,
        'ID Produk': p.id,
        'Nama Barang': p.name,
        'Kategori': p.category,
        'Stok Fisik': p.current_qty,
        'Satuan': p.unit,
        'HPP Satuan (Rp)': p.average_cost,
        'Total Valuasi (Rp)': p.current_qty * p.average_cost
      }));
      
      // Add total row
      excelData.push({
        'No': '',
        'ID Produk': '',
        'Nama Barang': 'TOTAL KESELURUHAN',
        'Kategori': '',
        'Stok Fisik': totalItems,
        'Satuan': '',
        'HPP Satuan (Rp)': '',
        'Total Valuasi (Rp)': totalAssetValue
      } as any);

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      // Adjust column widths
      const wscols = [
        { wch: 5 },  // No
        { wch: 36 }, // ID
        { wch: 30 }, // Nama
        { wch: 15 }, // Kategori
        { wch: 10 }, // Stok
        { wch: 10 }, // Satuan
        { wch: 15 }, // HPP
        { wch: 20 }, // Total
      ];
      worksheet['!cols'] = wscols;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Valuasi Aset");
      
      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `Laporan_Valuasi_Aset_${dateStr}.xlsx`);
      toast.success("Berhasil mengekspor Laporan Valuasi ke Excel");
    } catch (error) {
      console.error("Gagal export excel:", error);
      toast.error("Gagal mengekspor data ke Excel");
    }
  };

  return (
    <div className="inventoryTabStack">
      <OperationalFilterPanel className="inventoryFilterPanel">
        <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Laporan Valuasi Aset</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Ringkasan nilai persediaan berdasarkan HPP rata-rata.</p>
        </div>
        <div className="inventoryFilterActions">
            <Button variant="outline" onClick={() => window.print()} icon={<Printer className="h-4 w-4" />}>
                Cetak
            </Button>
            {hasPermission('stock.valuation.export') && (
              <Button variant="outline" onClick={handleExportExcel} disabled={loading || products.length === 0} icon={<Download className="h-4 w-4" />}>
                  Export Excel
              </Button>
            )}
        </div>
      </OperationalFilterPanel>

      <OperationalKpiGrid className="inventoryKpiGrid sm:grid-cols-2 xl:grid-cols-3">
        <OperationalKpiCard label="Total Nilai Aset" value={formatValuationCurrency(totalAssetValue)} icon={DollarSign} tone="emerald" />
        <OperationalKpiCard label="Total Item Fisik" value={totalItems.toLocaleString('id-ID')} icon={TrendingUp} tone="blue" />
        <OperationalKpiCard label="Jenis Produk" value={products.length} icon={Boxes} tone="amber" />
      </OperationalKpiGrid>

      <OperationalTableCard className="inventoryTableCard">
        <MasterDataTableTitle title="Laporan Valuasi Aset" count={products.length} variant="active" icon={Boxes} />
        <DataTable columns={[64, 320, 170, 132, 150, 168]} minWidth={1004} rowMinHeight={66} cellY={12} textMax={300}>
        <table>
            <TableHeader>
                <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>Nama Barang</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-right">Stok Fisik</TableHead>
                    <TableHead className="text-right">HPP Satuan</TableHead>
                    <TableHead className="text-right">Total Valuasi</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading ? (
                    <TableRow><TableCell colSpan={6} className="h-32 text-center border-0"><Loader2 className="animate-spin h-6 w-6 mx-auto text-slate-400" /></TableCell></TableRow>
                ) : products.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="border-0"><OperationalEmptyState icon={Boxes} title="Tidak ada data valuasi" description="Belum ada produk yang bisa dihitung pada laporan ini." className="py-12" /></TableCell></TableRow>
                ) : (
                    valuationPagination.paginatedItems.map((p, index) => (
                        <TableRow
                          key={p.id}
                          className="border-slate-100 hover:bg-blue-50/40 dark:border-slate-800 dark:hover:bg-slate-800/60"
                        >
                            <TableCell className="inventoryTableIndexCell">
                              {valuationPagination.startIndex + index + 1}
                            </TableCell>
                            <TableCell>
                              <div className="inventoryProductNameCell">
                                <span
                                  className={
                                    p.stock_needs_review
                                      ? "inventoryProductStatusDot isAudit"
                                      : p.current_qty <= 0
                                      ? "inventoryProductStatusDot isLow"
                                      : "inventoryProductStatusDot isOk"
                                  }
                                />
                                <TableText primary={p.name} secondary={p.stock_needs_review ? 'Audit histori' : undefined} />
                              </div>
                            </TableCell>
                            <TableCell><span className="inventoryPlainCellText">{p.category || '-'}</span></TableCell>
                            <TableCell className="inventoryNumericCell">
                              <span className={p.current_qty <= 0 ? "inventoryQtyValue isLow" : "inventoryQtyValue isOk"}>
                                {formatValuationNumber(p.current_qty)}
                              </span>
                              <span className="inventoryQtyUnit">{p.unit}</span>
                            </TableCell>
                            <TableCell className="inventoryMoneyCell"><span className="inventoryMoneyValue">{formatValuationCurrency(p.average_cost)}</span></TableCell>
                            <TableCell className="text-right font-bold tabular-nums text-slate-900 dark:text-slate-100">
                              <span className="inventoryMoneyValue isAsset">{formatValuationCurrency(p.current_qty * p.average_cost)}</span>
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </table>
        </DataTable>
        <InventoryTablePagination {...valuationPagination} />
      </OperationalTableCard>
    </div>
  );
}
