import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AlertCircle,
  Plus, Edit, Trash2, CheckCircle2,
  Clock, RefreshCw, Loader2, Wallet, Eye, ReceiptText, ExternalLink
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  DataTable,
  TableActionCell,
  TableActionHeader,
  TableActionMenu,
  TableActionMenuItem,
  TableStatusCell,
  TableStatusIcon,
  TableStatusSwitch,
  TableText,
} from '../../../components/ui/data-table';
import { MasterDataTableTitle } from '../../../components/ui/master-data-table-title';
import { NoticeStack } from '../../../components/ui/notice-stack';
import {
  TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../../../components/ui/table';
import { Dialog } from "../../../components/ui/dialog";
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
import { Textarea } from '../../../components/ui/textarea';
import { Role } from '../data';
import { toast } from 'sonner';
import { usePermissions } from '@/app/hooks/usePermissions';
import { supabase } from '@/lib/supabaseClient';
import { buildMakeServerUrl } from '@/app/services/internal/functionsBaseUrl';
import { getSessionBackedEdgeHeaders } from '@/app/services/internal/sessionClientHeaders';
import { cn } from '../../../components/ui/utils';
import { ControlPanel, ControlRow, SearchBox } from '../../../components/ui/control-panel';
import { useMasterData } from '../context';
import { useIsMobile } from '@/app/components/ui/use-mobile';
import { logActivity } from '@/app/services/auditService';
import { DEFAULT_OPERATIONAL_EXPENSE_ONLY_ACCOUNTS } from '@/app/data/operationalExpenseAccounts';
import {
  OPERATIONAL_EXPENSE_FORWARD_DRAFT_KEY,
  OperationalExpenseForwardDraft,
} from '@/app/data/operationalExpenseForwardDraft';
import {
  OperationalEmptyState,
  OperationalKpiCard,
  OperationalKpiGrid,
  OperationalPageHeader,
  OperationalTableCard,
} from '../../../components/ui/operational-page';
import {
  MasterDataFormActions,
  MasterDataCurrencyInput,
  MasterDataDialogBody,
  MasterDataFormDialogContent,
  MasterDataFormField,
  MasterDataFormGrid,
  MasterDataFormHeader,
  MasterDataFieldLabel,
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

interface ForwardedOperationalExpenseRow {
  id: string;
  expense_date: string;
  branch_id?: string | null;
  category: string;
  subcategory?: string | null;
  vendor_name?: string | null;
  description?: string | null;
  amount: number;
  payment_source?: string | null;
  source_type?: string | null;
  source_ref?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

type ExpenseTab = 'schedule' | 'unpaid' | 'paid';

interface RecurringExpensesTabProps {
  currentRole: Role;
}

const todayDateInput = () => new Date().toISOString().slice(0, 10);
const RECURRING_EXPENSE_PAYMENTS_URL = buildMakeServerUrl('/finance/recurring-expense-payments');

const RECURRING_CATEGORY_OPTIONS: Array<{ label: string; value: RecurringExpense['category'] }> = [
  { value: 'operational', label: 'Operasional' },
  { value: 'rent', label: 'Sewa Tempat' },
  { value: 'salary', label: 'Gaji Karyawan' },
  { value: 'platform', label: 'Biaya Platform' },
  { value: 'marketing', label: 'Marketing / Iklan' },
  { value: 'other', label: 'Lainnya' },
];

const RECURRING_CYCLE_OPTIONS: Array<{ label: string; value: RecurringExpense['cycle'] }> = [
  { value: 'monthly', label: 'Bulanan' },
  { value: 'yearly', label: 'Tahunan' },
  { value: 'one_time', label: 'Sekali Bayar' },
];

const getRecurringCategoryLabel = (value?: string | null) =>
  RECURRING_CATEGORY_OPTIONS.find((option) => option.value === value)?.label || value || '-';

const getRecurringCycleLabel = (value?: string | null) =>
  RECURRING_CYCLE_OPTIONS.find((option) => option.value === value)?.label || '-';

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

const getRecurringExpenseSourceRef = (expenseId: string, periodKey: string) =>
  `recurring:${expenseId}:${periodKey}`;

const parseRecurringExpenseSourceRef = (sourceRef?: string | null) => {
  const match = String(sourceRef || '').match(/^recurring:([^:]+):(\d{4}-\d{2})$/);
  if (!match) return null;

  return {
    recurringExpenseId: match[1],
    periodKey: match[2],
  };
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

const DetailRow = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className="masterDataDetailRow">
    <span className="masterDataDetailLabel">{label}</span>
    <span className="masterDataDetailValue">{value || '-'}</span>
  </div>
);

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
  const [forwardedOperationalExpenses, setForwardedOperationalExpenses] = useState<ForwardedOperationalExpenseRow[]>([]);
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
  const [statusUpdatingIds, setStatusUpdatingIds] = useState<Set<string>>(() => new Set());
  
  const { branches, currentUser } = useMasterData();
  const { hasPermission } = usePermissions();
  const isMobile = useIsMobile();

  const canAdd = hasPermission('recurring_expenses.create');
  const canEdit = hasPermission('recurring_expenses.edit');
  const canDelete = hasPermission('recurring_expenses.delete');
  const canPay = hasPermission('recurring_expenses.pay');
  const canViewOperationalExpense = hasPermission('operational_expenses.view');
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

  const forwardedPayments = useMemo<RecurringExpensePayment[]>(() => {
    return forwardedOperationalExpenses.reduce<RecurringExpensePayment[]>((rows, row) => {
      const parsed = parseRecurringExpenseSourceRef(row.source_ref);
      if (!parsed) return rows;

      const expense = expenses.find((item) => item.id === parsed.recurringExpenseId);
      const dueDate = expense ? getDueDateForPeriod(expense, parsed.periodKey) : row.expense_date;

      rows.push({
          id: `operational-${row.id}`,
          recurring_expense_id: parsed.recurringExpenseId,
          period_key: parsed.periodKey,
          due_date: dueDate,
          paid_at: row.expense_date,
          amount: Number(row.amount) || 0,
          payment_source: row.payment_source || '',
          operational_category: row.category,
          operational_subcategory: row.subcategory || '',
          vendor_name: row.vendor_name || expense?.name || '',
          notes: row.notes || row.description || '',
          proof_url: '',
          operational_expense_id: row.id,
          status: 'paid',
          paid_by: null,
          paid_by_name: 'Biaya Operasional',
          created_at: row.created_at || undefined,
      });

      return rows;
    }, []);
  }, [expenses, forwardedOperationalExpenses]);

  const effectivePayments = useMemo(() => {
    const rows = new Map<string, RecurringExpensePayment>();

    [...forwardedPayments, ...payments.filter((payment) => payment.status === 'paid')].forEach((payment) => {
      rows.set(`${payment.recurring_expense_id}:${payment.period_key}`, payment);
    });

    return Array.from(rows.values());
  }, [forwardedPayments, payments]);

  const paymentByPeriod = useMemo(() => {
    const rows = new Map<string, RecurringExpensePayment>();
    effectivePayments
      .filter((payment) => payment.status === 'paid')
      .forEach((payment) => {
        rows.set(`${payment.recurring_expense_id}:${payment.period_key}`, payment);
      });
    return rows;
  }, [effectivePayments]);

  const paymentsByExpense = useMemo(() => {
    const rows = new Map<string, RecurringExpensePayment[]>();
    effectivePayments
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
  }, [effectivePayments]);

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

      const [expensesResult, paymentsResult, forwardedResult] = await Promise.allSettled([
        supabase
          .from('recurring_expenses')
          .select('*')
          .order('created_at', { ascending: false }),
        fetchPayments(),
        canViewOperationalExpense
          ? supabase
              .from('operational_expenses')
              .select('id, expense_date, branch_id, category, subcategory, vendor_name, description, amount, payment_source, source_type, source_ref, notes, created_at')
              .eq('source_type', 'recurring')
              .order('expense_date', { ascending: false })
              .order('created_at', { ascending: false })
              .limit(500)
          : Promise.resolve({ data: [], error: null }),
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
        setPaymentHistoryError(null);
        console.warn(
          'Legacy recurring expense payment history unavailable. Operational expense ledger will be used instead:',
          paymentsResult.status === 'rejected' ? paymentsResult.reason : 'Endpoint history pembayaran rutin belum aktif.',
        );
      }

      if (forwardedResult.status === 'fulfilled' && !forwardedResult.value.error) {
        setForwardedOperationalExpenses((forwardedResult.value.data || []) as ForwardedOperationalExpenseRow[]);
      } else {
        setForwardedOperationalExpenses([]);
        if (forwardedResult.status === 'rejected') {
          console.warn('Recurring operational expense ledger query failed:', forwardedResult.reason);
        } else if (forwardedResult.value.error) {
          console.warn('Recurring operational expense ledger query failed:', forwardedResult.value.error);
        }
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
  }, [canViewOperationalExpense]);

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
  const paidRows = effectivePayments
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
        payment.operational_expense_id,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchQuery));
    });

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

  const forwardToOperationalExpenseForm = (item: RecurringExpense) => {
    if (!canPay) {
      toast.error('Akses bayar Pengeluaran Rutin belum aktif untuk akun ini.');
      return;
    }

    if (!canCreateOperationalExpense) {
      toast.error('Akses tambah Biaya Operasional belum aktif untuk akun ini.');
      return;
    }

    if (isPaidForPeriod(item)) {
      toast.info('Tagihan periode ini sudah tercatat di Biaya Operasional.');
      return;
    }

    if (typeof window === 'undefined') return;

    const defaultAccount = getDefaultOperationalAccount(item.category);
    const dueDate = getDueDateForPeriod(item, currentPeriodKey);
    const periodLabel = formatPeriodLabel(currentPeriodKey);
    const sourceRef = getRecurringExpenseSourceRef(item.id, currentPeriodKey);

    const draft: OperationalExpenseForwardDraft = {
      source: 'recurring-expense',
      source_type: 'recurring',
      transaction_id: item.id,
      recurring_expense_id: item.id,
      period_key: currentPeriodKey,
      due_date: dueDate,
      expense_date: todayDateInput(),
      branch_id: item.branch_id || '',
      category: defaultAccount?.category || 'Beban Operasional',
      subcategory: defaultAccount?.subcategory || 'Biaya Utilitas',
      vendor_name: item.name,
      description: `Pembayaran rutin ${item.name} periode ${periodLabel}`,
      amount: String(item.amount || ''),
      payment_source: item.bank_name ? `Transfer ${item.bank_name}` : '',
      source_ref: sourceRef,
      notes: item.description || '',
      auto_save: false,
      created_at: new Date().toISOString(),
    };

    try {
      window.localStorage.setItem(OPERATIONAL_EXPENSE_FORWARD_DRAFT_KEY, JSON.stringify(draft));
      window.location.assign('/finance/operational-expenses?draft=recurring-expense');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Draft tidak bisa disimpan.';
      toast.error(`Gagal membuka form Biaya Operasional: ${message}`);
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
       <form onSubmit={handleSubmit} className="masterDataManagedForm recurringExpenseManagedForm">
         <MasterDataDialogBody>
           <MasterDataFormGrid>
             <MasterDataFormField span="full">
               <MasterDataFieldLabel required>Nama Pengeluaran</MasterDataFieldLabel>
               <Input
                 required
                 value={formData.name || ''}
                 onChange={e => setFormData({ ...formData, name: e.target.value })}
                 placeholder="Contoh: Sewa Ruko, Internet Indihome"
               />
             </MasterDataFormField>

             <MasterDataFormField span="half">
               <MasterDataFieldLabel required>Kategori</MasterDataFieldLabel>
               <Select
                 value={formData.category}
                 onValueChange={val => setFormData({ ...formData, category: val })}
               >
                 <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                 <SelectContent>
                   {RECURRING_CATEGORY_OPTIONS.map((option) => (
                     <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </MasterDataFormField>

             <MasterDataFormField span="half">
               <MasterDataFieldLabel required>Estimasi Nominal</MasterDataFieldLabel>
               <MasterDataCurrencyInput
                 value={formData.amount || ''}
                 onValueChange={(value) => setFormData({ ...formData, amount: Number(value) })}
                 placeholder="0"
               />
             </MasterDataFormField>

             <MasterDataFormField span="half">
               <MasterDataFieldLabel required>Siklus Pembayaran</MasterDataFieldLabel>
               <Select
                 value={formData.cycle}
                 onValueChange={val => setFormData({ ...formData, cycle: val as RecurringExpense['cycle'] })}
               >
                 <SelectTrigger><SelectValue placeholder="Pilih siklus" /></SelectTrigger>
                 <SelectContent>
                   {RECURRING_CYCLE_OPTIONS.map((option) => (
                     <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </MasterDataFormField>

             <MasterDataFormField span="half">
               <MasterDataFieldLabel
                 required
                 info={{
                   title: 'Tanggal jatuh tempo',
                   description: 'Isi angka 1 sampai 31. Untuk bulan yang lebih pendek, sistem otomatis memakai tanggal terakhir bulan itu.',
                 }}
               >
                 Tanggal Jatuh Tempo
               </MasterDataFieldLabel>
               <Input
                 type="number"
                 min="1"
                 max="31"
                 value={formData.due_date || 1}
                 onChange={e => setFormData({ ...formData, due_date: Number(e.target.value) })}
                 placeholder="Tgl 1-31"
               />
             </MasterDataFormField>

             <MasterDataFormField span="half">
               <MasterDataFieldLabel optional>Cabang</MasterDataFieldLabel>
               <Select
                 value={formData.branch_id || 'all'}
                 onValueChange={val => setFormData({ ...formData, branch_id: val })}
               >
                 <SelectTrigger><SelectValue placeholder="Pilih Cabang" /></SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">Umum / tanpa cabang</SelectItem>
                   {activeBranches.map((branch: any) => (
                     <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </MasterDataFormField>

             <MasterDataFormField span="half">
               <MasterDataFieldLabel optional>No. WhatsApp</MasterDataFieldLabel>
               <Input
                 value={formData.whatsapp || ''}
                 onChange={e => {
                   const val = e.target.value.replace(/\D/g, '');
                   setFormData({ ...formData, whatsapp: val });
                 }}
                 placeholder="Contoh: 08123456789"
               />
             </MasterDataFormField>

             <MasterDataFormField span="half">
               <MasterDataFieldLabel optional>Nama Bank</MasterDataFieldLabel>
               <Input
                 value={formData.bank_name || ''}
                 onChange={e => setFormData({ ...formData, bank_name: e.target.value })}
                 placeholder="BCA, Mandiri, Bank Jago..."
               />
             </MasterDataFormField>

             <MasterDataFormField span="half">
               <MasterDataFieldLabel optional>No. Rekening</MasterDataFieldLabel>
               <Input
                 value={formData.account_number || ''}
                 onChange={e => setFormData({ ...formData, account_number: e.target.value })}
                 placeholder="123xxxx"
               />
             </MasterDataFormField>

             <MasterDataFormField span="half">
               <MasterDataFieldLabel optional>Atas Nama</MasterDataFieldLabel>
               <Input
                 value={formData.account_name || ''}
                 onChange={e => setFormData({ ...formData, account_name: e.target.value })}
                 placeholder="Nama pemilik rekening"
               />
             </MasterDataFormField>

             <MasterDataFormField span="half">
               <MasterDataFieldLabel>Status</MasterDataFieldLabel>
               <Select
                 value={formData.status}
                 onValueChange={val => setFormData({ ...formData, status: val as RecurringExpense['status'] })}
               >
                 <SelectTrigger><SelectValue /></SelectTrigger>
                 <SelectContent>
                   <SelectItem value="active">Aktif</SelectItem>
                   <SelectItem value="inactive">Tidak Aktif</SelectItem>
                 </SelectContent>
               </Select>
             </MasterDataFormField>

             <MasterDataFormField span="full">
               <MasterDataFieldLabel optional>Keterangan</MasterDataFieldLabel>
               <Textarea
                 value={formData.description || ''}
                 onChange={e => setFormData({ ...formData, description: e.target.value })}
                 placeholder="Catatan tambahan..."
                 rows={4}
               />
             </MasterDataFormField>
           </MasterDataFormGrid>
         </MasterDataDialogBody>

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
    const branchName = item.branch_id ? branches.find(b => b.id === item.branch_id)?.name : 'Umum / tanpa cabang';
    const statusMeta = getExpenseStatus(item);
    const isPaid = statusMeta.status === 'paid';
    const dueDate = statusMeta.displayDueDate;
    const nextDueDate = statusMeta.nextDueDate;
    const isStatusUpdating = statusUpdatingIds.has(item.id);
    const paymentActionDisabled = !canCreateOperationalExpense;

    return (
      <TableRow
        key={item.id}
        className="recurringExpenseClickableRow"
        tabIndex={0}
        onClick={() => setViewingItem(item)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setViewingItem(item);
          }
        }}
      >
        <TableCell className="recurringExpenseNumberCell">{index + 1}</TableCell>
        <TableCell>
          <TableText
            primary={item.name}
            secondary={item.description || 'Pengeluaran rutin'}
            title={`${item.name}${item.description ? ` - ${item.description}` : ''}`}
          />
        </TableCell>
        <TableCell>
          <TableText
            primary={getRecurringCategoryLabel(item.category)}
            secondary={`${getRecurringCycleLabel(item.cycle)} - ${branchName || '-'}`}
          />
        </TableCell>
        <TableCell className="recurringExpenseAmountCell">
          {item.amount > 0 ? formatCurrency(item.amount) : '-'}
        </TableCell>
        <TableCell>
          {isPaid ? (
            <TableText
              primary={`Dibayar ${formatDateLabel(statusMeta.paidAt)}`}
              secondary={`Tempo ${formatDateLabel(dueDate)} - berikutnya ${nextDueDate ? formatDateLabel(nextDueDate) : '-'}`}
            />
          ) : (
            <div className="recurringExpenseDueStack">
              <TableText
                primary={formatDateLabel(dueDate)}
                secondary={nextDueDate ? `Berikutnya ${formatDateLabel(nextDueDate)}` : 'Jatuh tempo'}
              />
              <Badge variant="outline" className={cn('recurringExpenseDueBadge', statusMeta.color)}>
                <Clock className="mr-1.5 h-3 w-3" />
                {statusMeta.label}
              </Badge>
            </div>
          )}
        </TableCell>
        <TableCell>
          <TableText
            primary={item.account_number ? `${item.bank_name || 'Bank'} ${item.account_number}` : item.whatsapp || '-'}
            secondary={
              item.account_number
                ? [item.account_name ? `a.n ${item.account_name}` : '', item.whatsapp ? `WA ${item.whatsapp}` : ''].filter(Boolean).join(' - ')
                : 'Kontak / rekening belum diisi'
            }
          />
        </TableCell>
        <TableStatusCell>
          <TableStatusSwitch
            checked={item.status === 'active'}
            loading={isStatusUpdating}
            disabled={!canEdit}
            onClick={(event) => {
              event.stopPropagation();
              if (!canEdit || isStatusUpdating) return;
              void handleToggleStatus(item, item.status !== 'active');
            }}
            onLabel="Aktif"
            offLabel="Nonaktif"
          />
        </TableStatusCell>
        <TableActionCell onClick={(event) => event.stopPropagation()}>
          {isPaid ? (
            <Badge className="recurringExpenseClearBadge" variant="outline">
              <CheckCircle2 className="mr-1.5 h-3 w-3" />
              Clear
            </Badge>
          ) : item.status === 'active' && canPay ? (
            <Button
              size="sm"
              variant={paymentActionDisabled ? 'outline' : 'default'}
              className={cn('recurringExpensePayButton', paymentActionDisabled && 'isDisabled')}
              disabled={paymentActionDisabled}
              onClick={(event) => {
                event.stopPropagation();
                forwardToOperationalExpenseForm(item);
              }}
              title={!canCreateOperationalExpense ? 'Butuh akses tambah Biaya Operasional.' : undefined}
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
            actionWidth={154}
            cellY={14}
            className="recurringExpenseDataTable"
            columns={[64, 330, 240, 170, 260, 290, 136, 154]}
            minWidth={1644}
            rowMinHeight={82}
            secondaryLines={2}
          >
            <table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Pengeluaran</TableHead>
                  <TableHead>Kategori / Cabang</TableHead>
                  <TableHead>Nominal</TableHead>
                  <TableHead>Tempo Pembayaran</TableHead>
                  <TableHead>Rekening / Kontak</TableHead>
                  <TableHead>Status</TableHead>
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
          description="Transaksi yang sudah dicatat ada di tab History Transaksi."
        />
      ) : (
        <DataTable
          actionWidth={154}
          cellY={14}
          className="recurringExpenseDataTable"
          columns={[64, 330, 240, 170, 260, 290, 136, 154]}
          minWidth={1644}
          rowMinHeight={82}
          secondaryLines={2}
        >
          <table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Pengeluaran</TableHead>
                <TableHead>Kategori / Cabang</TableHead>
                <TableHead>Nominal</TableHead>
                <TableHead>Tempo Pembayaran</TableHead>
                <TableHead>Rekening / Kontak</TableHead>
                <TableHead>Status</TableHead>
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
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">History Transaksi - {currentPeriodKey}</h3>
          <p className="text-sm text-slate-500">Transaksi rutin yang sudah tersimpan di Biaya Operasional.</p>
        </div>
        <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">
          {paidRows.length} clear
        </Badge>
      </div>
      {paidRows.length === 0 ? (
        <OperationalEmptyState
          icon={Wallet}
          title="Belum ada pembayaran bulan ini"
          description="Transaksi akan muncul di sini setelah form Biaya Operasional disimpan."
        />
      ) : (
        <DataTable
          actionWidth={86}
          cellY={14}
          className="recurringExpenseDataTable"
          columns={[64, 300, 210, 210, 260, 190, 170, 150, 86]}
          minWidth={1640}
          rowMinHeight={82}
          secondaryLines={2}
        >
          <table>
            <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Tagihan</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Tagihan Selanjutnya</TableHead>
                  <TableHead>Kategori Operasional</TableHead>
                  <TableHead>Sumber Dana</TableHead>
                  <TableHead>Nominal</TableHead>
                  <TableHead>Bukti / Input</TableHead>
                  <TableActionHeader />
                </TableRow>
            </TableHeader>
            <TableBody>
              {paidRows.map((payment, index) => {
                const expense = expenses.find((item) => item.id === payment.recurring_expense_id);
                const dueDate = payment.due_date || (expense ? getDueDateForPeriod(expense, payment.period_key) : null);
                const nextDueDate = expense ? getNextDueDateAfterPeriod(expense, payment.period_key) : null;
                return (
                  <TableRow
                    key={payment.id}
                    className="recurringExpenseClickableRow"
                    tabIndex={0}
                    onClick={() => setViewingPayment(payment)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setViewingPayment(payment);
                      }
                    }}
                  >
                    <TableCell className="recurringExpenseNumberCell">{index + 1}</TableCell>
                    <TableCell>
                      <TableText
                        primary={expense?.name || payment.vendor_name || 'Pengeluaran rutin'}
                        secondary={`Periode ${formatPeriodLabel(payment.period_key)}${payment.operational_expense_id ? ` - Ledger ${payment.operational_expense_id.slice(0, 8)}` : ''}`}
                      />
                    </TableCell>
                    <TableCell>
                      <TableText
                        primary={`Bayar ${formatDateLabel(payment.paid_at)}`}
                        secondary={`Tempo ${formatDateLabel(dueDate)}`}
                      />
                    </TableCell>
                    <TableCell>
                      <TableText
                        primary={nextDueDate ? formatDateLabel(nextDueDate) : 'Selesai'}
                        secondary={nextDueDate ? 'Tagihan berikutnya' : 'Tidak ada periode berikutnya'}
                      />
                    </TableCell>
                    <TableCell>
                      <TableText
                        primary={payment.operational_category || '-'}
                        secondary={payment.operational_subcategory || '-'}
                      />
                    </TableCell>
                    <TableCell>
                      <TableText primary={payment.payment_source || '-'} secondary={payment.vendor_name || '-'} />
                    </TableCell>
                    <TableCell className="recurringExpenseAmountCell">{formatCurrency(payment.amount)}</TableCell>
                    <TableCell>
                      <TableText
                        primary={payment.proof_url ? 'Ada bukti' : 'Belum ada bukti'}
                        secondary={`Input: ${payment.paid_by_name || '-'}`}
                      />
                    </TableCell>
                    <TableActionCell onClick={(event) => event.stopPropagation()}>
                      <TableActionMenu contentClassName="w-48">
                        <TableActionMenuItem icon={Eye} onClick={() => setViewingPayment(payment)}>
                          Lihat Detail
                        </TableActionMenuItem>
                      </TableActionMenu>
                    </TableActionCell>
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
  const viewingItemStatus = viewingItem ? getExpenseStatus(viewingItem) : null;
  const viewingItemNextDueDate = viewingItemStatus?.nextDueDate || null;
  const viewingItemHistory = viewingItem ? getPaymentHistoryForItem(viewingItem).slice(0, 5) : [];
  const viewingItemBranchName = viewingItem?.branch_id
    ? branches.find((branch) => branch.id === viewingItem.branch_id)?.name || '-'
    : 'Umum / tanpa cabang';

  return (
    <div className="masterDataTabSurface recurringExpensesPage">
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
            { id: 'paid' as const, label: 'History Transaksi', count: paidRows.length },
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
        <MasterDataFormDialogContent size="wide" className="recurringExpenseFormDialog">
          <MasterDataFormHeader
            icon={ReceiptText}
            title={editingItem ? 'Edit Pengeluaran Rutin' : 'Tambah Pengeluaran Rutin'}
            description="Kelola tagihan berulang, nominal estimasi, cabang, kontak vendor, dan rekening pembayaran."
          />
          <ExpenseForm
            item={editingItem}
            onClose={expenseFormCloseGuard.requestClose}
            onDirtyChange={setExpenseFormDirty}
            onSaved={closeExpenseFormDialog}
          />
        </MasterDataFormDialogContent>
        <MasterDataUnsavedChangesDialog
          open={expenseFormCloseGuard.isConfirmOpen}
          onCancel={expenseFormCloseGuard.cancelClose}
          onConfirm={expenseFormCloseGuard.confirmClose}
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
        <MasterDataFormDialogContent size="default" className="recurringExpenseDetailDialog">
          <MasterDataFormHeader
            icon={CheckCircle2}
            title="Detail Transaksi Rutin"
            description="Ringkasan pembayaran, ledger biaya operasional, dan bukti pendukung."
          />

          {viewingPayment && (
            <MasterDataDialogBody compact>
              <div className="recurringExpenseDetailHero">
                <div>
                  <span>{formatPeriodLabel(viewingPayment.period_key)}</span>
                  <h3>{viewingPaymentExpense?.name || viewingPayment.vendor_name || 'Pengeluaran rutin'}</h3>
                  <p>
                    {viewingPayment.operational_expense_id
                      ? `Ledger Biaya Operasional ${viewingPayment.operational_expense_id.slice(0, 8)}`
                      : 'Belum ada link ledger operasional'}
                  </p>
                </div>
                <span className="recurringExpenseStatusPill isActive">
                  <TableStatusIcon label="Lunas" tone="active" />
                  Lunas
                </span>
              </div>

              <div className="masterDataDetailRows">
                <DetailRow label="Tanggal bayar" value={formatDateLabel(viewingPayment.paid_at)} />
                <DetailRow label="Jatuh tempo" value={formatDateLabel(viewingPaymentDueDate)} />
                <DetailRow label="Tagihan berikutnya" value={viewingPaymentNextDueDate ? formatDateLabel(viewingPaymentNextDueDate) : 'Selesai'} />
                <DetailRow label="Nominal" value={formatCurrency(viewingPayment.amount)} />
                <DetailRow label="Kategori" value={viewingPayment.operational_category || '-'} />
                <DetailRow label="Sub Kategori" value={viewingPayment.operational_subcategory || '-'} />
                <DetailRow label="Sumber dana" value={viewingPayment.payment_source || '-'} />
                <DetailRow label="Input oleh" value={viewingPayment.paid_by_name || '-'} />
              </div>

              {viewingPayment.notes && (
                <div className="recurringExpenseDetailNote">
                  <span>Catatan</span>
                  {viewingPayment.notes}
                </div>
              )}

              <div className="recurringExpenseDetailCard">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="recurringExpenseDetailCardTitle">Bukti Transfer</p>
                    <p className="recurringExpenseDetailCardText">
                      {viewingPayment.proof_url ? 'Bukti tersimpan untuk pembayaran ini.' : 'Belum ada bukti transfer.'}
                    </p>
                  </div>
                  {viewingPayment.proof_url ? (
                    <a
                      href={viewingPayment.proof_url}
                      target="_blank"
                      rel="noreferrer"
                      className="recurringExpenseDetailLink"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Buka Bukti
                    </a>
                  ) : null}
                </div>
                {viewingPayment.proof_url ? (
                  <div className="recurringExpenseProofPreview">
                    <img
                      src={viewingPayment.proof_url}
                      alt="Bukti transfer"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                ) : null}
              </div>

              <div className="masterDataFormActions">
                <Button type="button" variant="outline" onClick={() => setViewingPayment(null)}>Tutup</Button>
              </div>
            </MasterDataDialogBody>
          )}
        </MasterDataFormDialogContent>
      </Dialog>
      
      {/* View Detail Modal */}
      <Dialog open={!!viewingItem} onOpenChange={(open) => !open && setViewingItem(null)}>
        <MasterDataFormDialogContent size="wide" className="recurringExpenseDetailDialog">
          <MasterDataFormHeader
            icon={ReceiptText}
            title="Detail Pengeluaran Rutin"
            description="Ringkasan jadwal, rekening, dan history transaksi pengeluaran rutin."
          />
          
          {viewingItem && (
            <MasterDataDialogBody compact>
              <div className="recurringExpenseDetailLayout">
                <section className="recurringExpenseDetailMain" aria-label="Ringkasan pengeluaran rutin">
                  <div className="recurringExpenseDetailHero">
                    <div>
                      <span>{getRecurringCategoryLabel(viewingItem.category)}</span>
                      <h3>{viewingItem.name}</h3>
                      <p>{viewingItem.description || 'Pengeluaran rutin'}</p>
                    </div>
                    <span className={cn('recurringExpenseStatusPill', viewingItem.status === 'active' ? 'isActive' : 'isInactive')}>
                      <TableStatusIcon
                        label={viewingItem.status === 'active' ? 'Aktif' : 'Nonaktif'}
                        tone={viewingItem.status === 'active' ? 'active' : 'inactive'}
                      />
                      {viewingItem.status === 'active' ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>

                  <div className="masterDataDetailRows">
                    <DetailRow label="Nominal" value={formatCurrency(viewingItem.amount)} />
                    <DetailRow label="Siklus" value={getRecurringCycleLabel(viewingItem.cycle)} />
                    <DetailRow label="Cabang" value={viewingItemBranchName} />
                    <DetailRow label="Jatuh tempo" value={`${formatDateLabel(viewingItemStatus?.displayDueDate)} - tgl ${viewingItem.due_date}`} />
                    <DetailRow label="Tagihan berikutnya" value={viewingItemNextDueDate ? formatDateLabel(viewingItemNextDueDate) : '-'} />
                  </div>

                  <div className="recurringExpenseDetailCard">
                    <p className="recurringExpenseDetailCardTitle">Rekening Pembayaran</p>
                    {viewingItem.account_number ? (
                      <div className="recurringExpenseBankCard">
                        <span>{viewingItem.bank_name || 'Bank'}</span>
                        <strong>{viewingItem.account_number}</strong>
                        <small>{viewingItem.account_name ? `a.n ${viewingItem.account_name}` : 'Atas nama belum diisi'}</small>
                      </div>
                    ) : (
                      <p className="recurringExpenseDetailCardText">Belum ada rekening pembayaran.</p>
                    )}
                    {viewingItem.whatsapp ? (
                      <div className="masterDataDetailRows recurringExpenseMiniRows">
                        <DetailRow label="WhatsApp" value={viewingItem.whatsapp} />
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="recurringExpenseDetailCard recurringExpenseHistoryPanel" aria-label="History transaksi">
                  <div className="recurringExpenseHistoryHeader">
                    <div>
                      <p className="recurringExpenseDetailCardTitle">History Transaksi</p>
                      <p className="recurringExpenseDetailCardText">5 transaksi terakhir yang sudah masuk Biaya Operasional.</p>
                    </div>
                    <Badge variant="outline" className="recurringExpenseClearBadge">
                      {viewingItemHistory.length} data
                    </Badge>
                  </div>
                  {viewingItemHistory.length > 0 ? (
                    <div className="recurringExpenseHistoryList">
                      {viewingItemHistory.map((payment) => (
                        <button
                          key={payment.id}
                          type="button"
                          className="recurringExpenseHistoryItem"
                          onClick={() => {
                            setViewingItem(null);
                            setViewingPayment(payment);
                          }}
                        >
                          <span>
                            <strong>{formatPeriodLabel(payment.period_key)}</strong>
                            <small>
                              Tempo {formatDateLabel(payment.due_date || getDueDateForPeriod(viewingItem, payment.period_key))}
                              {' - '}
                              dibayar {formatDateLabel(payment.paid_at)}
                              {payment.payment_source ? ` via ${payment.payment_source}` : ''}
                            </small>
                          </span>
                          <b>{formatCurrency(payment.amount)}</b>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="recurringExpenseEmptyDetail">Belum ada history transaksi.</div>
                  )}
                </section>
              </div>

              <div className="masterDataFormActions">
                <Button type="button" variant="outline" onClick={() => setViewingItem(null)}>Tutup</Button>
                {canEdit && (
                  <Button
                    type="button"
                    onClick={() => {
                      setEditingItem(viewingItem);
                      setExpenseFormDirty(false);
                      setViewingItem(null);
                      setIsAddOpen(true);
                    }}
                  >
                    Edit Pengeluaran
                  </Button>
                )}
              </div>
            </MasterDataDialogBody>
          )}
        </MasterDataFormDialogContent>
      </Dialog>
    </div>
  );
};
