import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AlertCircle,
  Plus, Edit, Trash2, CheckCircle2, XCircle,
  Clock, RefreshCw, Building2, Loader2, Wallet, Eye, ReceiptText, Upload, ExternalLink
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { DataTable, TableActionCell, TableActionHeader, TableActionMenu, TableActionMenuItem, TableStatusCell, TableStatusIcon } from '../../../components/ui/data-table';
import { MasterDataTableTitle } from '../../../components/ui/master-data-table-title';
import { NoticeStack } from '../../../components/ui/notice-stack';
import {
  TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../../../components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "../../../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog"
import { Badge } from '../../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Role } from '../data';
import { toast } from 'sonner';
import { usePermissions } from '@/app/hooks/usePermissions';
import { supabase } from '@/lib/supabaseClient';
import { uploadProofAssetImage } from '@/app/services/proofAssets';
import { buildMakeServerUrl } from '@/app/services/internal/functionsBaseUrl';
import { getSessionBackedEdgeHeaders } from '@/app/services/internal/sessionClientHeaders';
import { cn } from '../../../components/ui/utils';
import { ControlPanel, ControlRow, SearchBox } from '../../../components/ui/control-panel';
import { useMasterData } from '../context';
import { useIsMobile } from '@/app/components/ui/use-mobile';
import { logActivity } from '@/app/services/auditService';
import { DEFAULT_OPERATIONAL_EXPENSE_ONLY_ACCOUNTS } from '@/app/data/operationalExpenseAccounts';
import {
  OperationalEmptyState,
  OperationalKpiCard,
  OperationalKpiGrid,
  OperationalPageHeader,
  OperationalTableCard,
} from '../../../components/ui/operational-page';
import {
  MasterDataFormActions,
  MasterDataFormDialogContent,
  MasterDataUnsavedChangesDialog,
  useMasterDataFormCloseGuard,
} from '../../../components/ui/master-data-ui';

interface RecurringExpense {
  id: string;
  name: string;
  category: string;
  amount: number;
  cycle: 'monthly' | 'yearly' | 'one_time';
  due_date: number; // Day of month (1-31)
  branch_id?: string;
  description?: string;
  status: 'active' | 'inactive';
  last_payment_date?: string | null; // Track last payment
  whatsapp?: string;
  account_number?: string;
  account_name?: string;
  bank_name?: string;
  created_at?: string;
}

interface RecurringExpensePayment {
  id: string;
  recurring_expense_id: string;
  period_key: string;
  due_date?: string | null;
  paid_at: string;
  amount: number;
  payment_source?: string;
  operational_category?: string;
  operational_subcategory?: string;
  vendor_name?: string;
  notes?: string;
  proof_url?: string;
  operational_expense_id?: string | null;
  status: 'paid' | 'void';
  paid_by?: string | null;
  paid_by_name?: string;
  created_at?: string;
}

type ExpenseTab = 'schedule' | 'unpaid' | 'paid';

interface PaymentFormState {
  paid_at: string;
  amount: string;
  payment_source: string;
  operational_category: string;
  operational_subcategory: string;
  notes: string;
  proof_url: string;
}

interface RecurringExpensesTabProps {
  currentRole: Role;
}

const todayDateInput = () => new Date().toISOString().slice(0, 10);
const RECURRING_EXPENSE_PAYMENTS_URL = buildMakeServerUrl('/finance/recurring-expense-payments');
const RECURRING_EXPENSE_PAY_URL = buildMakeServerUrl('/finance/recurring-expenses/pay');

const getPeriodKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatDateLabel = (value?: string | null) => {
  if (!value) return '-';
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatPeriodLabel = (periodKey?: string | null) => {
  if (!periodKey || !/^\d{4}-\d{2}$/.test(periodKey)) return '-';
  const [yearValue, monthValue] = periodKey.split('-').map(Number);
  return new Date(yearValue, monthValue - 1, 1).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });
};

const getDueDateForPeriod = (item: RecurringExpense, periodKey: string) => {
  const [yearValue, monthValue] = periodKey.split('-').map(Number);
  const lastDay = new Date(yearValue, monthValue, 0).getDate();
  const day = Math.min(Math.max(Number(item.due_date) || 1, 1), lastDay);
  return new Date(yearValue, monthValue - 1, day).toISOString().slice(0, 10);
};

const addMonthsToPeriodKey = (periodKey: string, monthOffset: number) => {
  const [yearValue, monthValue] = periodKey.split('-').map(Number);
  const date = new Date(yearValue, monthValue - 1 + monthOffset, 1);
  return getPeriodKey(date);
};

const getNextPeriodKey = (item: RecurringExpense, periodKey: string) => {
  if (item.cycle === 'yearly') return addMonthsToPeriodKey(periodKey, 12);
  if (item.cycle === 'monthly') return addMonthsToPeriodKey(periodKey, 1);
  return null;
};

const getNextDueDateAfterPeriod = (item: RecurringExpense, periodKey: string) => {
  const nextPeriodKey = getNextPeriodKey(item, periodKey);
  return nextPeriodKey ? getDueDateForPeriod(item, nextPeriodKey) : null;
};

const getDefaultOperationalAccount = (category: string) => {
  const normalized = category.toLowerCase();
  const subcategory =
    normalized === 'rent'
      ? 'Biaya Sewa Kantor / Cabang'
      : normalized === 'salary'
      ? 'Gaji & Komisi'
      : normalized === 'marketing'
      ? 'Biaya Iklan'
      : normalized === 'other'
      ? 'Lain - lain tidak Rutin'
      : 'Biaya Utilitas';

  return (
    DEFAULT_OPERATIONAL_EXPENSE_ONLY_ACCOUNTS.find((account) => account.subcategory === subcategory) ||
    DEFAULT_OPERATIONAL_EXPENSE_ONLY_ACCOUNTS[0]
  );
};

const parseJsonResponse = async <T,>(response: Response, fallbackMessage: string): Promise<T> => {
  const rawText = await response.text();
  let payload: any = {};

  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      throw new Error(`${fallbackMessage}: response server tidak valid.`);
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || fallbackMessage);
  }

  return payload as T;
};

export const RecurringExpensesTab: React.FC<RecurringExpensesTabProps> = () => {
  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  const [payments, setPayments] = useState<RecurringExpensePayment[]>([]);
  const [operationalAccounts, setOperationalAccounts] = useState(DEFAULT_OPERATIONAL_EXPENSE_ONLY_ACCOUNTS);
  const [loading, setLoading] = useState(true);
  const [paymentHistoryError, setPaymentHistoryError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<ExpenseTab>('unpaid');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringExpense | null>(null);
  const [expenseFormDirty, setExpenseFormDirty] = useState(false);
  const [deletingItem, setDeletingItem] = useState<RecurringExpense | null>(null);
  const [viewingItem, setViewingItem] = useState<RecurringExpense | null>(null);
  const [viewingPayment, setViewingPayment] = useState<RecurringExpensePayment | null>(null);
  const [paymentItem, setPaymentItem] = useState<RecurringExpense | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>({
    paid_at: todayDateInput(),
    amount: '',
    payment_source: '',
    operational_category: getDefaultOperationalAccount('operational')?.category || 'Beban Operasional',
    operational_subcategory: getDefaultOperationalAccount('operational')?.subcategory || 'Biaya Utilitas',
    notes: '',
    proof_url: '',
  });
  const [paymentInitialSnapshot, setPaymentInitialSnapshot] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [statusUpdatingIds, setStatusUpdatingIds] = useState<Set<string>>(() => new Set());
  
  const { branches, currentUser } = useMasterData();
  const { hasPermission } = usePermissions();
  const isMobile = useIsMobile();

  const canAdd = hasPermission('recurring_expenses.create');
  const canEdit = hasPermission('recurring_expenses.edit');
  const canDelete = hasPermission('recurring_expenses.delete');
  const canPay = hasPermission('recurring_expenses.pay');
  const canCreateOperationalExpense = hasPermission('operational_expenses.create');
  const currentPeriodKey = getPeriodKey();

  const closeExpenseFormDialog = useCallback(() => {
    setIsAddOpen(false);
    setEditingItem(null);
    setExpenseFormDirty(false);
  }, []);

  const expenseFormCloseGuard = useMasterDataFormCloseGuard({
    hasUnsavedChanges: expenseFormDirty,
    onClose: closeExpenseFormDialog,
  });

  const closePaymentDialog = useCallback(() => {
    setPaymentItem(null);
    setPaymentInitialSnapshot('');
  }, []);

  const paymentFormCloseGuard = useMasterDataFormCloseGuard({
    hasUnsavedChanges: Boolean(
      paymentItem &&
      paymentInitialSnapshot &&
      JSON.stringify(paymentForm) !== paymentInitialSnapshot
    ),
    onClose: closePaymentDialog,
  });

  const paymentByPeriod = useMemo(() => {
    const rows = new Map<string, RecurringExpensePayment>();
    payments
      .filter((payment) => payment.status === 'paid')
      .forEach((payment) => {
        rows.set(`${payment.recurring_expense_id}:${payment.period_key}`, payment);
      });
    return rows;
  }, [payments]);

  const paymentsByExpense = useMemo(() => {
    const rows = new Map<string, RecurringExpensePayment[]>();
    payments
      .filter((payment) => payment.status === 'paid')
      .forEach((payment) => {
        const existing = rows.get(payment.recurring_expense_id) || [];
        existing.push(payment);
        rows.set(payment.recurring_expense_id, existing);
      });

    rows.forEach((expensePayments) => {
      expensePayments.sort((left, right) => {
        if (right.period_key !== left.period_key) return right.period_key.localeCompare(left.period_key);
        return String(right.paid_at || '').localeCompare(String(left.paid_at || ''));
      });
    });

    return rows;
  }, [payments]);

  const getPaymentForPeriod = useCallback(
    (item: RecurringExpense, periodKey = currentPeriodKey) =>
      paymentByPeriod.get(`${item.id}:${periodKey}`) || null,
    [currentPeriodKey, paymentByPeriod],
  );

  const isPaidForPeriod = useCallback(
    (item: RecurringExpense, periodKey = currentPeriodKey) =>
      Boolean(getPaymentForPeriod(item, periodKey)),
    [currentPeriodKey, getPaymentForPeriod],
  );

  const getPaymentHistoryForItem = useCallback(
    (item: RecurringExpense) => paymentsByExpense.get(item.id) || [],
    [paymentsByExpense],
  );

  // --- HELPER LOGIC ---
  const getExpenseStatus = (item: RecurringExpense) => {
    const today = new Date();

    const payment = getPaymentForPeriod(item);
    if (payment) {
        const nextDueDate = getNextDueDateAfterPeriod(item, currentPeriodKey);
        return {
            status: 'paid',
            label: 'Lunas',
            color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400',
            daysDiff: 0,
            showPayButton: false,
            displayDueDate: payment.due_date || getDueDateForPeriod(item, currentPeriodKey),
            nextDueDate,
            dueContext: 'Periode ini',
            paidAt: payment.paid_at,
        };
    }

    if (item.status === 'inactive') {
        return {
            status: 'inactive',
            label: 'Nonaktif',
            color: 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-300',
            daysDiff: 0,
            showPayButton: false,
            displayDueDate: getDueDateForPeriod(item, currentPeriodKey),
            nextDueDate: null,
            dueContext: 'Tidak ditagihkan',
            paidAt: null,
        };
    }

    // 2. Calculate Due Date for THIS month. The helper clamps tanggal 29-31 on shorter months.
    const targetDate = new Date(`${getDueDateForPeriod(item, currentPeriodKey)}T00:00:00`);
    
    // If due date is passed in this month (e.g. today 26th, due 25th), it's OVERDUE
    // Unless we are strictly looking forward? Usually recurring means "This month's bill"
    
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    // Logic:
    // If diffDays < 0 : Overdue (Red)
    // If diffDays <= 5 : Warning (Yellow) -> Show Pay Button
    // Else : Safe (Blue)

    if (diffDays < 0) {
        return {
            status: 'overdue',
            label: `Telat ${Math.abs(diffDays)} Hari`,
            color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 animate-pulse',
            daysDiff: diffDays,
            showPayButton: true,
            displayDueDate: getDueDateForPeriod(item, currentPeriodKey),
            nextDueDate: getNextDueDateAfterPeriod(item, currentPeriodKey),
            dueContext: 'Jatuh tempo',
            paidAt: null,
        };
    } else if (diffDays <= 5) {
        return {
            status: 'warning',
            label: `${diffDays === 0 ? 'Hari Ini' : `${diffDays} Hari Lagi`}`,
            color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
            daysDiff: diffDays,
            showPayButton: true,
            displayDueDate: getDueDateForPeriod(item, currentPeriodKey),
            nextDueDate: getNextDueDateAfterPeriod(item, currentPeriodKey),
            dueContext: 'Jatuh tempo',
            paidAt: null,
        };
    } else {
        return {
            status: 'safe',
            label: `${diffDays} Hari Lagi`,
            color: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400',
            daysDiff: diffDays,
            showPayButton: false,
            displayDueDate: getDueDateForPeriod(item, currentPeriodKey),
            nextDueDate: getNextDueDateAfterPeriod(item, currentPeriodKey),
            dueContext: 'Jatuh tempo',
            paidAt: null,
        };
    }
  };

  // --- SUMMARY METRICS ---
  const summaryMetrics = useMemo(() => {
    const active = expenses.filter(e => e.status === 'active');
    const paidThisMonth = active.filter((item) => isPaidForPeriod(item)).length;
    const unpaidThisMonth = active.length - paidThisMonth;
    
    const totalMonthly = active.reduce((acc, curr) => {
        if (curr.cycle === 'monthly') return acc + curr.amount;
        if (curr.cycle === 'yearly') return acc + (curr.amount / 12);
        return acc;
    }, 0);

    return {
        totalMonthly,
        activeCount: active.length,
        paidThisMonth,
        unpaidThisMonth,
    };
  }, [expenses, isPaidForPeriod]);

  // --- FETCH DATA ---
  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const fetchPayments = async () => {
        try {
          const headers = await getSessionBackedEdgeHeaders();
          const response = await fetch(`${RECURRING_EXPENSE_PAYMENTS_URL}?status=paid&limit=500`, {
            headers,
            cache: 'no-store',
          });
          const payload = await parseJsonResponse<{ data?: RecurringExpensePayment[] }>(
            response,
            'Gagal memuat history pembayaran rutin',
          );
          return payload.data || [];
        } catch (edgeError) {
          console.warn('Falling back to direct recurring expense payment history query:', edgeError);
          const { data, error } = await supabase
            .from('recurring_expense_payments')
            .select('*')
            .eq('status', 'paid')
            .order('paid_at', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(500);

          if (error) throw error;
          return data || [];
        }
      };

      const [expensesResult, paymentsResult, accountsResult] = await Promise.allSettled([
        supabase
          .from('recurring_expenses')
          .select('*')
          .order('created_at', { ascending: false }),
        fetchPayments(),
        supabase
          .from('operational_expense_categories')
          .select('*')
          .eq('account_type', 'expense')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
      ]);

      if (expensesResult.status === 'rejected' || expensesResult.value.error) {
        throw expensesResult.status === 'rejected' ? expensesResult.reason : expensesResult.value.error;
      }

      setExpenses(expensesResult.value.data || []);

      if (paymentsResult.status === 'fulfilled') {
        setPayments(paymentsResult.value || []);
        setPaymentHistoryError(null);
      } else {
        setPayments([]);
        const message =
          paymentsResult.status === 'rejected'
            ? paymentsResult.reason?.message
            : 'Endpoint history pembayaran rutin belum aktif.';
        setPaymentHistoryError(`${message || 'History pembayaran rutin belum bisa dimuat.'} Jadwal tagihan tetap ditampilkan, tapi tab Sudah Dibayar dan tombol Bayar belum aktif sampai backend history pembayaran tersedia.`);
      }

      if (accountsResult.status === 'fulfilled' && !accountsResult.value.error && accountsResult.value.data?.length) {
        setOperationalAccounts(accountsResult.value.data);
      } else {
        setOperationalAccounts(DEFAULT_OPERATIONAL_EXPENSE_ONLY_ACCOUNTS);
      }
    } catch (err: any) {
      console.error("Error fetching expenses:", err);
      toast.error("Gagal memuat data pengeluaran rutin: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  // --- FILTER DATA ---
  const searchQuery = search.trim().toLowerCase();
  const filteredData = expenses.filter(item => {
    if (!searchQuery) return true;

    return [
      item.name,
      item.category,
      item.description,
      item.whatsapp,
      item.bank_name,
      item.account_number,
      item.account_name,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(searchQuery));
  });

  const activeItems = filteredData.filter(item => item.status === 'active');
  const inactiveItems = filteredData.filter(item => item.status === 'inactive');
  const unpaidItems = activeItems.filter((item) => !isPaidForPeriod(item));
  const paidRows = payments
    .filter((payment) => payment.status === 'paid' && payment.period_key === currentPeriodKey)
    .filter((payment) => {
      const expense = expenses.find((item) => item.id === payment.recurring_expense_id);
      if (!searchQuery) return true;

      return [
        expense?.name,
        expense?.category,
        payment.vendor_name,
        payment.operational_category,
        payment.operational_subcategory,
        payment.payment_source,
        payment.notes,
        payment.paid_by_name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchQuery));
    });

  const operationalCategoryOptions = useMemo(
    () => Array.from(new Set(operationalAccounts.map((account) => account.category).filter(Boolean))),
    [operationalAccounts],
  );

  const operationalSubcategoryOptions = useMemo(() => {
    const source = paymentForm.operational_category
      ? operationalAccounts.filter((account) => account.category === paymentForm.operational_category)
      : operationalAccounts;
    return Array.from(new Set(source.map((account) => account.subcategory).filter(Boolean)));
  }, [operationalAccounts, paymentForm.operational_category]);

  // --- HANDLERS ---
  const handleDelete = async (id: string) => {
    try {
      // Get name before delete for log
      const itemToDelete = expenses.find(e => e.id === id);
      const { error } = await supabase.from('recurring_expenses').delete().eq('id', id);
      if (error) throw error;
      
      setExpenses(prev => prev.filter(item => item.id !== id));
      toast.success("Pengeluaran rutin berhasil dihapus");

      if (currentUser && itemToDelete) {
        logActivity(
            { id: currentUser.id, name: currentUser.name, role: currentUser.role },
            "DELETE",
            "Pengeluaran Rutin",
            `Menghapus pengeluaran rutin: ${itemToDelete.name}`,
            id
        );
      }
    } catch (err: any) {
      toast.error("Gagal menghapus: " + err.message);
    }
  };

  const handleToggleStatus = async (item: RecurringExpense, checked: boolean) => {
    if (!canEdit) {
      toast.error('Akses edit Pengeluaran Rutin belum aktif untuk akun ini.');
      return;
    }

    const nextStatus: RecurringExpense['status'] = checked ? 'active' : 'inactive';
    if (item.status === nextStatus) return;

    setStatusUpdatingIds((previous) => {
      const next = new Set(previous);
      next.add(item.id);
      return next;
    });

    try {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .update({ status: nextStatus })
        .eq('id', item.id)
        .select()
        .single();

      if (error) throw error;

      setExpenses((previous) =>
        previous.map((expense) =>
          expense.id === item.id ? { ...expense, ...(data || {}), status: nextStatus } : expense,
        ),
      );

      toast.success(`${item.name} ${nextStatus === 'active' ? 'diaktifkan' : 'dinonaktifkan'}.`);

      if (currentUser) {
        logActivity(
          { id: currentUser.id, name: currentUser.name, role: currentUser.role },
          "UPDATE",
          "Pengeluaran Rutin",
          `${nextStatus === 'active' ? 'Mengaktifkan' : 'Menonaktifkan'} pengeluaran rutin: ${item.name}`,
          item.id,
        );
      }
    } catch (err: any) {
      toast.error("Gagal mengubah status: " + (err?.message || 'Unknown error'));
    } finally {
      setStatusUpdatingIds((previous) => {
        const next = new Set(previous);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleProofFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Bukti pembayaran harus berupa gambar JPG, PNG, atau WebP.');
      event.target.value = '';
      return;
    }

    setIsUploadingProof(true);
    try {
      const assetId = `recurring-payment-${paymentItem?.id || 'new'}-${Date.now()}`;
      const proofUrl = await uploadProofAssetImage(file, assetId);
      setPaymentForm((previous) => ({ ...previous, proof_url: proofUrl }));
      toast.success(proofUrl.startsWith('data:')
        ? 'Bukti pembayaran berhasil dikompres dan siap disimpan.'
        : 'Bukti pembayaran berhasil diupload.');
    } catch (err: any) {
      toast.error("Gagal upload bukti pembayaran: " + (err?.message || 'Unknown error'));
    } finally {
      setIsUploadingProof(false);
      event.target.value = '';
    }
  };

  const openPaymentDialog = (item: RecurringExpense) => {
    if (isPaidForPeriod(item)) {
      toast.info('Tagihan periode ini sudah tercatat lunas.');
      return;
    }

    const defaultAccount = getDefaultOperationalAccount(item.category);
    setPaymentItem(item);
    const nextPaymentForm = {
      paid_at: todayDateInput(),
      amount: String(item.amount || ''),
      payment_source: item.bank_name ? `Transfer ${item.bank_name}` : '',
      operational_category: defaultAccount?.category || 'Beban Operasional',
      operational_subcategory: defaultAccount?.subcategory || 'Biaya Utilitas',
      notes: '',
      proof_url: '',
    };
    setPaymentForm(nextPaymentForm);
    setPaymentInitialSnapshot(JSON.stringify(nextPaymentForm));
  };

  const handleSubmitPayment = async () => {
    if (!paymentItem) return;
    if (!canPay) {
      toast.error('Akses bayar Pengeluaran Rutin belum aktif untuk akun ini.');
      return;
    }

    if (!canCreateOperationalExpense) {
      toast.error('Akses tambah Biaya Operasional belum aktif untuk akun ini.');
      return;
    }

    const amount = Number(paymentForm.amount);
    if (!paymentForm.paid_at || !amount || amount <= 0 || !paymentForm.operational_category || !paymentForm.operational_subcategory) {
      toast.error('Tanggal bayar, nominal, kategori, dan subkategori wajib diisi.');
      return;
    }

    setIsPaying(true);
    try {
      const dueDate = getDueDateForPeriod(paymentItem, currentPeriodKey);
      const paymentPayload = {
        p_recurring_expense_id: paymentItem.id,
        p_period_key: currentPeriodKey,
        p_due_date: dueDate,
        p_paid_at: paymentForm.paid_at,
        p_amount: amount,
        p_payment_source: paymentForm.payment_source,
        p_operational_category: paymentForm.operational_category,
        p_operational_subcategory: paymentForm.operational_subcategory,
        p_vendor_name: paymentItem.name,
        p_description: `Pembayaran rutin ${paymentItem.name} periode ${currentPeriodKey}`,
        p_branch_id: paymentItem.branch_id || '',
        p_notes: paymentForm.notes,
        p_proof_url: paymentForm.proof_url,
        p_paid_by: currentUser?.id || '',
        p_paid_by_name: currentUser?.name || currentUser?.email || 'System',
      };

      try {
        const headers = await getSessionBackedEdgeHeaders({ includeJsonContentType: true });
        const response = await fetch(RECURRING_EXPENSE_PAY_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify(paymentPayload),
        });

        await parseJsonResponse(response, 'Gagal mencatat pembayaran');
      } catch (edgeError) {
        console.warn('Falling back to direct recurring expense payment RPC:', edgeError);
        const { error } = await supabase.rpc('pay_recurring_expense', paymentPayload);
        if (error) throw error;
      }

      toast.success('Pembayaran tersimpan dan masuk ke Biaya Operasional.');
      setPaymentItem(null);
      setPaymentInitialSnapshot('');
      await fetchExpenses();

      if (currentUser) {
        logActivity(
          { id: currentUser.id, name: currentUser.name, role: currentUser.role },
          "PAYMENT",
          "Pengeluaran Rutin",
          `Mencatat pembayaran ${paymentItem.name} periode ${currentPeriodKey}`,
          paymentItem.id,
          { amount, periodKey: currentPeriodKey }
        );
      }
    } catch (err: any) {
      toast.error("Gagal mencatat pembayaran: " + (err?.message || 'Unknown error'));
    } finally {
      setIsPaying(false);
    }
  };

  const ExpenseForm = ({
    item,
    onClose,
    onDirtyChange,
    onSaved,
  }: {
    item?: RecurringExpense | null;
    onClose: () => void;
    onDirtyChange: (dirty: boolean) => void;
    onSaved: () => void;
  }) => {
     const initialFormData = useMemo<Partial<RecurringExpense>>(() => ({
         name: item?.name || '',
         category: item?.category || 'operational',
         amount: item?.amount || 0,
         cycle: item?.cycle || 'monthly',
         due_date: item?.due_date || 1,
         branch_id: item?.branch_id || 'all',
         description: item?.description || '',
         whatsapp: item?.whatsapp || '',
         bank_name: item?.bank_name || '',
         account_number: item?.account_number || '',
         account_name: item?.account_name || '',
         status: item?.status || 'active'
     }), [item]);

     const [formData, setFormData] = useState<Partial<RecurringExpense>>(initialFormData);

     const [isSubmitting, setIsSubmitting] = useState(false);
     const isDirty = JSON.stringify(formData) !== JSON.stringify(initialFormData);

     useEffect(() => {
       onDirtyChange(isDirty);
     }, [isDirty, onDirtyChange]);
     
     // Filter active branches
     const activeBranches = branches.filter((b: any) => !b.status || b.status === 'active');

     const handleSubmit = async (e: React.FormEvent) => {
         e.preventDefault();
         setIsSubmitting(true);
         
         try {
             const payload = {
                 ...formData,
                 branch_id: formData.branch_id === 'all' ? null : formData.branch_id
             };

             if (item) {
                 const { data, error } = await supabase
                     .from('recurring_expenses')
                     .update(payload)
                     .eq('id', item.id)
                     .select()
                     .single();
                 
                 if (error) throw error;
                 setExpenses(prev => prev.map(ex => ex.id === item.id ? data : ex));
                 toast.success("Data berhasil diperbarui");

                 if (currentUser) {
                    logActivity(
                        { id: currentUser.id, name: currentUser.name, role: currentUser.role },
                        "UPDATE",
                        "Pengeluaran Rutin",
                        `Memperbarui data pengeluaran: ${formData.name}`,
                        item.id
                    );
                 }
             } else {
                 const { data, error } = await supabase
                     .from('recurring_expenses')
                     .insert([payload])
                     .select()
                     .single();

                 if (error) throw error;
                 setExpenses(prev => [data, ...prev]);
                 toast.success("Data berhasil ditambahkan");

                 if (currentUser) {
                    logActivity(
                        { id: currentUser.id, name: currentUser.name, role: currentUser.role },
                        "CREATE",
                        "Pengeluaran Rutin",
                        `Menambahkan pengeluaran baru: ${formData.name}`,
                        data.id
                    );
                 }
             }
             onDirtyChange(false);
             onSaved();
         } catch (err: any) {
             console.error(err);
             toast.error("Gagal menyimpan: " + err.message);
         } finally {
             setIsSubmitting(false);
         }
     };

     return (
         <form onSubmit={handleSubmit} className={cn("space-y-4", isMobile ? "pb-4" : "")}>
             <div className="space-y-2">
                 <Label>Nama Tagihan / Pengeluaran</Label>
                 <Input 
                    required 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Contoh: Sewa Ruko, Internet Indihome"
                 />
             </div>

             <div className="space-y-2">
                 <Label>No. WhatsApp (Opsional)</Label>
                 <Input 
                    value={formData.whatsapp} 
                    onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        setFormData({...formData, whatsapp: val});
                    }}
                    placeholder="Contoh: 08123456789"
                 />
                 <p className="text-[10px] text-slate-500">
                    *Nomor WA untuk reminder tagihan (mulai dengan 08/62)
                 </p>
             </div>

             <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                     <Label>Kategori</Label>
                     <Select 
                        value={formData.category} 
                        onValueChange={val => setFormData({...formData, category: val})}
                     >
                         <SelectTrigger><SelectValue /></SelectTrigger>
                         <SelectContent>
                             <SelectItem value="operational">Operasional</SelectItem>
                             <SelectItem value="rent">Sewa Tempat</SelectItem>
                             <SelectItem value="salary">Gaji Karyawan</SelectItem>
                             <SelectItem value="platform">Biaya Platform</SelectItem>
                             <SelectItem value="marketing">Marketing / Iklan</SelectItem>
                             <SelectItem value="other">Lainnya</SelectItem>
                         </SelectContent>
                     </Select>
                 </div>
                 <div className="space-y-2">
                     <Label>Estimasi Nominal (Rp)</Label>
                     <Input 
                        value={formData.amount ? formData.amount.toLocaleString('id-ID') : ''}
                        onChange={e => {
                            // Remove non-digit chars
                            const rawValue = e.target.value.replace(/\D/g, '');
                            setFormData({...formData, amount: Number(rawValue)});
                        }}
                        placeholder="0"
                     />
                 </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                     <Label>Siklus Pembayaran</Label>
                     <Select 
                        value={formData.cycle} 
                        onValueChange={val => setFormData({...formData, cycle: val as any})}
                     >
                         <SelectTrigger><SelectValue /></SelectTrigger>
                         <SelectContent>
                             <SelectItem value="monthly">Bulanan</SelectItem>
                             <SelectItem value="yearly">Tahunan</SelectItem>
                             <SelectItem value="one_time">Sekali Bayar</SelectItem>
                         </SelectContent>
                     </Select>
                 </div>
                 <div className="space-y-2">
                     <Label>Tanggal Jatuh Tempo</Label>
                     <Input 
                        type="number" 
                        min="1" max="31"
                        value={formData.due_date} 
                        onChange={e => setFormData({...formData, due_date: Number(e.target.value)})}
                        placeholder="Tgl 1-31"
                     />
                     <p className="text-[10px] text-slate-500">
                        *Masukkan tanggal jatuh tempo (contoh: 25)
                     </p>
                 </div>
             </div>

             <div className="space-y-2">
                 <Label>Cabang (Opsional)</Label>
                 <Select 
                    value={formData.branch_id || 'all'} 
                    onValueChange={val => setFormData({...formData, branch_id: val})}
                 >
                     <SelectTrigger><SelectValue placeholder="Pilih Cabang" /></SelectTrigger>
                     <SelectContent>
                         <SelectItem value="all">Semua Cabang / Kantor Pusat</SelectItem>
                         {activeBranches.map((b: any) => (
                             <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                         ))}
                     </SelectContent>
                 </Select>
             </div>

             <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                 <Label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Info Rekening / Transfer (Opsional)</Label>
                 <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                         <Label>Nama Bank</Label>
                         <Input 
                            value={formData.bank_name} 
                            onChange={e => setFormData({...formData, bank_name: e.target.value})}
                            placeholder="BCA, Mandiri, dll"
                         />
                     </div>
                     <div className="space-y-2">
                         <Label>No. Rekening</Label>
                         <Input 
                            value={formData.account_number} 
                            onChange={e => setFormData({...formData, account_number: e.target.value})}
                            placeholder="123xxxx"
                         />
                     </div>
                 </div>
                 <div className="space-y-2">
                     <Label>Atas Nama</Label>
                     <Input 
                        value={formData.account_name} 
                        onChange={e => setFormData({...formData, account_name: e.target.value})}
                        placeholder="Nama Pemilik Rekening"
                     />
                 </div>
             </div>

             <div className="space-y-2">
                 <Label>Status</Label>
                 <Select 
                    value={formData.status} 
                    onValueChange={val => setFormData({...formData, status: val as any})}
                 >
                     <SelectTrigger><SelectValue /></SelectTrigger>
                     <SelectContent>
                         <SelectItem value="active">Aktif</SelectItem>
                         <SelectItem value="inactive">Tidak Aktif</SelectItem>
                     </SelectContent>
                 </Select>
             </div>

             <div className="space-y-2">
                 <Label>Keterangan Tambahan</Label>
                 <Textarea 
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="Catatan..."
                    className="resize-none"
                    rows={3}
                 />
             </div>

             <MasterDataFormActions
               onCancel={onClose}
               saveLabel={item ? 'Simpan Perubahan' : 'Simpan Pengeluaran'}
               isSubmitting={isSubmitting}
               className={cn(isMobile && "flex-col-reverse")}
             />
         </form>
     );
  };

  const renderExpenseRow = (item: RecurringExpense, index: number) => {
    const branchName = item.branch_id ? branches.find(b => b.id === item.branch_id)?.name : 'Semua Cabang';
    const statusMeta = getExpenseStatus(item);
    const { label, color } = statusMeta;
    const isPaid = statusMeta.status === 'paid';
    const dueDate = statusMeta.displayDueDate;
    const nextDueDate = statusMeta.nextDueDate;
    const isStatusUpdating = statusUpdatingIds.has(item.id);
    const paymentActionDisabled = !canCreateOperationalExpense;

    return (
      <TableRow
        key={item.id}
        className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors"
      >
        <TableCell className="py-4 pl-6 text-slate-500 font-mono text-xs">
          {index + 1}
        </TableCell>
        <TableCell className="py-4 font-medium text-slate-900 dark:text-slate-200 text-sm">
          <div className="flex flex-col">
            <span className="font-semibold">{item.name}</span>
            {item.description && <span className="text-xs text-slate-400">{item.description}</span>}
          </div>
        </TableCell>
        <TableCell className="py-4">
          <Badge variant="outline" className="capitalize text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800">
            {item.category === 'platform' ? 'Platform Fee' : item.category}
          </Badge>
        </TableCell>
        <TableCell className="py-4 text-sm text-slate-600 dark:text-slate-400">
          {item.whatsapp ? (
            <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-md w-fit font-mono text-xs">
              <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" className="w-3.5 h-3.5" alt="WA" />
              {item.whatsapp}
            </div>
          ) : (
            <span className="text-slate-400 text-xs">-</span>
          )}
        </TableCell>
        <TableCell className="py-4 text-sm text-slate-600 dark:text-slate-400">
          {item.account_number ? (
            <div className="flex flex-col">
              <span className="font-medium text-slate-700 dark:text-slate-300 font-mono text-xs">
                {item.bank_name ? `${item.bank_name} ` : ''}{item.account_number}
              </span>
              {item.account_name && (
                <span className="text-xs text-slate-500">
                  a.n {item.account_name}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 text-xs">-</span>
          )}
        </TableCell>
        <TableCell className="py-4 font-mono text-slate-700 dark:text-slate-300">
          {item.amount > 0 ? `Rp ${Number(item.amount).toLocaleString('id-ID')}` : '-'}
        </TableCell>
        <TableCell className="py-4 text-sm text-slate-600 dark:text-slate-400 capitalize">
          <div className="flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
            {item.cycle === 'monthly' ? 'Bulanan' : item.cycle === 'yearly' ? 'Tahunan' : 'Sekali'}
          </div>
        </TableCell>
        <TableCell className="py-4 text-sm">
          {isPaid ? (
            <div className="flex min-w-[150px] flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {formatPeriodLabel(currentPeriodKey)}
              </span>
              <Badge variant="outline" className={cn("w-fit font-medium border px-2 py-0.5 whitespace-nowrap", color)}>
                <CheckCircle2 className="w-3 h-3 mr-1.5" />
                {label}
              </Badge>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Tempo: {formatDateLabel(dueDate)}
              </span>
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                Dibayar: {formatDateLabel(statusMeta.paidAt)}
              </span>
            </div>
          ) : (
            <div className="flex min-w-[130px] flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Jatuh tempo
              </span>
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {formatDateLabel(dueDate)}
              </span>
              <Badge variant="outline" className={cn("w-fit font-medium border px-2 py-0.5 whitespace-nowrap", color)}>
                <Clock className="w-3 h-3 mr-1.5" />
                {label}
              </Badge>
            </div>
          )}
        </TableCell>
        <TableCell className="py-4 text-sm">
          {nextDueDate ? (
            <div className="flex min-w-[130px] flex-col gap-1">
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {formatDateLabel(nextDueDate)}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {isPaid ? 'Tagihan berikutnya' : 'Setelah periode ini'}
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-400">-</span>
          )}
        </TableCell>
        <TableCell className="py-4 text-sm text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            {branchName || '-'}
          </div>
        </TableCell>
        <TableStatusCell>
          <TableStatusIcon
            className={cn(canEdit && !isStatusUpdating && 'cursor-pointer')}
            label={
              isStatusUpdating
                ? 'Update status'
                : item.status === 'active'
                  ? 'Aktif'
                  : 'Non aktif'
            }
            onClick={() => {
              if (!canEdit || isStatusUpdating) return;
              void handleToggleStatus(item, item.status !== 'active');
            }}
            tone={isStatusUpdating ? 'soon' : item.status === 'active' ? 'active' : 'inactive'}
          />
        </TableStatusCell>
        <TableActionCell>
            {isPaid ? (
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">
                <CheckCircle2 className="mr-1.5 h-3 w-3" />
                Clear
              </Badge>
            ) : item.status === 'active' && canPay ? (
              <Button
                size="sm"
                variant={paymentActionDisabled ? 'outline' : 'default'}
                className={cn(
                  "h-8 px-3 text-xs",
                  paymentActionDisabled
                    ? "border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-50"
                    : "",
                )}
                disabled={paymentActionDisabled}
                onClick={() => openPaymentDialog(item)}
                title={
                  !canCreateOperationalExpense
                    ? 'Butuh akses tambah Biaya Operasional.'
                    : undefined
                }
              >
                {paymentActionDisabled ? (
                  <AlertCircle className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                Bayar
              </Button>
            ) : null}

            <TableActionMenu contentClassName="w-48">
                <TableActionMenuItem icon={Eye} onClick={() => setViewingItem(item)}>
                  Lihat Detail
                </TableActionMenuItem>
                {canEdit && (
                  <TableActionMenuItem
                    icon={Edit}
                    onClick={() => {
                      setEditingItem(item);
                      setExpenseFormDirty(false);
                      setIsAddOpen(true);
                    }}
                  >
                    Edit Data
                  </TableActionMenuItem>
                )}
                {canDelete && (
                  <TableActionMenuItem danger icon={Trash2} onClick={() => setDeletingItem(item)}>
                    Hapus
                  </TableActionMenuItem>
                )}
            </TableActionMenu>
        </TableActionCell>
      </TableRow>
    );
  };

  const renderSection = (items: RecurringExpense[], sectionTitle: string, variant: 'active' | 'inactive') => {
    if (items.length === 0) return null;

    return (
      <div className="mb-8 last:mb-0">
        <MasterDataTableTitle
          title={sectionTitle}
          count={items.length}
          variant={variant}
        />

        <OperationalTableCard>
          <DataTable
            actionWidth={82}
            cellY={12}
            columns={[64, 230, 180, 150, 220, 150, 120, 145, 175, 160, 120, 82]}
            minWidth={1798}
            rowMinHeight={82}
          >
            <table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-700/50">
                <TableRow className="border-b border-slate-100 dark:border-slate-700">
                  <TableHead className="w-[50px] font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4 pl-6">No</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Nama Pengeluaran</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Kategori</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">No. WA</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Info Rekening</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Nominal Est.</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Siklus</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Jatuh Tempo</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Tagihan Selanjutnya</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Cabang</TableHead>
                  <TableHead className="text-center font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Status</TableHead>
                  <TableActionHeader />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => renderExpenseRow(item, index))}
              </TableBody>
            </table>
          </DataTable>
        </OperationalTableCard>
      </div>
    );
  };

  const renderUnpaidSection = () => (
    <OperationalTableCard>
      <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Belum Dibayar - {currentPeriodKey}</h3>
          <p className="text-sm text-slate-500">Checklist tagihan rutin bulan ini yang belum clear.</p>
        </div>
        <Badge variant="outline" className="w-fit border-amber-200 bg-amber-50 text-amber-700">
          {unpaidItems.length} tagihan
        </Badge>
      </div>
      {unpaidItems.length === 0 ? (
        <OperationalEmptyState
          icon={CheckCircle2}
          title="Semua tagihan bulan ini clear"
          description="Pembayaran yang sudah dicatat ada di tab Sudah Dibayar."
        />
      ) : (
        <DataTable
          actionWidth={82}
          cellY={12}
          columns={[64, 230, 180, 150, 220, 150, 120, 145, 175, 160, 120, 82]}
          minWidth={1798}
          rowMinHeight={82}
        >
          <table>
            <TableHeader className="bg-slate-50/50 dark:bg-slate-700/50">
              <TableRow className="border-b border-slate-100 dark:border-slate-700">
                <TableHead className="w-[50px] font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4 pl-6">No</TableHead>
                <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Nama Pengeluaran</TableHead>
                <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Kategori</TableHead>
                <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">No. WA</TableHead>
                <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Info Rekening</TableHead>
                <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Nominal Est.</TableHead>
                <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Siklus</TableHead>
                <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Jatuh Tempo</TableHead>
                <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Tagihan Selanjutnya</TableHead>
                <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Cabang</TableHead>
                <TableHead className="text-center font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Status</TableHead>
                <TableActionHeader />
              </TableRow>
            </TableHeader>
            <TableBody>
              {unpaidItems.map((item, index) => renderExpenseRow(item, index))}
            </TableBody>
          </table>
        </DataTable>
      )}
    </OperationalTableCard>
  );

  const renderPaidSection = () => (
    <OperationalTableCard>
      <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Sudah Dibayar - {currentPeriodKey}</h3>
          <p className="text-sm text-slate-500">History pembayaran yang sudah masuk Biaya Operasional.</p>
        </div>
        <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">
          {paidRows.length} clear
        </Badge>
      </div>
      {paidRows.length === 0 ? (
        <OperationalEmptyState
          icon={Wallet}
          title="Belum ada pembayaran bulan ini"
          description="Pembayaran akan muncul di sini setelah form Bayar disimpan."
        />
      ) : (
        <DataTable
          actionWidth={82}
          cellY={12}
          columns={[250, 145, 160, 175, 220, 170, 150, 120, 160, 82]}
          minWidth={1632}
          rowMinHeight={82}
        >
          <table>
            <TableHeader className="bg-slate-50/50 dark:bg-slate-700/50">
                <TableRow className="border-b border-slate-100 dark:border-slate-700">
                  <TableHead className="pl-6 font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Tagihan</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Jatuh Tempo</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Tanggal Bayar</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Tagihan Selanjutnya</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Kategori Operasional</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Sumber Dana</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Nominal</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Bukti</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Input Oleh</TableHead>
                  <TableActionHeader />
                </TableRow>
            </TableHeader>
            <TableBody>
              {paidRows.map((payment) => {
                const expense = expenses.find((item) => item.id === payment.recurring_expense_id);
                const dueDate = payment.due_date || (expense ? getDueDateForPeriod(expense, payment.period_key) : null);
                const nextDueDate = expense ? getNextDueDateAfterPeriod(expense, payment.period_key) : null;
                return (
                  <TableRow
                    key={payment.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors"
                  >
                    <TableCell className="py-4 pl-6">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {expense?.name || payment.vendor_name || 'Pengeluaran rutin'}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Periode {formatPeriodLabel(payment.period_key)}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {payment.operational_expense_id ? `Ledger: ${payment.operational_expense_id.slice(0, 8)}` : 'Belum ada link ledger'}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-sm text-slate-700 dark:text-slate-200">{formatDateLabel(dueDate)}</TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        <CheckCircle2 className="mr-1.5 h-3 w-3" />
                        {formatDateLabel(payment.paid_at)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 text-sm text-slate-700 dark:text-slate-200">
                      {nextDueDate ? (
                        <div className="flex flex-col">
                          <span>{formatDateLabel(nextDueDate)}</span>
                          <span className="text-xs text-slate-400">Tagihan berikutnya</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Selesai</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{payment.operational_category || '-'}</div>
                      <div className="text-xs text-slate-500">{payment.operational_subcategory || '-'}</div>
                    </TableCell>
                    <TableCell className="py-4 text-sm text-slate-600 dark:text-slate-300">{payment.payment_source || '-'}</TableCell>
                    <TableCell className="py-4 font-mono font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(payment.amount)}</TableCell>
                    <TableCell className="py-4">
                      {payment.proof_url ? (
                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                          Ada bukti
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500">
                          Belum ada
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-4 text-sm text-slate-600 dark:text-slate-300">{payment.paid_by_name || '-'}</TableCell>
                    <TableCell className="py-4 pr-6 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                        onClick={() => setViewingPayment(payment)}
                        title="Lihat detail pembayaran"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </table>
        </DataTable>
      )}
    </OperationalTableCard>
  );

  const viewingPaymentExpense = viewingPayment
    ? expenses.find((item) => item.id === viewingPayment.recurring_expense_id) || null
    : null;
  const viewingPaymentDueDate = viewingPayment
    ? viewingPayment.due_date || (viewingPaymentExpense ? getDueDateForPeriod(viewingPaymentExpense, viewingPayment.period_key) : null)
    : null;
  const viewingPaymentNextDueDate =
    viewingPayment && viewingPaymentExpense
      ? getNextDueDateAfterPeriod(viewingPaymentExpense, viewingPayment.period_key)
      : null;

  return (
    <div className="masterDataTabSurface">
      <OperationalPageHeader
        title="Pengeluaran Rutin"
        eyebrow="Finance"
        icon={ReceiptText}
        subtitle={`Periode ${currentPeriodKey}. Kelola tagihan rutin, history pembayaran, dan sinkron Biaya Operasional.`}
      />

      <NoticeStack
        className="masterDataFloatingNotices"
        notices={
          paymentHistoryError
            ? [
                {
                  id: 'payment-history',
                  tone: 'warning',
                  title: 'Integrasi history pembayaran belum aktif di backend.',
                  message: paymentHistoryError,
                },
              ]
            : []
        }
      />

      <OperationalKpiGrid>
        <OperationalKpiCard
          label="Estimasi Bulanan"
          value={formatCurrency(summaryMetrics.totalMonthly)}
          icon={Wallet}
          tone="blue"
        />
        <OperationalKpiCard
          label="Total Item Aktif"
          value={`${summaryMetrics.activeCount.toLocaleString('id-ID')} Item`}
          icon={RefreshCw}
          tone="default"
        />
        <OperationalKpiCard
          label="Belum Dibayar"
          value={`${summaryMetrics.unpaidThisMonth.toLocaleString('id-ID')} Bulan ini`}
          icon={Clock}
          tone="rose"
        />
        <OperationalKpiCard
          label="Sudah Dibayar"
          value={`${summaryMetrics.paidThisMonth.toLocaleString('id-ID')} Clear`}
          icon={CheckCircle2}
          tone="emerald"
        />
      </OperationalKpiGrid>

      <ControlPanel aria-label="Filter biaya berulang">
        <ControlRow className="masterDataControlRow">
          <SearchBox
            placeholder="Cari nama, kategori, rekening, atau catatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="masterDataControlActions">
            <Button variant="outline" className="masterDataActionButton secondary" onClick={() => setSearch('')} disabled={!search.trim()}>
              Reset
            </Button>
            <Button variant="outline" className="masterDataActionButton secondary" onClick={fetchExpenses} disabled={loading}>
              <RefreshCw className={cn(loading && 'animate-spin')} />
              Refresh
            </Button>
            {canAdd && (
              <Button
                className="masterDataActionButton"
                onClick={() => {
                  setEditingItem(null);
                  setExpenseFormDirty(false);
                  setIsAddOpen(true);
                }}
              >
                <Plus />
                Tambah Pengeluaran
              </Button>
            )}
          </div>
        </ControlRow>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          {[
            { id: 'schedule' as const, label: 'Jadwal', count: activeItems.length + inactiveItems.length },
            { id: 'unpaid' as const, label: 'Belum Dibayar', count: unpaidItems.length },
            { id: 'paid' as const, label: 'Sudah Dibayar', count: paidRows.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-xs',
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200',
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </ControlPanel>

      {loading ? (
          <OperationalTableCard>
            <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Memuat data...
            </div>
          </OperationalTableCard>
      ) : activeTab === 'schedule' && filteredData.length > 0 ? (
          <>
            {renderSection(activeItems, "Pengeluaran Aktif", 'active')}
            {renderSection(inactiveItems, "Non-Aktif", 'inactive')}
          </>
      ) : activeTab === 'unpaid' ? (
          renderUnpaidSection()
      ) : activeTab === 'paid' ? (
          renderPaidSection()
      ) : (
          <OperationalTableCard>
            <OperationalEmptyState
              icon={Wallet}
              title="Tidak ada data"
              description="Tambahkan pengeluaran rutin untuk mengaktifkan reminder dan history pembayaran."
            />
          </OperationalTableCard>
      )}

      <Dialog open={isAddOpen} onOpenChange={(open) => {
        if (!open) expenseFormCloseGuard.requestClose();
      }}>
        <MasterDataFormDialogContent size="wide">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Pengeluaran Rutin' : 'Tambah Pengeluaran Rutin'}</DialogTitle>
            <DialogDescription>
              Kelola data pengeluaran rutin untuk estimasi cashflow dan reminder.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6">
            <ExpenseForm
              item={editingItem}
              onClose={expenseFormCloseGuard.requestClose}
              onDirtyChange={setExpenseFormDirty}
              onSaved={closeExpenseFormDialog}
            />
          </div>
        </MasterDataFormDialogContent>
        <MasterDataUnsavedChangesDialog
          open={expenseFormCloseGuard.isConfirmOpen}
          onCancel={expenseFormCloseGuard.cancelClose}
          onConfirm={expenseFormCloseGuard.confirmClose}
        />
      </Dialog>

      <Dialog open={!!paymentItem} onOpenChange={(open) => {
        if (!open && !isPaying && !isUploadingProof) paymentFormCloseGuard.requestClose();
      }}>
        <MasterDataFormDialogContent size="wide">
          <DialogHeader>
            <DialogTitle>Catat Pembayaran Rutin</DialogTitle>
            <DialogDescription>
              Pembayaran akan masuk ke history dan otomatis membuat Biaya Operasional.
            </DialogDescription>
          </DialogHeader>

          {paymentItem && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{paymentItem.name}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>Periode {currentPeriodKey}</span>
                  <span>Jatuh tempo {formatDateLabel(getDueDateForPeriod(paymentItem, currentPeriodKey))}</span>
                  <span>Estimasi {formatCurrency(paymentItem.amount)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tanggal Bayar</Label>
                  <Input
                    type="date"
                    value={paymentForm.paid_at}
                    onChange={(event) => setPaymentForm((prev) => ({ ...prev, paid_at: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nominal Final</Label>
                  <Input
                    value={paymentForm.amount ? Number(paymentForm.amount).toLocaleString('id-ID') : ''}
                    onChange={(event) => {
                      const rawValue = event.target.value.replace(/\D/g, '');
                      setPaymentForm((prev) => ({ ...prev, amount: rawValue }));
                    }}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Sumber Dana / Metode Bayar</Label>
                <Input
                  value={paymentForm.payment_source}
                  onChange={(event) => setPaymentForm((prev) => ({ ...prev, payment_source: event.target.value }))}
                  placeholder="Cash, BCA, Mandiri, transfer vendor..."
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Kategori Biaya Operasional</Label>
                  <Select
                    value={paymentForm.operational_category}
                    onValueChange={(value) => {
                      const firstSubcategory = operationalAccounts.find((account) => account.category === value)?.subcategory || '';
                      setPaymentForm((prev) => ({
                        ...prev,
                        operational_category: value,
                        operational_subcategory: firstSubcategory,
                      }));
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                    <SelectContent>
                      {operationalCategoryOptions.map((category) => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subkategori</Label>
                  <Select
                    value={paymentForm.operational_subcategory}
                    onValueChange={(value) => setPaymentForm((prev) => ({ ...prev, operational_subcategory: value }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Pilih subkategori" /></SelectTrigger>
                    <SelectContent>
                      {operationalSubcategoryOptions.map((subcategory) => (
                        <SelectItem key={subcategory} value={subcategory}>{subcategory}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bukti Pembayaran (Opsional)</Label>
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                  <Input
                    id="recurring-payment-proof-file"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleProofFileChange}
                    disabled={isUploadingProof || isPaying}
                    className="sr-only"
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                        {isUploadingProof ? (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        ) : paymentForm.proof_url ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Upload className="h-4 w-4 text-slate-500" />
                        )}
                        <span>
                          {isUploadingProof
                            ? 'Mengupload bukti...'
                            : paymentForm.proof_url
                              ? 'Bukti pembayaran tersimpan'
                              : 'Upload gambar bukti transfer'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {paymentForm.proof_url
                          ? 'Link bukti disimpan otomatis di history pembayaran.'
                          : 'JPG, PNG, atau WebP. Gambar besar dikompres otomatis.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <label
                        htmlFor="recurring-payment-proof-file"
                        className={cn(
                          'inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
                          (isUploadingProof || isPaying) && 'pointer-events-none opacity-50',
                        )}
                      >
                        {isUploadingProof ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {paymentForm.proof_url ? 'Ganti Bukti' : 'Pilih Gambar'}
                      </label>
                      {paymentForm.proof_url && (
                        <>
                          <a
                            href={paymentForm.proof_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Lihat
                          </a>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 gap-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                            disabled={isUploadingProof || isPaying}
                            onClick={() => setPaymentForm((prev) => ({ ...prev, proof_url: '' }))}
                          >
                            <XCircle className="h-4 w-4" />
                            Hapus
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Catatan</Label>
                <Textarea
                  value={paymentForm.notes}
                  onChange={(event) => setPaymentForm((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Catatan pembayaran, nomor invoice, atau info tambahan"
                  className="resize-none"
                  rows={3}
                />
              </div>
            </div>
          )}

          <div className="masterDataFormActions">
            <Button
              type="button"
              variant="outline"
              onClick={paymentFormCloseGuard.requestClose}
              disabled={isPaying || isUploadingProof}
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleSubmitPayment}
              disabled={isPaying || isUploadingProof || !canPay || !canCreateOperationalExpense}
              icon={
                isPaying || isUploadingProof
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <CheckCircle2 className="h-4 w-4" />
              }
            >
              {isPaying ? (
                'Menyimpan...'
              ) : isUploadingProof ? (
                'Upload Bukti...'
              ) : (
                'Simpan Pembayaran'
              )}
            </Button>
          </div>
        </MasterDataFormDialogContent>
        <MasterDataUnsavedChangesDialog
          open={paymentFormCloseGuard.isConfirmOpen}
          onCancel={paymentFormCloseGuard.cancelClose}
          onConfirm={paymentFormCloseGuard.confirmClose}
        />
      </Dialog>

      <AlertDialog open={Boolean(deletingItem)} onOpenChange={(open) => {
        if (!open) setDeletingItem(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin hapus pengeluaran rutin <strong>{deletingItem?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="dangerButton"
              onClick={() => {
                if (deletingItem) void handleDelete(deletingItem.id);
                setDeletingItem(null);
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Detail Modal */}
      <Dialog open={!!viewingPayment} onOpenChange={(open) => !open && setViewingPayment(null)}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>Detail Pembayaran Rutin</DialogTitle>
            <DialogDescription>
              Detail pembayaran, ledger operasional, dan bukti transfer.
            </DialogDescription>
          </DialogHeader>

          {viewingPayment && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {formatPeriodLabel(viewingPayment.period_key)}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-100">
                      {viewingPaymentExpense?.name || viewingPayment.vendor_name || 'Pengeluaran rutin'}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {viewingPayment.operational_expense_id
                        ? `Ledger ${viewingPayment.operational_expense_id}`
                        : 'Belum ada link ledger operasional'}
                    </p>
                  </div>
                  <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Lunas
                  </Badge>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-xs text-slate-500">Jatuh tempo</p>
                  <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{formatDateLabel(viewingPaymentDueDate)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-xs text-slate-500">Tanggal bayar</p>
                  <p className="mt-1 font-medium text-emerald-700 dark:text-emerald-300">{formatDateLabel(viewingPayment.paid_at)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-xs text-slate-500">Tagihan selanjutnya</p>
                  <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                    {viewingPaymentNextDueDate ? formatDateLabel(viewingPaymentNextDueDate) : 'Selesai'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-xs text-slate-500">Nominal</p>
                  <p className="mt-1 font-mono font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(viewingPayment.amount)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-xs text-slate-500">Kategori operasional</p>
                  <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{viewingPayment.operational_category || '-'}</p>
                  <p className="text-xs text-slate-500">{viewingPayment.operational_subcategory || '-'}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-xs text-slate-500">Sumber dana</p>
                  <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{viewingPayment.payment_source || '-'}</p>
                  <p className="text-xs text-slate-500">Input oleh {viewingPayment.paid_by_name || '-'}</p>
                </div>
              </div>

              {viewingPayment.notes && (
                <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Catatan</p>
                  {viewingPayment.notes}
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Bukti Transfer</p>
                    <p className="text-xs text-slate-500">
                      {viewingPayment.proof_url ? 'Bukti tersimpan untuk pembayaran ini.' : 'Belum ada bukti transfer.'}
                    </p>
                  </div>
                  {viewingPayment.proof_url ? (
                    <a
                      href={viewingPayment.proof_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Buka Bukti
                    </a>
                  ) : null}
                </div>
                {viewingPayment.proof_url ? (
                  <div className="mt-3 overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                    <img
                      src={viewingPayment.proof_url}
                      alt="Bukti transfer"
                      className="max-h-[320px] w-full object-contain bg-white dark:bg-slate-950"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={() => setViewingPayment(null)}>Tutup</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* View Detail Modal */}
      <Dialog open={!!viewingItem} onOpenChange={(open) => !open && setViewingItem(null)}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Detail Pengeluaran</DialogTitle>
            <DialogDescription>
              Informasi lengkap mengenai pengeluaran rutin ini.
            </DialogDescription>
          </DialogHeader>
          
          {viewingItem && (
            <div className="grid gap-4 py-4">
               <div className="grid grid-cols-4 items-center gap-4">
                 <Label className="text-right text-slate-500">Nama</Label>
                 <div className="col-span-3 font-medium text-base">{viewingItem.name}</div>
               </div>
               <div className="grid grid-cols-4 items-center gap-4">
                 <Label className="text-right text-slate-500">Kategori</Label>
                 <div className="col-span-3 capitalize">
                    <Badge variant="outline" className="bg-slate-50">{viewingItem.category}</Badge>
                 </div>
               </div>
               <div className="grid grid-cols-4 items-center gap-4">
                 <Label className="text-right text-slate-500">Nominal</Label>
                 <div className="col-span-3 font-mono font-medium">
                    Rp {viewingItem.amount.toLocaleString('id-ID')}
                 </div>
               </div>
               <div className="grid grid-cols-4 items-center gap-4">
                 <Label className="text-right text-slate-500">Siklus</Label>
                 <div className="col-span-3 capitalize text-sm">
                    {viewingItem.cycle === 'monthly' ? 'Bulanan' : viewingItem.cycle === 'yearly' ? 'Tahunan' : 'Sekali'}
                 </div>
               </div>
               <div className="grid grid-cols-4 items-center gap-4">
                 <Label className="text-right text-slate-500">Jatuh Tempo</Label>
                 <div className="col-span-3 text-sm">
                    <div className="font-medium text-slate-800">
                      {formatDateLabel(getExpenseStatus(viewingItem).displayDueDate)}
                    </div>
                    <div className="text-xs text-slate-500">
                      Tgl {viewingItem.due_date} - {getExpenseStatus(viewingItem).dueContext}
                    </div>
                 </div>
               </div>
               <div className="grid grid-cols-4 items-center gap-4">
                 <Label className="text-right text-slate-500">Tagihan Selanjutnya</Label>
                 <div className="col-span-3 text-sm">
                    {getExpenseStatus(viewingItem).nextDueDate ? (
                      <div className="font-medium text-slate-800">
                        {formatDateLabel(getExpenseStatus(viewingItem).nextDueDate)}
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                 </div>
               </div>
               <div className="grid grid-cols-4 items-center gap-4">
                 <Label className="text-right text-slate-500">Status</Label>
                 <div className="col-span-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        viewingItem.status === 'active'
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-500",
                      )}
                    >
                      {viewingItem.status === 'active' ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                 </div>
               </div>
               
               <div className="border-t border-slate-100 my-1"></div>
               
               <div className="grid grid-cols-4 items-start gap-4">
                 <Label className="text-right text-slate-500 mt-2">Rekening</Label>
                 <div className="col-span-3">
                    {viewingItem.account_number ? (
                        <div className="flex flex-col bg-slate-50 p-3 rounded-md border border-slate-100 mt-1">
                            <span className="font-semibold text-slate-700">{viewingItem.bank_name || 'Bank'}</span>
                            <span className="font-mono text-lg tracking-wide select-all">{viewingItem.account_number}</span>
                            {viewingItem.account_name && <span className="text-sm text-slate-500 mt-1">a.n {viewingItem.account_name}</span>}
                        </div>
                    ) : (
                        <span className="text-slate-400 italic text-sm mt-2 block">Tidak ada info rekening</span>
                    )}
                 </div>
               </div>
               
               {viewingItem.whatsapp && (
                   <div className="grid grid-cols-4 items-center gap-4">
                     <Label className="text-right text-slate-500">WhatsApp</Label>
                     <div className="col-span-3 font-mono text-green-600 flex items-center gap-2 text-sm">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" className="w-4 h-4" alt="WA" />
                        {viewingItem.whatsapp}
                     </div>
                   </div>
               )}
               
               {viewingItem.description && (
                   <div className="grid grid-cols-4 items-start gap-4">
                     <Label className="text-right text-slate-500 mt-1">Catatan</Label>
                     <div className="col-span-3 text-sm text-slate-600 bg-slate-50 p-2 rounded-md italic">
                        "{viewingItem.description}"
                     </div>
                   </div>
               )}

               <div className="border-t border-slate-100 my-1"></div>

               <div className="grid grid-cols-4 items-start gap-4">
                 <Label className="text-right text-slate-500 mt-2">History</Label>
                 <div className="col-span-3 space-y-2">
                    {getPaymentHistoryForItem(viewingItem).slice(0, 5).length > 0 ? (
                      getPaymentHistoryForItem(viewingItem)
                        .slice(0, 5)
                        .map((payment) => (
                          <div key={payment.id} className="rounded-md border border-slate-100 bg-slate-50 p-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium text-slate-700">{payment.period_key}</span>
                              <span className="font-mono text-slate-900">{formatCurrency(payment.amount)}</span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              Jatuh tempo {formatDateLabel(payment.due_date || getDueDateForPeriod(viewingItem, payment.period_key))}
                              {' - '}
                              Dibayar {formatDateLabel(payment.paid_at)}
                              {payment.payment_source ? ` via ${payment.payment_source}` : ''}
                            </div>
                            {payment.proof_url && (
                              <a
                                href={payment.proof_url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Lihat bukti pembayaran
                              </a>
                            )}
                          </div>
                        ))
                    ) : (
                      <div className="rounded-md border border-dashed border-slate-200 p-3 text-sm text-slate-500">
                        Belum ada history pembayaran.
                      </div>
                    )}
                 </div>
               </div>

               <div className="flex justify-end pt-4">
                  <Button onClick={() => setViewingItem(null)}>Tutup</Button>
               </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
