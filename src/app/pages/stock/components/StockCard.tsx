import React, { useEffect, useMemo, useState } from 'react';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { Button } from "@/app/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Loader2, RefreshCcw, Package } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useMasterData } from "@/app/pages/master-data/context";
import { STOCK_UPDATED_EVENT, sortStockTransactions } from "../utils/stockLedger";
import { createDataTableColumns, DataTable, TableText } from "@/app/components/ui/data-table";
import { MasterDataTableTitle } from "@/app/components/ui/master-data-table-title";
import { MasterDataFormDialogContent } from "@/app/components/ui/master-data-ui";
import { InventoryTablePagination, useInventoryTablePagination } from "./InventoryTablePagination";

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

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'IN':
        return 'Masuk';
      case 'OUT':
        return 'Keluar';
      case 'ADJUST':
        return 'Opname';
      default:
        return type;
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
  const stockCardPagination = useInventoryTablePagination(transactionsWithBalance, [product?.id]);

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <MasterDataFormDialogContent size="wide" className="inventoryStockCardDialog">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="tableTitleIcon">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>
                  Kartu Stok
                </DialogTitle>
                <DialogDescription>
                  {product.name}
                  {product.sku && (
                    <span className="ml-2 font-mono text-xs text-slate-400">({product.sku})</span>
                  )}
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="inventoryIconButton shrink-0"
              onClick={fetchTransactions}
              title="Refresh"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </DialogHeader>

        {/* Summary strip */}
        <div className="inventoryStockSummaryGrid">
          <div className="inventoryStockSummaryItem">
            <p>Stok Saat Ini</p>
            <strong>
              {product.current_qty}{' '}
              <span>{product.unit}</span>
            </strong>
          </div>
          <div className="inventoryStockSummaryItem">
            <p>Total Masuk</p>
            <strong className="isPositive">+{totalIn} <span>{product.unit}</span></strong>
          </div>
          <div className="inventoryStockSummaryItem">
            <p>Total Keluar</p>
            <strong className="isNegative">-{totalOut} <span>{product.unit}</span></strong>
          </div>
          <div className="inventoryStockSummaryItem">
            <p>HPP Rata-rata</p>
            <strong>
              Rp {product.average_cost.toLocaleString('id-ID')}
            </strong>
          </div>
        </div>

        {/* Table */}
        <div className="inventoryStockCardBody">
          <MasterDataTableTitle title="Riwayat Kartu Stok" count={transactions.length} variant="active" icon={Package} className="inventoryStockCardTitle" />
          <DataTable
            columns={createDataTableColumns([
              'number',
              'date',
              'status',
              'text',
              'text',
              'quantity',
              'money',
              'quantity',
              'description',
            ])}
            rowMinHeight={62}
            cellY={11}
            textMax={220}
          >
          <table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Cabang</TableHead>
                <TableHead>Teknisi</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Harga Satuan</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Catatan</TableHead>
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
                stockCardPagination.paginatedItems.map((trx, index) => {
                  return (
                    <TableRow
                      key={trx.id}
                      className="border-slate-100 hover:bg-blue-50/40 dark:border-slate-800 dark:hover:bg-slate-800/60"
                    >
                      <TableCell className="font-semibold tabular-nums text-slate-400">
                        {stockCardPagination.startIndex + index + 1}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                        <span className="inventoryStockCardDate">
                          {trx.date
                            ? format(new Date(trx.date), 'dd MMM yyyy', { locale: idLocale })
                            : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inventoryStockTypeText is${trx.type}`}>{getTypeLabel(trx.type)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="inventoryPlainCellText">{getBranchName(trx.branch_id)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="inventoryPlainCellText">{getUserName(trx.technician_id)}</span>
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums">
                        <span className={`inventoryStockQtyText is${trx.type}${trx.type === 'ADJUST' && trx.quantity < 0 ? ' isNegative' : ''}`}>
                          {trx.type === 'OUT' ? '-' : trx.type === 'IN' ? '+' : trx.quantity >= 0 ? '+' : ''}
                          {trx.quantity}
                        </span>{' '}
                        <span className="text-xs font-normal text-slate-400">{product.unit}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-slate-500">
                        {trx.unit_price ? `Rp ${trx.unit_price.toLocaleString('id-ID')}` : '-'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-slate-700">
                        <span className={trx.balance <= 0 ? "inventoryStockBalanceText isLow" : "inventoryStockBalanceText"}>
                          {trx.balance}{' '}
                          <span className="text-xs font-normal opacity-70">{product.unit}</span>
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[150px] text-xs text-slate-500" title={trx.notes}>
                        <TableText primary={trx.notes || '-'} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </table>
          </DataTable>
          <InventoryTablePagination {...stockCardPagination} />
        </div>

        <div className="inventoryStockCardFooter">
          {transactions.length} transaksi tercatat
          {totalAdj !== 0 && (
            <span className="ml-2 text-yellow-600">
              (Adjustment: {totalAdj > 0 ? '+' : ''}{totalAdj} {product.unit})
            </span>
          )}
        </div>
      </MasterDataFormDialogContent>
    </Dialog>
  );
}
