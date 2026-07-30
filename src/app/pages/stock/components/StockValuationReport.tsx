import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { Badge } from "@/app/components/ui/badge";
import { Loader2, Download, Printer, TrendingUp, DollarSign, AlertTriangle, Boxes } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import * as XLSX from 'xlsx';
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/app/components/ui/alert";
import { usePermissions } from "@/app/hooks/usePermissions";
import { STOCK_UPDATED_EVENT, groupTransactionsByProduct, reconcileProductStock, type StockTransactionLike } from "../utils/stockLedger";
import {
  OperationalEmptyState,
  OperationalFilterPanel,
  OperationalKpiCard,
  OperationalKpiGrid,
  OperationalTableCard,
} from "@/app/components/ui/operational-page";

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
  const stockMismatchCount = products.filter((product) => product.stock_needs_review).length;

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
    <div className="space-y-4">
      <OperationalFilterPanel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Laporan Valuasi Aset</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Ringkasan nilai persediaan berdasarkan HPP rata-rata.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="h-9 border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <Printer className="mr-2 h-4 w-4" /> Cetak
            </Button>
            {hasPermission('stock.valuation.export') && (
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={loading || products.length === 0} className="h-9 border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <Download className="mr-2 h-4 w-4" /> Export Excel
              </Button>
            )}
        </div>
      </OperationalFilterPanel>

      <OperationalKpiGrid className="sm:grid-cols-2 xl:grid-cols-3">
        <OperationalKpiCard label="Total Nilai Aset" value={`Rp ${totalAssetValue.toLocaleString('id-ID')}`} icon={DollarSign} tone="emerald" />
        <OperationalKpiCard label="Total Item Fisik" value={totalItems.toLocaleString('id-ID')} icon={TrendingUp} tone="blue" />
        <OperationalKpiCard label="Jenis Produk" value={products.length} icon={Boxes} tone="amber" />
      </OperationalKpiGrid>

      {stockMismatchCount > 0 && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Valuasi memakai stok hasil histori</AlertTitle>
          <AlertDescription>
            {stockMismatchCount} produk terdeteksi punya selisih pada data tabel lama, jadi laporan ini memakai histori transaksi agar nilai aset lebih akurat.
          </AlertDescription>
        </Alert>
      )}

      <OperationalTableCard>
        <Table className="min-w-[900px]">
            <TableHeader className="bg-slate-50/80 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                    <TableHead className="h-11 w-[56px] text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">No</TableHead>
                    <TableHead className="h-11 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Nama Barang</TableHead>
                    <TableHead className="h-11 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Kategori</TableHead>
                    <TableHead className="h-11 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Stok Fisik</TableHead>
                    <TableHead className="h-11 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">HPP Satuan</TableHead>
                    <TableHead className="h-11 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Valuasi</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading ? (
                    <TableRow><TableCell colSpan={6} className="h-32 text-center border-0"><Loader2 className="animate-spin h-6 w-6 mx-auto text-slate-400" /></TableCell></TableRow>
                ) : products.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="border-0"><OperationalEmptyState icon={Boxes} title="Tidak ada data valuasi" description="Belum ada produk yang bisa dihitung pada laporan ini." className="py-12" /></TableCell></TableRow>
                ) : (
                    products.map((p, index) => (
                        <TableRow
                          key={p.id}
                          className={
                            p.stock_needs_review
                              ? "border-slate-100 bg-amber-50/30 hover:bg-amber-50/50 dark:border-slate-800 dark:bg-amber-950/10 dark:hover:bg-amber-950/20"
                              : p.current_qty <= 0
                              ? "border-slate-100 bg-red-50/20 hover:bg-red-50/40 dark:border-slate-800 dark:bg-red-950/10 dark:hover:bg-red-950/20"
                              : "border-slate-100 hover:bg-blue-50/40 dark:border-slate-800 dark:hover:bg-slate-800/60"
                          }
                        >
                            <TableCell className="w-[56px] text-xs font-semibold text-slate-400">
                              <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border border-slate-200 bg-white px-2 tabular-nums text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                                {index + 1}
                              </span>
                            </TableCell>
                            <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={
                                    p.stock_needs_review
                                      ? "h-2 w-2 rounded-full bg-amber-500"
                                      : p.current_qty <= 0
                                      ? "h-2 w-2 rounded-full bg-red-500"
                                      : "h-2 w-2 rounded-full bg-emerald-500"
                                  }
                                />
                                <span>{p.name}</span>
                                {p.stock_needs_review && (
                                  <Badge className="h-5 border-amber-200 bg-amber-100 px-1.5 text-[10px] text-amber-800 hover:bg-amber-100">
                                    Audit Histori
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell><Badge variant="outline" className="rounded-md border-violet-200 bg-violet-50 font-medium text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300">{p.category || '-'}</Badge></TableCell>
                            <TableCell className="text-right font-medium">
                              <span
                                className={
                                  p.current_qty <= 0
                                    ? "inline-flex items-baseline gap-1 rounded-md bg-red-50 px-2 py-1 tabular-nums text-red-700 dark:bg-red-950/30 dark:text-red-300"
                                    : "inline-flex items-baseline gap-1 rounded-md bg-emerald-50 px-2 py-1 tabular-nums text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                }
                              >
                                {p.current_qty} <span className="text-xs font-normal opacity-70">{p.unit}</span>
                              </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-slate-600 dark:text-slate-400">Rp {p.average_cost.toLocaleString('id-ID')}</TableCell>
                            <TableCell className="text-right font-bold tabular-nums text-slate-900 dark:text-slate-100">
                              <span className="inline-flex rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                                Rp {(p.current_qty * p.average_cost).toLocaleString('id-ID')}
                              </span>
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
      </OperationalTableCard>
    </div>
  );
}
