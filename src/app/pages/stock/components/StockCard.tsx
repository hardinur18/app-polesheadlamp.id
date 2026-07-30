import React, { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/app/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Loader2, ArrowDownRight, ArrowUpRight, ArrowRightLeft, RefreshCcw, Package, AlertTriangle, Info, Building2, UserCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/app/components/ui/alert";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useMasterData } from "@/app/pages/master-data/context";
import { STOCK_UPDATED_EVENT, sortStockTransactions } from "../utils/stockLedger";

interface StockCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id: string;
    name: string;
    sku?: string;
    unit: string;
    current_qty: number;
    average_cost: number;
    recorded_qty?: number;
    recorded_average_cost?: number;
    stock_needs_review?: boolean;
    stock_has_transactions?: boolean;
  } | null;
}

interface Transaction {
  id: string;
  type: 'IN' | 'OUT' | 'ADJUST';
  quantity: number;
  unit_price: number;
  total_value: number;
  notes: string;
  date: string;
  created_at: string;
  branch_id?: string | null;
  technician_id?: string | null;
}

export function StockCard({ open, onOpenChange, product }: StockCardProps) {
  const { branches, users } = useMasterData();
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const branchNameMap = useMemo(
    () => new Map(branches.map((branch) => [branch.id, branch.name])),
    [branches]
  );
  const userNameMap = useMemo(
    () => new Map(users.map((user) => [user.id, user.name])),
    [users]
  );

  useEffect(() => {
    if (open && product) {
      fetchTransactions();
    }
  }, [open, product]);

  useEffect(() => {
    const handleStockUpdate = () => {
      if (open && product) {
        fetchTransactions();
      }
    };

    window.addEventListener(STOCK_UPDATED_EVENT, handleStockUpdate);
    return () => window.removeEventListener(STOCK_UPDATED_EVENT, handleStockUpdate);
  }, [open, product]);

  const fetchTransactions = async () => {
    if (!product) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('stock_transactions')
        .select('*')
        .eq('product_id', product.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching stock card:', error);
      toast.error('Gagal memuat kartu stok');
    } finally {
      setLoading(false);
    }
  };

  const getBranchName = (branchId?: string | null) => {
    if (!branchId) return '-';
    return branchNameMap.get(branchId) || branchId;
  };

  const getUserName = (userId?: string | null) => {
    if (!userId) return '-';
    return userNameMap.get(userId) || userId;
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'IN':
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200">
            <ArrowDownRight className="w-3 h-3 mr-1" /> Masuk
          </Badge>
        );
      case 'OUT':
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200">
            <ArrowUpRight className="w-3 h-3 mr-1" /> Keluar
          </Badge>
        );
      case 'ADJUST':
        return (
          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200">
            <ArrowRightLeft className="w-3 h-3 mr-1" /> Opname
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  // Compute running balance from oldest to newest, then reverse for display
  const transactionsWithBalance = (() => {
    const sorted = [...transactions].sort(sortStockTransactions);

    let running = 0;
    const withBal = sorted.map(t => {
      if (t.type === 'IN') running += t.quantity;
      else if (t.type === 'OUT') running -= t.quantity;
      else running += t.quantity; // ADJUST (can be negative)
      return { ...t, balance: running };
    });

    return withBal.reverse(); // newest first for display
  })();

  const totalIn = transactions.filter(t => t.type === 'IN').reduce((s, t) => s + t.quantity, 0);
  const totalOut = transactions.filter(t => t.type === 'OUT').reduce((s, t) => s + t.quantity, 0);
  const totalAdj = transactions.filter(t => t.type === 'ADJUST').reduce((s, t) => s + t.quantity, 0);

  if (!product) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[700px] sm:max-w-[700px] z-[150] flex flex-col h-full p-0 gap-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800"
      >
        <SheetHeader className="border-b border-slate-100 bg-slate-50/80 p-6 pb-4 text-left dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <SheetTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Kartu Stok
                </SheetTitle>
                <SheetDescription className="text-slate-500 text-sm">
                  {product.name}
                  {product.sku && (
                    <span className="ml-2 font-mono text-xs text-slate-400">({product.sku})</span>
                  )}
                </SheetDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
              onClick={fetchTransactions}
              title="Refresh"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </SheetHeader>

        {product.stock_needs_review && typeof product.recorded_qty === 'number' && (
          <div className="px-6 pt-4">
            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Stok kartu memakai histori transaksi</AlertTitle>
              <AlertDescription>
                Data tabel lama menunjukkan {product.recorded_qty} {product.unit},
                sementara histori mutasi menunjukkan {product.current_qty} {product.unit}.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {!product.stock_has_transactions && product.current_qty > 0 && (
          <div className="px-6 pt-4">
            <Alert className="border-blue-200 bg-blue-50 text-blue-900">
              <Info className="h-4 w-4" />
              <AlertTitle>Belum ada histori mutasi</AlertTitle>
              <AlertDescription>
                Produk ini masih memakai stok awal dari data produk. Riwayat kartu stok akan terisi setelah ada transaksi masuk, keluar, atau adjustment.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Summary strip */}
        <div className="grid grid-cols-2 border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-4">
          <div className="border-r border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:border-b-0">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Stok Saat Ini</p>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-0.5">
              {product.current_qty}{' '}
              <span className="text-sm font-normal text-slate-500">{product.unit}</span>
            </p>
          </div>
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:border-r sm:border-b-0">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total Masuk</p>
            <p className="text-xl font-bold text-green-600 mt-0.5">
              +{totalIn} <span className="text-sm font-normal text-slate-500">{product.unit}</span>
            </p>
          </div>
          <div className="border-r border-slate-100 px-5 py-4 dark:border-slate-800">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total Keluar</p>
            <p className="text-xl font-bold text-red-500 mt-0.5">
              -{totalOut} <span className="text-sm font-normal text-slate-500">{product.unit}</span>
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">HPP Rata-rata</p>
            <p className="text-xl font-bold text-slate-700 dark:text-slate-200 mt-0.5">
              Rp {product.average_cost.toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <Table className="min-w-[940px]">
            <TableHeader className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900">
              <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                <TableHead className="h-11 w-[56px] text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">No</TableHead>
                <TableHead className="h-11 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tanggal</TableHead>
                <TableHead className="h-11 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tipe</TableHead>
                <TableHead className="h-11 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cabang</TableHead>
                <TableHead className="h-11 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Teknisi</TableHead>
                <TableHead className="h-11 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Qty</TableHead>
                <TableHead className="h-11 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Harga Satuan</TableHead>
                <TableHead className="h-11 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Saldo</TableHead>
                <TableHead className="h-11 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-40 text-center border-0">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
                  </TableCell>
                </TableRow>
              ) : transactionsWithBalance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-40 text-center text-sm text-slate-400 border-0">
                    Belum ada transaksi untuk produk ini.
                  </TableCell>
                </TableRow>
              ) : (
                transactionsWithBalance.map((trx, index) => {
                  return (
                    <TableRow
                      key={trx.id}
                      className={
                        trx.type === 'OUT'
                          ? "border-slate-100 bg-red-50/20 hover:bg-red-50/40 dark:border-slate-800 dark:bg-red-950/10 dark:hover:bg-red-950/20"
                          : trx.type === 'ADJUST'
                          ? "border-slate-100 bg-amber-50/20 hover:bg-amber-50/40 dark:border-slate-800 dark:bg-amber-950/10 dark:hover:bg-amber-950/20"
                          : "border-slate-100 bg-emerald-50/20 hover:bg-emerald-50/40 dark:border-slate-800 dark:bg-emerald-950/10 dark:hover:bg-emerald-950/20"
                      }
                    >
                      <TableCell className="w-[56px] text-xs font-semibold text-slate-400">
                        <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border border-slate-200 bg-white px-2 tabular-nums text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                          {index + 1}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          <span
                            className={
                              trx.type === 'OUT'
                                ? "h-1.5 w-1.5 rounded-full bg-red-500"
                                : trx.type === 'ADJUST'
                                ? "h-1.5 w-1.5 rounded-full bg-amber-500"
                                : "h-1.5 w-1.5 rounded-full bg-emerald-500"
                            }
                          />
                          {trx.date
                            ? format(new Date(trx.date), 'dd MMM yyyy', { locale: idLocale })
                            : '-'}
                        </span>
                      </TableCell>
                      <TableCell>{getTypeBadge(trx.type)}</TableCell>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-cyan-50 px-2 py-1 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300">
                          <Building2 className="h-3 w-3" />
                          {getBranchName(trx.branch_id)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2 py-1 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300">
                          <UserCircle className="h-3 w-3" />
                          {getUserName(trx.technician_id)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums">
                        <span
                          className={
                            trx.type === 'OUT'
                              ? 'inline-flex rounded-md bg-red-50 px-2 py-1 text-red-700 dark:bg-red-950/30 dark:text-red-300'
                              : trx.type === 'ADJUST' && trx.quantity < 0
                              ? 'inline-flex rounded-md bg-red-50 px-2 py-1 text-red-700 dark:bg-red-950/30 dark:text-red-300'
                              : trx.type === 'ADJUST'
                              ? 'inline-flex rounded-md bg-amber-50 px-2 py-1 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                              : 'inline-flex rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                          }
                        >
                          {trx.type === 'OUT' ? '-' : trx.type === 'IN' ? '+' : trx.quantity >= 0 ? '+' : ''}
                          {trx.quantity}
                        </span>{' '}
                        <span className="text-xs font-normal text-slate-400">{product.unit}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-slate-500">
                        {trx.unit_price ? `Rp ${trx.unit_price.toLocaleString('id-ID')}` : '-'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-slate-700">
                        <span
                          className={
                            trx.balance <= 0
                              ? "inline-flex items-baseline gap-1 rounded-md bg-red-50 px-2 py-1 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                              : "inline-flex items-baseline gap-1 rounded-md bg-blue-50 px-2 py-1 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                          }
                        >
                          {trx.balance}{' '}
                          <span className="text-xs font-normal opacity-70">{product.unit}</span>
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[150px] text-xs text-slate-500" title={trx.notes}>
                        <span className="inline-block max-w-full truncate rounded-md bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {trx.notes || '-'}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 text-center">
          {transactions.length} transaksi tercatat
          {totalAdj !== 0 && (
            <span className="ml-2 text-yellow-600">
              (Adjustment: {totalAdj > 0 ? '+' : ''}{totalAdj} {product.unit})
            </span>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
