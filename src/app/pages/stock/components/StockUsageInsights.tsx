import React, { useMemo } from "react";
import { ArrowDownRight, ArrowRightLeft, ArrowUpRight, Boxes, Building2, ChevronDown, Package, UserCircle, Wallet, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/app/components/ui/collapsible";
import { Badge } from "@/app/components/ui/badge";
import type { Branch, User } from "@/app/pages/master-data/data";
import {
  OperationalEmptyState,
  OperationalKpiCard,
  OperationalKpiGrid,
} from "@/app/components/ui/operational-page";

interface StockUsageTransaction {
  id: string;
  product_id: string;
  type: "IN" | "OUT" | "ADJUST";
  quantity: number;
  total_value: number;
  branch_id?: string | null;
  technician_id?: string | null;
  products?: {
    name: string;
    unit: string;
    branch_id?: string | null;
    technician_id?: string | null;
  };
}

interface StockUsageInsightsProps {
  transactions: StockUsageTransaction[];
  branches: Branch[];
  users: User[];
}

interface GroupedUsageRow {
  key: string;
  label: string;
  totalQty: number;
  totalValue: number;
  transactionCount: number;
  productCount: number;
  unit?: string;
}

function formatRupiah(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

function UsageBreakdownCard({
  icon: Icon,
  title,
  description,
  rows,
  emptyDescription,
  primary,
  collapsible = false,
  defaultOpen = true,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  rows: GroupedUsageRow[];
  emptyDescription: string;
  primary: "value" | "qty";
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const primaryMetric = (row: GroupedUsageRow) => (primary === "value" ? row.totalValue : row.totalQty);
  let getMetric = primaryMetric;
  let maxMetric = Math.max(0, ...rows.map(primaryMetric));
  // Saat semua nilai 0 (mis. HPP belum diisi), gunakan jumlah mutasi agar bar tetap informatif.
  if (maxMetric <= 0) {
    getMetric = (row) => row.transactionCount;
    maxMetric = Math.max(1, ...rows.map((row) => row.transactionCount));
  }

  const heading = (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <Icon className="h-4 w-4" />
      </span>
      <CardTitle className="text-sm font-semibold">{title}</CardTitle>
    </div>
  );

  const list =
    rows.length === 0 ? (
      <OperationalEmptyState icon={Icon} title="Belum ada data" description={emptyDescription} className="py-8" />
    ) : (
      <ol className="space-y-2.5">
        {rows.map((row, index) => {
          const share = Math.min(100, Math.max(2, Math.round((getMetric(row) / maxMetric) * 100)));
          return (
            <li
              key={row.key}
              className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 transition-colors hover:border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-slate-700"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700">
                  {index + 1}
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">{row.label}</p>
                <span className="shrink-0 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatRupiah(row.totalValue)}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800">
                <div className="h-full rounded-full bg-blue-500/80 dark:bg-blue-400/80" style={{ width: `${share}%` }} />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  {primary === "qty"
                    ? `${row.totalQty.toLocaleString("id-ID")} ${row.unit || ""}`.trim()
                    : `${row.productCount} bahan`}
                </span>
                <span>{row.transactionCount} mutasi</span>
              </div>
            </li>
          );
        })}
      </ol>
    );

  if (collapsible) {
    return (
      <Card className="self-start rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Collapsible defaultOpen={defaultOpen}>
          <CollapsibleTrigger className="group flex w-full items-start justify-between gap-3 p-4 pb-3 text-left md:p-6 md:pb-3">
            <div className="space-y-1.5">
              {heading}
              <CardDescription className="text-xs">{description}</CardDescription>
            </div>
            <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>{list}</CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }

  return (
    <Card className="self-start rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <CardHeader className="pb-3">
        {heading}
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>{list}</CardContent>
    </Card>
  );
}

export function StockUsageInsights({ transactions, branches, users }: StockUsageInsightsProps) {
  const branchNameMap = useMemo(
    () => new Map(branches.map((branch) => [branch.id, branch.name])),
    [branches],
  );
  const userNameMap = useMemo(
    () => new Map(users.map((user) => [user.id, user.name])),
    [users],
  );

  const resolveBranchId = (transaction: StockUsageTransaction) =>
    transaction.branch_id ?? null;

  const resolveTechnicianId = (transaction: StockUsageTransaction) =>
    transaction.technician_id ?? null;

  const outgoingTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.type === "OUT"),
    [transactions],
  );

  const incomingCount = transactions.filter((transaction) => transaction.type === "IN").length;
  const outgoingCount = outgoingTransactions.length;
  const adjustCount = transactions.filter((transaction) => transaction.type === "ADJUST").length;

  const totalOutgoingValue = outgoingTransactions.reduce(
    (sum, transaction) => sum + Math.abs(Number(transaction.total_value) || 0),
    0,
  );
  const usedProductCount = new Set(outgoingTransactions.map((transaction) => transaction.product_id)).size;

  const usageByProduct = useMemo<GroupedUsageRow[]>(() => {
    const grouped = new Map<string, GroupedUsageRow & { productIds: Set<string> }>();

    for (const transaction of outgoingTransactions) {
      const key = transaction.product_id;
      const current = grouped.get(key) ?? {
        key,
        label: transaction.products?.name || "Produk tanpa nama",
        totalQty: 0,
        totalValue: 0,
        transactionCount: 0,
        productCount: 1,
        unit: transaction.products?.unit || "",
        productIds: new Set<string>(),
      };

      current.totalQty += Math.abs(Number(transaction.quantity) || 0);
      current.totalValue += Math.abs(Number(transaction.total_value) || 0);
      current.transactionCount += 1;
      current.productIds.add(transaction.product_id);
      current.productCount = current.productIds.size;

      grouped.set(key, current);
    }

    return Array.from(grouped.values())
      .map(({ productIds, ...row }) => row)
      .sort((left, right) => right.totalValue - left.totalValue || right.totalQty - left.totalQty);
  }, [outgoingTransactions]);

  const usageByBranch = useMemo<GroupedUsageRow[]>(() => {
    const grouped = new Map<string, GroupedUsageRow & { productIds: Set<string> }>();

    for (const transaction of outgoingTransactions) {
      const branchId = resolveBranchId(transaction);
      const key = branchId || "__unassigned_branch__";
      const current = grouped.get(key) ?? {
        key,
        label: branchId ? branchNameMap.get(branchId) || branchId : "Belum ditentukan",
        totalQty: 0,
        totalValue: 0,
        transactionCount: 0,
        productCount: 0,
        productIds: new Set<string>(),
      };

      current.totalQty += Math.abs(Number(transaction.quantity) || 0);
      current.totalValue += Math.abs(Number(transaction.total_value) || 0);
      current.transactionCount += 1;
      current.productIds.add(transaction.product_id);
      current.productCount = current.productIds.size;

      grouped.set(key, current);
    }

    return Array.from(grouped.values())
      .map(({ productIds, ...row }) => row)
      .sort((left, right) => right.totalValue - left.totalValue || right.transactionCount - left.transactionCount);
  }, [branchNameMap, outgoingTransactions]);

  const usageByTechnician = useMemo<GroupedUsageRow[]>(() => {
    const grouped = new Map<string, GroupedUsageRow & { productIds: Set<string> }>();

    for (const transaction of outgoingTransactions) {
      const technicianId = resolveTechnicianId(transaction);
      const key = technicianId || "__unassigned_technician__";
      const current = grouped.get(key) ?? {
        key,
        label: technicianId ? userNameMap.get(technicianId) || technicianId : "Belum ditentukan",
        totalQty: 0,
        totalValue: 0,
        transactionCount: 0,
        productCount: 0,
        productIds: new Set<string>(),
      };

      current.totalQty += Math.abs(Number(transaction.quantity) || 0);
      current.totalValue += Math.abs(Number(transaction.total_value) || 0);
      current.transactionCount += 1;
      current.productIds.add(transaction.product_id);
      current.productCount = current.productIds.size;

      grouped.set(key, current);
    }

    return Array.from(grouped.values())
      .map(({ productIds, ...row }) => row)
      .sort((left, right) => right.totalValue - left.totalValue || right.transactionCount - left.transactionCount);
  }, [outgoingTransactions, userNameMap]);

  const topProductUsage = usageByProduct.slice(0, 8);
  const topBranchUsage = usageByBranch.slice(0, 6);
  const topTechnicianUsage = usageByTechnician.slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            <Boxes className="h-4 w-4" />
          </span>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Rekap Pemakaian Bahan Baku</h3>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Ringkasan pemakaian mengikuti histori mutasi yang sedang difilter.
        </p>
      </div>

      <OperationalKpiGrid>
        <OperationalKpiCard label="Total Mutasi" value={transactions.length} icon={ArrowRightLeft} tone="default" />
        <OperationalKpiCard label="Transaksi Keluar" value={outgoingCount.toLocaleString("id-ID")} icon={Boxes} tone="rose" />
        <OperationalKpiCard label="Nilai Pemakaian" value={formatRupiah(totalOutgoingValue)} icon={Wallet} tone="emerald" />
        <OperationalKpiCard label="Bahan Terpakai" value={usedProductCount} icon={Package} tone="blue" />
      </OperationalKpiGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <UsageBreakdownCard
          icon={Building2}
          title="Pengeluaran Per Cabang"
          description="Total bahan keluar & nilai HPP per cabang aktif mutasi"
          rows={topBranchUsage}
          emptyDescription="Belum ada transaksi keluar pada filter ini."
          primary="value"
          collapsible
          defaultOpen
        />
        <UsageBreakdownCard
          icon={UserCircle}
          title="Pengeluaran Per Teknisi"
          description="Total bahan keluar yang ditrack ke teknisi"
          rows={topTechnicianUsage}
          emptyDescription="Belum ada transaksi keluar pada filter ini."
          primary="value"
          collapsible
          defaultOpen
        />
        <UsageBreakdownCard
          icon={Boxes}
          title="Bahan Baku Terpakai"
          description="Urutan bahan dengan pemakaian tertinggi dari transaksi keluar"
          rows={topProductUsage}
          emptyDescription="Belum ada transaksi keluar pada filter ini."
          primary="qty"
          collapsible
          defaultOpen
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-400">Komposisi mutasi</span>
        <Badge className="border-green-200 bg-green-100 text-green-700 hover:bg-green-100 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400">
          <ArrowDownRight className="mr-1 h-3 w-3" /> Masuk {incomingCount}
        </Badge>
        <Badge className="border-red-200 bg-red-100 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          <ArrowUpRight className="mr-1 h-3 w-3" /> Keluar {outgoingCount}
        </Badge>
        <Badge className="border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          <ArrowRightLeft className="mr-1 h-3 w-3" /> Opname {adjustCount}
        </Badge>
      </div>
    </div>
  );
}
