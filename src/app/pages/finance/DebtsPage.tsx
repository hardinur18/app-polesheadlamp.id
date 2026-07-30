import React, { useState, useEffect, useMemo } from 'react';
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from '@/app/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { ArrowUpRight, ArrowDownLeft, Plus, Download, RefreshCw, ChevronDown, ChevronUp, CheckCircle, Wallet, AlertCircle, Banknote, User as UserIcon, Calendar, Building2, Edit, Trash2, Search, Filter, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/app/components/ui/utils';
import { useMasterData } from '@/app/pages/master-data/context/MasterDataCtx';
import { usePermissions } from '@/app/hooks/usePermissions';
import { logActivity } from '@/app/services/auditService';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/app/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/app/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/app/components/ui/command";
import { Check } from "lucide-react";

// --- Types ---
interface DailyReport {
  id?: string;
  created_at?: string;
  service_date: string;
  technician_id: string;
  technician_name: string;
  technician_role: string;
  
  revenue_cash: number;
  revenue_transfer: number;
  deposit_amount: number;
  payment_status: 'Unpaid' | 'Paid' | 'Paid_Transfer';
  
  commission_amount: number;
  commission_rate: number;
  transport_cost: number;
  other_cost: number;
  saving_amount: number;
  saving_rate: number;
  notes?: string;
}

interface ManualDebt {
    id: string;
    created_at: string;
    transaction_date: string; // New field
    type: 'payable' | 'receivable';
    amount: number;
    description: string;
    due_date?: string;
    status: 'paid' | 'unpaid';
    identity_name: string;
    identity_id?: string; // New field
    identity_type?: 'user' | 'vendor' | 'other'; // New field
    is_internal: boolean;
}

interface Vendor {
    id: string;
    name: string;
    status: string;
}

// --- Logic: Financial Calculation (Mirror logika Laporan.tsx) ---
const calculateFinancials = (data: DailyReport) => {
  const totalRevenue = (data.revenue_cash || 0) + (data.revenue_transfer || 0);

  // Gunakan stored commission_amount jika ada, fallback ke rate-based
  const commissionAmount = (data.commission_amount !== undefined && data.commission_amount !== null)
    ? data.commission_amount
    : (totalRevenue * (data.commission_rate || 0)) / 100;

  const savingAmount = (data.saving_amount !== undefined && data.saving_amount !== null)
    ? data.saving_amount
    : (commissionAmount * (data.saving_rate || 0)) / 100;

  const grossHakTeknisi = commissionAmount + (data.transport_cost || 0) + (data.other_cost || 0);
  const netHakTeknisi = grossHakTeknisi - savingAmount;

  const cashOnHand = data.revenue_cash || 0;
  const actualSetor = data.deposit_amount || 0;

  // Mirror logika Laporan.tsx — 3 branch berdasarkan payment_status
  const isPaidTransfer = data.payment_status === 'Paid_Transfer';
  const isUnpaid = data.payment_status === 'Unpaid';

  let targetSetor = 0;
  let officeDebt = 0;
  let balance = 0;

  if (isPaidTransfer) {
    // Sudah ditransfer manual → wajib setor full cash, hutang = 0
    targetSetor = cashOnHand;
    balance = targetSetor - actualSetor;
    officeDebt = 0;
    // Jika lebih setor → jadi hutang kantor (over-deposit)
    if (balance < 0) officeDebt += Math.abs(balance);

  } else if (isUnpaid) {
    // Belum dibayar → catat hutang hak teknisi (komisi+transport-tabungan)
    targetSetor = cashOnHand;
    balance = targetSetor - actualSetor;
    officeDebt = netHakTeknisi;
    if (balance < 0) officeDebt += Math.abs(balance);

  } else {
    // Paid (generic) — adaptive: potong cash atau setor penuh
    if (actualSetor < (cashOnHand - 1000)) {
      targetSetor = Math.max(0, cashOnHand - netHakTeknisi);
    } else {
      targetSetor = cashOnHand;
    }
    balance = targetSetor - actualSetor;
    officeDebt = 0; // Sudah dibayar, tidak ada hutang
    if (balance < 0) officeDebt += Math.abs(balance);
  }

  return {
    targetSetor,
    balance,
    officeDebt,
    commissionAmount,
    savingAmount
  };
};

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  }).format(amount);
};

// --- Sub-Component for Grouping ---
const DebtGroupCard = ({ person, type, canManage, onSettle, onEdit, onDelete }: { 
    person: any, 
    type: 'payable' | 'receivable', 
    canManage: boolean,
    onSettle: (item: any, type: any) => void,
    onEdit: (item: any) => void,
    onDelete: (item: any) => void
}) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Card className="border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
            <div 
                className="p-4 md:px-6 md:py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between"
                onClick={() => setIsOpen(!isOpen)}
            >
                 <div className="flex flex-col items-start text-left">
                    <span className="font-bold text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2">
                        {person.name}
                        {person.items.some((i: any) => i.identity_type === 'vendor') && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-amber-50 text-amber-700 border-amber-200">Vendor</Badge>
                        )}
                         {person.items.some((i: any) => i.identity_type === 'user') && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-blue-50 text-blue-700 border-blue-200">Karyawan</Badge>
                        )}
                    </span>
                    <span className="text-xs text-slate-500">
                        {person.items.length} Transaksi {type === 'receivable' ? 'Belum Setor' : 'Belum Dibayar'}
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <div className={cn("font-bold text-lg", type === 'receivable' ? "text-emerald-600" : "text-red-600")}>
                        {formatRupiah(person.total)}
                    </div>
                    {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </div>
            </div>
            
            {isOpen && (
                <div className="border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900/50">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-800">
                            <TableRow>
                                <TableHead className="w-[120px]">Tanggal</TableHead>
                                <TableHead>Keterangan</TableHead>
                                <TableHead className="w-[80px]">Sumber</TableHead>
                                <TableHead className="text-right">Nominal</TableHead>
                                <TableHead className="w-[140px] text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {person.items.map((item: any, idx: number) => (
                                <TableRow key={idx}>
                                    <TableCell className="font-medium text-xs">
                                        {format(new Date(item.date), 'dd MMM yyyy', { locale: id })}
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-500 max-w-[200px] truncate">
                                        {item.description}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={item.source === 'manual' ? 'default' : 'secondary'} className={cn("text-[10px]", item.source === 'manual' ? "bg-slate-800" : "bg-blue-100 text-blue-700 hover:bg-blue-100")}>
                                            {item.source === 'manual' ? 'MANUAL' : 'AUTO'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className={cn("text-right font-bold", type === 'receivable' ? "text-emerald-600" : "text-red-600")}>
                                        {formatRupiah(item.amount)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end items-center gap-1">
                                            {item.source === 'manual' && (
                                                <>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        disabled={!canManage}
                                                        className="h-7 w-7 text-slate-400 hover:text-blue-600"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onEdit(item);
                                                        }}
                                                    >
                                                        <Edit className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        disabled={!canManage}
                                                        className="h-7 w-7 text-slate-400 hover:text-red-600"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDelete(item);
                                                        }}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </>
                                            )}
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className={cn(
                                                    "h-7 text-xs ml-1",
                                                    type === 'receivable' 
                                                        ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                                        : "border-blue-200 text-blue-700 hover:bg-blue-50"
                                                )}
                                                disabled={!canManage}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSettle(item, type);
                                                }}
                                            >
                                                {type === 'receivable' ? 'Selesai' : 'Bayar'}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </Card>
    );
};

export const DebtsPage = () => {
  const { users, currentUser } = useMasterData();
  const { hasPermission } = usePermissions();
  const canViewDebts = hasPermission('debts.view');
  const canManageFinance = hasPermission('finance.manage');
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [manualDebts, setManualDebts] = useState<ManualDebt[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [paidSavingIds, setPaidSavingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isRefresh, setIsRefresh] = useState(false);
  
  // Dialog State for Settlement
  const [settleDialogOpen, setSettleDialogOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<{item: any, type: 'payable' | 'receivable'} | null>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Dialog State for Create Manual
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newDebt, setNewDebt] = useState({
      type: 'receivable',
      amount: '',
      identity_id: '',
      identity_name: '',
      identity_type: 'user', // 'user' | 'vendor' | 'other'
      description: '',
      transaction_date: format(new Date(), 'yyyy-MM-dd'),
      due_date: format(new Date(), 'yyyy-MM-dd')
  });

  // Edit & Delete State
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<ManualDebt | null>(null);
  const [deletingDebt, setDeletingDebt] = useState<ManualDebt | null>(null);

  // Filters - Moved up to avoid ReferenceError
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, user, vendor

  const fetchData = async () => {
    try {
      setLoading(true);
      // 1. Fetch Auto Reports
      const { data: reportData, error: reportError } = await supabase
        .from('technician_daily_reports')
        .select('*')
        .order('service_date', { ascending: false });
      
      if (reportError) throw reportError;
      setReports(reportData || []);

      // 2. Fetch Vendors (Safely)
      try {
          const { data: vendorData, error: vendorError } = await supabase
            .from('vendors')
            .select('*')
            .eq('status', 'active');
          
          if (!vendorError) {
              setVendors(vendorData || []);
          }
      } catch (e) {
          console.log("Vendor table missing or error");
      }

      // 3. Fetch Manual Debts (using KV Store)
      try {
          const { data: manualData, error: manualError } = await supabase
            .from('kv_store_f781cd00')
            .select('*')
            .like('key', 'manual_debt:%');
          
          if (!manualError && manualData) {
              const parsed = manualData.map(d => d.value);
              // Filter status locally since we can't query JSON value directly efficiently here
              const unpaid = parsed.filter((p: any) => p.status === 'unpaid');
              // Sort locally
              unpaid.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              setManualDebts(unpaid);
          }
      } catch (e) {
          console.log("KV store error or table missing", e);
      }

      // 4. Fetch Paid Savings Status (Freelance Tabungan)
      try {
          const { data: paidSavingsData } = await supabase
              .from('kv_store_f781cd00')
              .select('key')
              .like('key', 'saving_paid:%');
          
          const paidSet = new Set(paidSavingsData?.map(d => d.key.replace('saving_paid:', '')) || []);
          setPaidSavingIds(paidSet);
      } catch (e) {
          console.log("Error fetching paid savings", e);
      }

    } catch (err: any) {
      toast.error('Gagal memuat data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canViewDebts) {
        fetchData();
    }
  }, [isRefresh, canViewDebts]);

  const { receivables, payables, totalReceivable, totalPayable } = useMemo(() => {
    const techMapReceivables = new Map<string, { id: string, name: string, items: any[], total: number }>();
    const techMapPayables = new Map<string, { id: string, name: string, items: any[], total: number }>();

    // 1. Process Auto Reports
    reports.forEach(r => {
        const calcs = calculateFinancials(r);
        
        // Auto Receivables
        if (calcs.balance > 0) {
            const key = `auto-${r.technician_id}`;
            const items = techMapReceivables.get(key)?.items || [];
            items.push({ 
                source: 'auto',
                original: r,
                date: r.service_date,
                amount: calcs.balance,
                description: r.notes || `Laporan Harian (Kurang Setor)`,
                identity_type: 'user',
                ...calcs 
            });
            
            techMapReceivables.set(key, {
                id: key,
                name: r.technician_name,
                items,
                total: (techMapReceivables.get(key)?.total || 0) + calcs.balance
            });
        }

        // Auto Payables
        if (calcs.officeDebt > 0 && r.payment_status !== 'Paid') {
            const key = `auto-${r.technician_id}`;
            const items = techMapPayables.get(key)?.items || [];
            items.push({ 
                source: 'auto',
                original: r,
                date: r.service_date,
                amount: calcs.officeDebt, 
                description: `Gaji/Komisi/Bensin`,
                identity_type: 'user',
                ...calcs 
            });
            
            techMapPayables.set(key, {
                id: key,
                name: r.technician_name,
                items,
                total: (techMapPayables.get(key)?.total || 0) + calcs.officeDebt
            });
        }

        // Savings (Tabungan) for Freelance — hanya tampil untuk record Unpaid
        if (r.technician_role === 'Freelance' && r.payment_status === 'Unpaid' && calcs.savingAmount > 0 && r.id && !paidSavingIds.has(r.id)) {
            const key = `auto-${r.technician_id}`;
            const items = techMapPayables.get(key)?.items || [];
            
            items.push({ 
                source: 'auto-saving',
                original: r,
                date: r.service_date,
                amount: calcs.savingAmount, 
                description: `Tabungan/Simpanan (Hold 50%)`,
                identity_type: 'user',
                ...calcs 
            });
            
            techMapPayables.set(key, {
                id: key,
                name: r.technician_name,
                items,
                total: (techMapPayables.get(key)?.total || 0) + calcs.savingAmount
            });
        }
    });

    // 2. Process Manual Debts
    manualDebts.forEach(d => {
        const key = `manual-${d.identity_name}`;
        
        const item = {
             source: 'manual',
             original: d,
             date: d.transaction_date || d.created_at, // Use transaction date if available
             amount: d.amount,
             description: d.description,
             identity_type: d.identity_type
        };

        if (d.type === 'receivable') {
             const items = techMapReceivables.get(key)?.items || [];
             items.push(item);
             techMapReceivables.set(key, {
                 id: key,
                 name: d.identity_name,
                 items,
                 total: (techMapReceivables.get(key)?.total || 0) + d.amount
             });
        } else {
             const items = techMapPayables.get(key)?.items || [];
             items.push(item);
             techMapPayables.set(key, {
                 id: key,
                 name: d.identity_name,
                 items,
                 total: (techMapPayables.get(key)?.total || 0) + d.amount
             });
        }
    });

    let receivablesList = Array.from(techMapReceivables.values()).sort((a,b) => b.total - a.total);
    let payablesList = Array.from(techMapPayables.values()).sort((a,b) => b.total - a.total);

    // Apply Filters
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        receivablesList = receivablesList.filter(p => p.name.toLowerCase().includes(lower));
        payablesList = payablesList.filter(p => p.name.toLowerCase().includes(lower));
    }

    if (filterType !== 'all') {
       receivablesList = receivablesList.filter(p => p.items.some((i:any) => i.identity_type === filterType));
       payablesList = payablesList.filter(p => p.items.some((i:any) => i.identity_type === filterType));
    }

    const totalReceivable = receivablesList.reduce((acc, curr) => acc + curr.total, 0);
    const totalPayable = payablesList.reduce((acc, curr) => acc + curr.total, 0);

    return { receivables: receivablesList, payables: payablesList, totalReceivable, totalPayable };
  }, [reports, manualDebts, searchTerm, filterType, paidSavingIds]);

  const handleSettle = (item: any, type: 'payable' | 'receivable') => {
      if (!canManageFinance) return;

      setSelectedDebt({ item, type });
      setSettleAmount(item.amount);
      setSettleDialogOpen(true);
  };

  const confirmSettle = async () => {
      if (!canManageFinance) return;
      if (!selectedDebt) return;
      setIsProcessing(true);
      try {
          const { item, type } = selectedDebt;
          
          if (item.source === 'auto') {
              // Handle Auto Settlement
              const reportId = item.original.id;
              if (type === 'receivable') {
                  const newDeposit = (item.original.deposit_amount || 0) + settleAmount;
                  const { error } = await supabase.from('technician_daily_reports')
                    .update({ 
                        deposit_amount: newDeposit,
                        deposit_status: 'Verified',
                        notes: item.original.notes ? item.original.notes + `\n[Settled ${formatRupiah(settleAmount)}]` : `[Settled ${formatRupiah(settleAmount)}]`
                    })
                    .eq('id', reportId);
                  if (error) throw error;
              } else {
                  if (settleAmount >= item.amount) {
                      const { error } = await supabase.from('technician_daily_reports').update({ payment_status: 'Paid' }).eq('id', reportId);
                      if (error) throw error;
                  } else {
                      toast.warning("Pembayaran parsial laporan harian belum didukung.");
                      setIsProcessing(false);
                      return;
                  }
              }
          } else if (item.source === 'auto-saving') {
              // Handle Auto Saving Settlement (Freelance Tabungan)
              const reportId = item.original.id;
              
              // We mark this specific saving as paid in KV store
              const { error } = await supabase.from('kv_store_f781cd00').insert({
                  key: `saving_paid:${reportId}`,
                  value: {
                      paid_at: new Date().toISOString(),
                      amount: settleAmount,
                      technician_id: item.original.technician_id
                  }
              });
              
              if (error) throw error;

          } else {
              // Handle Manual Settlement (KV Store)
              const debtId = item.original.id;
              const updatedItem = { ...item.original, status: 'paid' };
              
              const { error } = await supabase.from('kv_store_f781cd00').upsert({
                  key: `manual_debt:${debtId}`,
                  value: updatedItem
              });
              
              if (error) throw error;
          }

          toast.success("Transaksi berhasil diselesaikan.");
          if (currentUser) {
            logActivity(
              { id: currentUser.id, name: currentUser.name, role: currentUser.role },
              'PAYMENT',
              'Hutang & Piutang',
              `Menyelesaikan transaksi: ${item?.identity_name || item?.name || ''}`,
              item?.id || item?.original?.id || ''
            );
          }
          setSettleDialogOpen(false);
          setIsRefresh(prev => !prev);
          
      } catch (err: any) {
          toast.error("Gagal memproses: " + err.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleCreateManual = async () => {
      if (!canManageFinance) return;
      if (!newDebt.amount || !newDebt.identity_name) {
          toast.error("Mohon lengkapi nominal dan nama pihak.");
          return;
      }
      
      setIsProcessing(true);
      try {
          const newId = crypto.randomUUID();
          const payload = {
              id: newId,
              created_at: new Date().toISOString(),
              type: newDebt.type,
              amount: Number(newDebt.amount),
              identity_name: newDebt.identity_name,
              identity_id: newDebt.identity_id || null, // Optional
              identity_type: newDebt.identity_type,
              description: newDebt.description,
              transaction_date: newDebt.transaction_date,
              due_date: newDebt.due_date,
              status: 'unpaid',
              is_internal: newDebt.identity_type === 'user'
          };

          const { error } = await supabase.from('kv_store_f781cd00').upsert({
              key: `manual_debt:${newId}`,
              value: payload
          });
          
          if (error) throw error;
          
          toast.success("Berhasil mencatat transaksi baru.");
          if (currentUser) {
            logActivity(
              { id: currentUser.id, name: currentUser.name, role: currentUser.role },
              'CREATE',
              'Hutang & Piutang',
              `Mencatat ${payload.type === 'receivable' ? 'piutang' : 'hutang'} baru: ${payload.identity_name} - Rp ${Number(payload.amount).toLocaleString('id-ID')}`,
              newId,
              { type: payload.type, amount: payload.amount }
            );
          }
          setCreateDialogOpen(false);
          setNewDebt({ 
            type: 'receivable', 
            amount: '', 
            identity_id: '', 
            identity_name: '', 
            identity_type: 'user',
            description: '', 
            transaction_date: format(new Date(), 'yyyy-MM-dd'),
            due_date: format(new Date(), 'yyyy-MM-dd') 
          });
          setIsRefresh(prev => !prev);
      } catch (err: any) {
          toast.error("Gagal menyimpan (Pastikan kolom baru sudah ditambahkan): " + err.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleEdit = (item: any) => {
      if (!canManageFinance) return;
      setEditingDebt(item.original);
      setNewDebt({
          type: item.original.type,
          amount: item.amount.toString(),
          identity_id: item.original.identity_id || '',
          identity_name: item.original.identity_name,
          identity_type: item.original.identity_type || 'user',
          description: item.description,
          transaction_date: item.original.transaction_date || format(new Date(item.original.created_at), 'yyyy-MM-dd'),
          due_date: item.original.due_date || ''
      });
      setEditDialogOpen(true);
  };

  const confirmEdit = async () => {
      if (!canManageFinance) return;
      if (!editingDebt) return;
      setIsProcessing(true);
      try {
          const payload = {
              ...editingDebt, // Keep original fields like id, created_at
              type: newDebt.type,
              amount: Number(newDebt.amount),
              identity_name: newDebt.identity_name,
              identity_id: newDebt.identity_id || null,
              identity_type: newDebt.identity_type,
              description: newDebt.description,
              transaction_date: newDebt.transaction_date,
              due_date: newDebt.due_date,
              is_internal: newDebt.identity_type === 'user'
          };

          const { error } = await supabase.from('kv_store_f781cd00').upsert({
              key: `manual_debt:${editingDebt.id}`,
              value: payload
          });

          if (error) throw error;

          toast.success("Data berhasil diperbarui");
          if (currentUser) {
            logActivity(
              { id: currentUser.id, name: currentUser.name, role: currentUser.role },
              'UPDATE',
              'Hutang & Piutang',
              `Memperbarui data ${newDebt.type === 'receivable' ? 'piutang' : 'hutang'}: ${newDebt.identity_name}`,
              editingDebt.id
            );
          }
          setEditDialogOpen(false);
          setIsRefresh(prev => !prev);
      } catch (e: any) {
          toast.error("Gagal update: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleDelete = (item: any) => {
      if (!canManageFinance) return;
      setDeletingDebt(item.original);
      setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
      if (!canManageFinance) return;
      if (!deletingDebt) return;
      setIsProcessing(true);
      try {
          const { error } = await supabase.from('kv_store_f781cd00').delete().eq('key', `manual_debt:${deletingDebt.id}`);
          if (error) throw error;
          
          toast.success("Data berhasil dihapus");
          if (currentUser) {
            logActivity(
              { id: currentUser.id, name: currentUser.name, role: currentUser.role },
              'DELETE',
              'Hutang & Piutang',
              `Menghapus data ${deletingDebt.type === 'receivable' ? 'piutang' : 'hutang'}: ${deletingDebt.identity_name}`,
              deletingDebt.id
            );
          }
          setDeleteDialogOpen(false);
          setIsRefresh(prev => !prev);
      } catch (e: any) {
          toast.error("Gagal hapus: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  // Combine Users and Vendors for Combobox
  const combinedIdentities = useMemo(() => {
      const userOpts = users.map(u => ({ 
          id: u.id, 
          name: u.name, 
          type: 'user', 
          label: `${u.name} (Karyawan)` 
      }));
      const vendorOpts = vendors.map(v => ({ 
          id: v.id, 
          name: v.name, 
          type: 'vendor', 
          label: `${v.name} (Vendor)` 
      }));
      return [...userOpts, ...vendorOpts];
  }, [users, vendors]);

  const [comboOpen, setComboOpen] = useState(false);

  if (!canViewDebts) {
    return (
      <div className="flex h-[80vh] items-center justify-center flex-col gap-4 text-center p-8">
        <div className="bg-red-50 p-4 rounded-full text-red-600"><Lock className="w-12 h-12" /></div>
        <h1 className="text-2xl font-bold">Akses Dibatasi</h1>
        <p className="text-slate-500">Anda tidak memiliki izin untuk membuka halaman hutang dan piutang.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 w-full max-w-[1600px] mx-auto min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-20">
        <div className="flex flex-col space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                        <Wallet className="w-6 h-6 text-blue-600" />
                        Hutang & Piutang (Hybrid)
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Monitoring kewajiban dari Laporan Harian + Input Manual.</p>
                    {!canManageFinance && (
                        <p className="text-xs text-amber-600 mt-2">Mode lihat saja. Settlement dan perubahan data manual dinonaktifkan.</p>
                    )}
                </div>
                <div className="flex gap-2">
                     <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => setCreateDialogOpen(true)} disabled={!canManageFinance}>
                        <Plus className="w-4 h-4 mr-2" /> Catat Manual
                    </Button>
                    <Button variant="outline" className="bg-white dark:bg-slate-800" onClick={() => setIsRefresh(!isRefresh)}>
                        <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} /> Refresh
                    </Button>
                </div>
            </div>

            {/* Filter Section */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input 
                        placeholder="Cari nama karyawan atau vendor..." 
                        className="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-full sm:w-[200px]">
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-slate-500" />
                                <SelectValue placeholder="Tipe Pihak" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Tipe</SelectItem>
                            <SelectItem value="user">Karyawan Internal</SelectItem>
                            <SelectItem value="vendor">Vendor / Partner</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                            <span className="p-1 bg-red-100 text-red-600 rounded">
                                <ArrowDownLeft className="w-4 h-4" />
                            </span>
                            Total Hutang (Payable)
                        </CardDescription>
                        <CardTitle className="text-3xl text-slate-900 dark:text-slate-100">{formatRupiah(totalPayable)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-slate-500">Kewajiban pembayaran ke teknisi & vendor.</p>
                    </CardContent>
                </Card>
                <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                            <span className="p-1 bg-emerald-100 text-emerald-600 rounded">
                                <ArrowUpRight className="w-4 h-4" />
                            </span>
                            Total Piutang (Receivable)
                        </CardDescription>
                        <CardTitle className="text-3xl text-slate-900 dark:text-slate-100">{formatRupiah(totalReceivable)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-slate-500">Kurang setor teknisi & pinjaman karyawan.</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="receivable" className="w-full">
                <TabsList className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 w-full md:w-auto h-auto grid grid-cols-2 md:inline-flex">
                    <TabsTrigger value="receivable" className="data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-900/20 dark:data-[state=active]:text-emerald-400 py-2">
                        Piutang (Masuk)
                        <Badge variant="secondary" className="ml-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{receivables.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="payable" className="data-[state=active]:bg-red-50 data-[state=active]:text-red-700 dark:data-[state=active]:bg-red-900/20 dark:data-[state=active]:text-red-400 py-2">
                        Hutang (Keluar)
                        <Badge variant="secondary" className="ml-2 bg-red-100 text-red-700 hover:bg-red-100">{payables.length}</Badge>
                    </TabsTrigger>
                </TabsList>
                
                <TabsContent value="receivable" className="mt-4 space-y-4">
                    {receivables.length === 0 ? (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500 flex flex-col items-center">
                            <CheckCircle className="w-12 h-12 text-emerald-200 mb-4" />
                            <h3 className="text-lg font-semibold text-slate-700">Tidak Ada Piutang</h3>
                            <p>Semua teknisi sudah menyetor & tidak ada pinjaman.</p>
                        </div>
                    ) : (
                        receivables.map(person => (
                            <DebtGroupCard key={person.id} person={person} type="receivable" canManage={canManageFinance} onSettle={handleSettle} onEdit={handleEdit} onDelete={handleDelete} />
                        ))
                    )}
                </TabsContent>
                
                <TabsContent value="payable" className="mt-4 space-y-4">
                    {payables.length === 0 ? (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500 flex flex-col items-center">
                            <CheckCircle className="w-12 h-12 text-emerald-200 mb-4" />
                            <h3 className="text-lg font-semibold text-slate-700">Tidak Ada Hutang</h3>
                            <p>Semua kewajiban pembayaran sudah lunas.</p>
                        </div>
                    ) : (
                        payables.map(person => (
                             <DebtGroupCard key={person.id} person={person} type="payable" canManage={canManageFinance} onSettle={handleSettle} onEdit={handleEdit} onDelete={handleDelete} />
                        ))
                    )}
                </TabsContent>
            </Tabs>
        </div>

        {/* SETTLEMENT DIALOG */}
        <Dialog open={settleDialogOpen} onOpenChange={setSettleDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Konfirmasi Penyelesaian</DialogTitle>
                    <DialogDescription>
                         Tandai transaksi ini sebagai selesai/lunas.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Nominal {selectedDebt?.type === 'receivable' ? 'Diterima' : 'Dibayar'}</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-500">Rp</span>
                            <Input 
                                type="number" 
                                className="pl-10" 
                                value={settleAmount} 
                                onChange={(e) => setSettleAmount(Number(e.target.value))}
                                disabled={selectedDebt?.type === 'payable'} 
                            />
                        </div>
                        {selectedDebt?.item.source === 'auto' && selectedDebt.type === 'payable' && (
                            <p className="text-[10px] text-red-500">Untuk Gaji Otomatis, wajib bayar Full untuk menandai Lunas.</p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setSettleDialogOpen(false)}>Batal</Button>
                    <Button onClick={confirmSettle} disabled={isProcessing || !canManageFinance} className="bg-blue-600 text-white">
                        {isProcessing ? "Menyimpan..." : "Simpan"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

         {/* CREATE MANUAL DIALOG */}
         <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Catat Hutang/Piutang Manual</DialogTitle>
                    <DialogDescription>
                        Catat pinjaman karyawan, kasbon, atau hutang vendor di luar operasional harian.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Jenis Transaksi</Label>
                            <Select value={newDebt.type} onValueChange={(val: any) => setNewDebt({...newDebt, type: val})}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Jenis" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="receivable">Piutang (Uang Masuk)</SelectItem>
                                    <SelectItem value="payable">Hutang (Uang Keluar)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <Label>Tanggal Transaksi</Label>
                            <Input 
                                type="date" 
                                value={newDebt.transaction_date}
                                onChange={(e) => setNewDebt({...newDebt, transaction_date: e.target.value})}
                            />
                        </div>
                    </div>

                     <div className="space-y-2">
                        <Label>Pihak (Karyawan/Vendor)</Label>
                        <Popover open={comboOpen} onOpenChange={setComboOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={comboOpen}
                                className="w-full justify-between font-normal text-slate-900"
                                >
                                {newDebt.identity_name
                                    ? newDebt.identity_name
                                    : "Pilih Karyawan atau Vendor..."}
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0">
                                <Command>
                                    <CommandInput placeholder="Cari karyawan atau vendor..." />
                                    <CommandList>
                                        <CommandEmpty>
                                            <div className="p-4 text-center">
                                                <p className="text-sm text-slate-500 mb-2">Tidak ditemukan.</p>
                                                <Button 
                                                    size="sm" 
                                                    variant="secondary" 
                                                    className="w-full"
                                                    onClick={() => {
                                                        const searchInput = document.querySelector('[cmdk-input]') as HTMLInputElement;
                                                        const val = searchInput?.value || "Vendor Baru";
                                                        setNewDebt({
                                                            ...newDebt, 
                                                            identity_name: val,
                                                            identity_id: '',
                                                            identity_type: 'other'
                                                        });
                                                        setComboOpen(false);
                                                    }}
                                                >
                                                    Gunakan input pencarian sebagai nama baru
                                                </Button>
                                            </div>
                                        </CommandEmpty>
                                        <CommandGroup heading="Karyawan">
                                            {combinedIdentities.filter(i => i.type === 'user').map((identity) => (
                                            <CommandItem
                                                key={identity.id}
                                                value={identity.label}
                                                onSelect={() => {
                                                    setNewDebt({
                                                        ...newDebt,
                                                        identity_name: identity.name,
                                                        identity_id: identity.id,
                                                        identity_type: 'user'
                                                    });
                                                    setComboOpen(false);
                                                }}
                                            >
                                                <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    newDebt.identity_id === identity.id ? "opacity-100" : "opacity-0"
                                                )}
                                                />
                                                <div className="flex flex-1 items-center justify-between">
                                                    <div className="flex items-center">
                                                        <UserIcon className="w-3 h-3 mr-2 text-slate-400" />
                                                        {identity.name}
                                                    </div>
                                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-blue-50 text-blue-700 border-blue-200">Karyawan</Badge>
                                                </div>
                                            </CommandItem>
                                            ))}
                                        </CommandGroup>
                                        <CommandGroup heading="Vendor / Partner">
                                            {combinedIdentities.filter(i => i.type === 'vendor').map((identity) => (
                                            <CommandItem
                                                key={identity.id}
                                                value={identity.label}
                                                onSelect={() => {
                                                    setNewDebt({
                                                        ...newDebt,
                                                        identity_name: identity.name,
                                                        identity_id: identity.id,
                                                        identity_type: 'vendor'
                                                    });
                                                    setComboOpen(false);
                                                }}
                                            >
                                                <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    newDebt.identity_id === identity.id ? "opacity-100" : "opacity-0"
                                                )}
                                                />
                                                <div className="flex flex-1 items-center justify-between">
                                                    <div className="flex items-center">
                                                        <Building2 className="w-3 h-3 mr-2 text-slate-400" />
                                                        {identity.name}
                                                    </div>
                                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-amber-50 text-amber-700 border-amber-200">Vendor</Badge>
                                                </div>
                                            </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <Label>Nominal</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-500">Rp</span>
                            <Input 
                                type="number" 
                                className="pl-10" 
                                placeholder="0"
                                value={newDebt.amount} 
                                onChange={(e) => setNewDebt({...newDebt, amount: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2">
                            <Label>Keterangan</Label>
                            <Input 
                                placeholder="Cth: Kasbon sakit, Pembelian Kabel..." 
                                value={newDebt.description}
                                onChange={(e) => setNewDebt({...newDebt, description: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                             <Label>Jatuh Tempo</Label>
                            <Input 
                                type="date" 
                                value={newDebt.due_date}
                                onChange={(e) => setNewDebt({...newDebt, due_date: e.target.value})}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Batal</Button>
                    <Button onClick={handleCreateManual} disabled={isProcessing || !canManageFinance} className="bg-blue-600 text-white">
                        {isProcessing ? "Menyimpan..." : "Simpan Transaksi"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* EDIT DIALOG */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Edit Transaksi Manual</DialogTitle>
                    <DialogDescription>
                        Ubah detail hutang/piutang.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Jenis Transaksi</Label>
                            <Select value={newDebt.type} onValueChange={(val: any) => setNewDebt({...newDebt, type: val})}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Jenis" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="receivable">Piutang (Uang Masuk)</SelectItem>
                                    <SelectItem value="payable">Hutang (Uang Keluar)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <Label>Tanggal Transaksi</Label>
                            <Input 
                                type="date" 
                                value={newDebt.transaction_date}
                                onChange={(e) => setNewDebt({...newDebt, transaction_date: e.target.value})}
                            />
                        </div>
                    </div>

                     <div className="space-y-2">
                        <Label>Pihak (Karyawan/Vendor)</Label>
                        <Input value={newDebt.identity_name} disabled className="bg-slate-100" />
                        <p className="text-[10px] text-slate-500">Nama pihak tidak dapat diubah saat edit.</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Nominal</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-500">Rp</span>
                            <Input 
                                type="number" 
                                className="pl-10" 
                                placeholder="0"
                                value={newDebt.amount} 
                                onChange={(e) => setNewDebt({...newDebt, amount: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2">
                            <Label>Keterangan</Label>
                            <Input 
                                placeholder="Cth: Kasbon sakit, Pembelian Kabel..." 
                                value={newDebt.description}
                                onChange={(e) => setNewDebt({...newDebt, description: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                             <Label>Jatuh Tempo</Label>
                            <Input 
                                type="date" 
                                value={newDebt.due_date}
                                onChange={(e) => setNewDebt({...newDebt, due_date: e.target.value})}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Batal</Button>
                    <Button onClick={confirmEdit} disabled={isProcessing || !canManageFinance} className="bg-blue-600 text-white">
                        {isProcessing ? "Menyimpan..." : "Simpan Perubahan"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* DELETE CONFIRMATION */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Hapus Transaksi?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Data hutang/piutang ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white" disabled={isProcessing || !canManageFinance}>
                        {isProcessing ? "Menghapus..." : "Hapus"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
};
