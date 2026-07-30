import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Building2,
  CalendarRange,
  ClipboardList,
  Edit,
  Eye,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  ReceiptText,
  Search,
  Trash2,
  WalletCards,
} from 'lucide-react';
import { toast } from 'sonner';
import { buildMakeServerUrl } from '@/app/services/internal/functionsBaseUrl';
import { getSessionBackedEdgeHeaders } from '@/app/services/internal/sessionClientHeaders';
import { DEFAULT_OPERATIONAL_EXPENSE_ONLY_ACCOUNTS } from '@/app/data/operationalExpenseAccounts';
import {
  OPERATIONAL_EXPENSE_FORWARD_DRAFT_KEY,
  type OperationalExpenseForwardDraft,
} from '@/app/data/operationalExpenseForwardDraft';
import { usePermissions } from '../hooks/usePermissions';
import { useMasterData } from './master-data/context';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

type OperationalExpenseCategory = {
  id: string;
  category: string;
  subcategory: string;
  account_code?: string;
  account_type?: 'income' | 'expense' | 'cogs';
  description?: string;
  sort_order?: number;
};

type OperationalExpenseRow = {
  id: string;
  expense_date: string;
  period_key: string;
  branch_id?: string | null;
  branch_name?: string;
  category: string;
  subcategory?: string;
  vendor_name?: string;
  description?: string;
  amount: number;
  payment_source?: string;
  source_type?: string;
  source_ref?: string;
  notes?: string;
  status: 'active' | 'void';
  void_reason?: string;
  created_at?: string;
};

type Summary = {
  totalAmount: number;
  transactionCount: number;
  averageAmount: number;
  categoryCount: number;
  subcategoryCount: number;
};

type FormState = {
  id?: string;
  expense_date: string;
  branch_id: string;
  category: string;
  subcategory: string;
  vendor_name: string;
  description: string;
  amount: string;
  payment_source: string;
  source_type: string;
  source_ref: string;
  notes: string;
};

type OperationalExpensePayload = {
  expense_date: string;
  branch_id: string;
  category: string;
  subcategory: string;
  vendor_name: string;
  description: string;
  amount: number;
  payment_source: string;
  source_type: string;
  source_ref: string;
  notes: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const OPERATIONAL_EXPENSES_URL = buildMakeServerUrl('/finance/operational-expenses');
const OPERATIONAL_EXPENSE_CATEGORIES_URL = buildMakeServerUrl('/finance/operational-expense-categories');
const EMPTY_SUMMARY: Summary = {
  totalAmount: 0,
  transactionCount: 0,
  averageAmount: 0,
  categoryCount: 0,
  subcategoryCount: 0,
};

const EMPTY_FORM: FormState = {
  expense_date: today(),
  branch_id: 'all',
  category: '',
  subcategory: '',
  vendor_name: '',
  description: '',
  amount: '',
  payment_source: '',
  source_type: 'manual',
  source_ref: '',
  notes: '',
};

const buildOperationalExpensePayloadFromForm = (source: FormState): OperationalExpensePayload => ({
  expense_date: source.expense_date,
  branch_id: source.branch_id === 'all' ? '' : source.branch_id,
  category: source.category,
  subcategory: source.subcategory,
  vendor_name: source.vendor_name,
  description: source.description,
  amount: Number(source.amount),
  payment_source: source.payment_source,
  source_type: source.source_type || 'manual',
  source_ref: source.source_ref,
  notes: source.notes,
});

const buildFormFromForwardDraft = (draft: OperationalExpenseForwardDraft): FormState => ({
  ...EMPTY_FORM,
  expense_date: draft.expense_date || today(),
  branch_id: draft.branch_id || 'all',
  category: draft.category || '',
  subcategory: draft.subcategory || '',
  vendor_name: draft.vendor_name || '',
  description: draft.description || '',
  amount: String(draft.amount || ''),
  payment_source: draft.payment_source || '',
  source_type: draft.source_type || 'manual',
  source_ref: draft.source_ref || '',
  notes: draft.notes || '',
});

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: await getSessionBackedEdgeHeaders({
      includeJsonContentType: Boolean(options.body),
      headers: options.headers,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404 && url.includes('/finance/operational-expense')) {
      throw new Error('Endpoint Biaya Operasional belum tersedia di server. Deploy migration dan function terbaru dulu.');
    }
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }

  return payload as T;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatDate = (value?: string) => {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export function Kas() {
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const { branches } = useMasterData();
  const canView = hasPermission('operational_expenses.view');
  const canCreate = hasPermission('operational_expenses.create');
  const canEdit = hasPermission('operational_expenses.edit');
  const canDelete = hasPermission('operational_expenses.delete');

  const [rows, setRows] = useState<OperationalExpenseRow[]>([]);
  const [categories, setCategories] = useState<OperationalExpenseCategory[]>([]);
  const lastLoadErrorRef = useRef('');
  const forwardDraftAppliedRef = useRef(false);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<OperationalExpenseRow | null>(null);
  const [voidRow, setVoidRow] = useState<OperationalExpenseRow | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    endDate: today(),
    branchId: 'all',
    category: 'all',
    subcategory: 'all',
    q: '',
  });

  const categoryOptions = useMemo(
    () => Array.from(new Set(categories.map((item) => item.category).filter(Boolean))),
    [categories],
  );

  const subcategoryOptions = useMemo(() => {
    const source = filters.category === 'all'
      ? categories
      : categories.filter((item) => item.category === filters.category);
    return Array.from(new Set(source.map((item) => item.subcategory).filter(Boolean)));
  }, [categories, filters.category]);

  const formSubcategoryOptions = useMemo(() => {
    const source = form.category
      ? categories.filter((item) => item.category === form.category)
      : categories;
    return Array.from(new Set(source.map((item) => item.subcategory).filter(Boolean)));
  }, [categories, form.category]);

  const buildParams = (includePaging = true) => {
    const params = new URLSearchParams();
    if (includePaging) {
      params.set('page', '1');
      params.set('limit', '100');
    }
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.branchId !== 'all') params.set('branch_id', filters.branchId);
    if (filters.category !== 'all') params.set('category', filters.category);
    if (filters.subcategory !== 'all') params.set('subcategory', filters.subcategory);
    if (filters.q.trim()) params.set('q', filters.q.trim());
    return params;
  };

  const findExistingForwardedExpense = async (sourceRef: string) => {
    if (!sourceRef.trim()) return null;

    const params = new URLSearchParams({
      page: '1',
      limit: '20',
      q: sourceRef,
      status: 'active',
    });
    const result = await fetchJson<{ data: OperationalExpenseRow[] }>(`${OPERATIONAL_EXPENSES_URL}?${params.toString()}`);
    return (result.data || []).find((row) => row.source_ref === sourceRef) || null;
  };

  const saveOperationalExpensePayload = async (payload: OperationalExpensePayload, id?: string) => {
    return fetchJson(id ? `${OPERATIONAL_EXPENSES_URL}/${id}` : OPERATIONAL_EXPENSES_URL, {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
  };

  const refreshData = async () => {
    if (!canView) return;
    setLoading(true);
    const [categoryResult, listResult, summaryResult] = await Promise.allSettled([
      fetchJson<OperationalExpenseCategory[]>(`${OPERATIONAL_EXPENSE_CATEGORIES_URL}?accountType=expense`),
      fetchJson<{ data: OperationalExpenseRow[] }>(`${OPERATIONAL_EXPENSES_URL}?${buildParams(true)}`),
      fetchJson<Summary>(`${OPERATIONAL_EXPENSES_URL}/summary?${buildParams(false)}`),
    ]);

    if (categoryResult.status === 'fulfilled') {
      setCategories(categoryResult.value);
    } else {
      setCategories(DEFAULT_OPERATIONAL_EXPENSE_ONLY_ACCOUNTS);
    }

    if (listResult.status === 'fulfilled') {
      setRows(listResult.value.data || []);
    } else {
      setRows([]);
    }

    if (summaryResult.status === 'fulfilled') {
      const summaryPayload = summaryResult.value;
      setSummary({
        totalAmount: Number(summaryPayload.totalAmount) || 0,
        transactionCount: Number(summaryPayload.transactionCount) || 0,
        averageAmount: Number(summaryPayload.averageAmount) || 0,
        categoryCount: Number(summaryPayload.categoryCount) || 0,
        subcategoryCount: Number(summaryPayload.subcategoryCount) || 0,
      });
    } else {
      setSummary(EMPTY_SUMMARY);
    }

    const failed = [categoryResult, listResult, summaryResult].find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined;
    if (failed) {
      const message = failed.reason instanceof Error ? failed.reason.message : 'Gagal memuat biaya operasional';
      setLoadError(message);
      if (message !== lastLoadErrorRef.current) {
        toast.error(message);
        lastLoadErrorRef.current = message;
      }
    } else {
      setLoadError(null);
      lastLoadErrorRef.current = '';
    }

    setLoading(false);
  };

  useEffect(() => {
    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, filters.startDate, filters.endDate, filters.branchId, filters.category, filters.subcategory]);

  useEffect(() => {
    if (forwardDraftAppliedRef.current || permissionsLoading || typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('draft') !== 'operational-report') return;

    forwardDraftAppliedRef.current = true;

    if (!canCreate) {
      toast.error('Akses tambah Biaya Operasional belum aktif untuk akun ini.');
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    const rawDraft = window.localStorage.getItem(OPERATIONAL_EXPENSE_FORWARD_DRAFT_KEY);
    if (!rawDraft) {
      toast.error('Draft Biaya Operasional tidak ditemukan.');
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    const applyForwardDraft = async () => {
      let hasReadableDraft = false;

      try {
        const draft = JSON.parse(rawDraft) as OperationalExpenseForwardDraft;
        const draftForm = buildFormFromForwardDraft(draft);
        hasReadableDraft = true;
        setForm(draftForm);

        if (draft.auto_save) {
          setSaving(true);
          const existingForward = draftForm.source_ref
            ? await findExistingForwardedExpense(draftForm.source_ref)
            : null;

          if (existingForward) {
            toast.info('Biaya Operasional dari transaksi ini sudah pernah dibuat.');
            setDialogOpen(false);
          } else {
            await saveOperationalExpensePayload(buildOperationalExpensePayloadFromForm(draftForm));
            toast.success('Biaya Operasional otomatis dibuat dari transaksi laporan.');
            setDialogOpen(false);
          }

          await refreshData();
          window.localStorage.removeItem(OPERATIONAL_EXPENSE_FORWARD_DRAFT_KEY);
          return;
        }

        setDialogOpen(true);
        window.localStorage.removeItem(OPERATIONAL_EXPENSE_FORWARD_DRAFT_KEY);
        toast.success('Draft Biaya Operasional dari transaksi laporan siap dilengkapi.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Draft Biaya Operasional tidak valid.';
        toast.error(`Forward otomatis gagal: ${message}`);
        setDialogOpen(hasReadableDraft);
        if (!hasReadableDraft) {
          window.localStorage.removeItem(OPERATIONAL_EXPENSE_FORWARD_DRAFT_KEY);
        }
      } finally {
        setSaving(false);
        window.history.replaceState(null, '', window.location.pathname);
      }
    };

    void applyForwardDraft();
  }, [canCreate, permissionsLoading]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, expense_date: today() });
    setDialogOpen(true);
  };

  const openEdit = (row: OperationalExpenseRow) => {
    setForm({
      id: row.id,
      expense_date: row.expense_date,
      branch_id: row.branch_id || 'all',
      category: row.category,
      subcategory: row.subcategory || '',
      vendor_name: row.vendor_name || '',
      description: row.description || '',
      amount: String(row.amount || ''),
      payment_source: row.payment_source || '',
      source_type: row.source_type || 'manual',
      source_ref: row.source_ref || '',
      notes: row.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.expense_date || !form.category || !form.amount || Number(form.amount) <= 0) {
      toast.error('Tanggal, kategori, dan nominal wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      await saveOperationalExpensePayload(buildOperationalExpensePayloadFromForm(form), form.id);

      toast.success(form.id ? 'Biaya operasional diperbarui.' : 'Biaya operasional ditambahkan.');
      setDialogOpen(false);
      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan biaya operasional';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleVoid = async () => {
    if (!voidRow) return;

    setSaving(true);
    try {
      await fetchJson(`${OPERATIONAL_EXPENSES_URL}/${voidRow.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason: voidReason }),
      });
      toast.success('Biaya operasional di-void.');
      setVoidRow(null);
      setVoidReason('');
      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal void biaya operasional';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="rounded-full bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          <Lock className="h-12 w-12" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Akses Dibatasi</h1>
        <p className="text-slate-500 dark:text-slate-400">Anda tidak memiliki izin untuk membuka Biaya Operasional.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-4 px-4 py-4 md:px-6">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
              <WalletCards className="h-4 w-4" />
              Finance
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">Biaya Operasional</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Periode {formatDate(filters.startDate)} sampai {formatDate(filters.endDate)}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" onClick={refreshData} disabled={loading} className="h-9 gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={openCreate} disabled={!canCreate} className="h-9 gap-2">
              <Plus className="h-4 w-4" />
              Tambah Biaya
            </Button>
          </div>
        </div>
        {loadError && (
          <div className="mx-4 mt-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">Data belum bisa dimuat dari server.</div>
              <div className="mt-0.5 text-amber-700 dark:text-amber-300">{loadError}</div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-900/10">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-rose-700 dark:text-rose-300">Total Biaya</p>
              <ReceiptText className="h-5 w-5 text-rose-500" />
            </div>
            <p className="mt-3 break-words text-2xl font-semibold text-rose-700 dark:text-rose-300">{formatCurrency(summary.totalAmount)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-500">Transaksi</p>
              <ClipboardList className="h-5 w-5 text-blue-500" />
            </div>
            <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">{summary.transactionCount.toLocaleString('id-ID')}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-500">Rata-rata</p>
              <BarChart3 className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="mt-3 break-words text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(summary.averageAmount)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-500">Kategori Aktif</p>
              <Building2 className="h-5 w-5 text-violet-500" />
            </div>
            <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">{summary.categoryCount.toLocaleString('id-ID')}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
          <CalendarRange className="h-4 w-4 text-blue-500" />
          Filter Data
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[160px_160px_minmax(160px,1fr)_minmax(170px,1fr)_minmax(190px,1fr)_minmax(240px,1.4fr)]">
          <Input className="h-10" type="date" value={filters.startDate} onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))} />
          <Input className="h-10" type="date" value={filters.endDate} onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))} />
          <Select value={filters.branchId} onValueChange={(value) => setFilters((prev) => ({ ...prev, branchId: value }))}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Semua Cabang" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Cabang</SelectItem>
              {branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.category} onValueChange={(value) => setFilters((prev) => ({ ...prev, category: value, subcategory: 'all' }))}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Semua Kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {categoryOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.subcategory} onValueChange={(value) => setFilters((prev) => ({ ...prev, subcategory: value }))}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Semua Subkategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Subkategori</SelectItem>
              {subcategoryOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex min-w-0 gap-2 sm:col-span-2 xl:col-span-1">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="h-10 pl-9" placeholder="Cari..." value={filters.q} onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))} onKeyDown={(event) => event.key === 'Enter' && refreshData()} />
            </div>
            <Button variant="outline" onClick={refreshData} className="h-10 shrink-0">Cari</Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
        <Table className="min-w-[1080px]">
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50 dark:bg-slate-950/40 dark:hover:bg-slate-950/40">
              <TableHead className="w-[130px]">Tanggal</TableHead>
              <TableHead className="w-[220px]">Kategori</TableHead>
              <TableHead className="w-[160px]">Cabang</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead className="w-[180px]">Vendor</TableHead>
              <TableHead className="w-[160px] text-right">Nominal</TableHead>
              <TableHead className="w-[120px] text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-44 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-slate-500">
                    <div className="rounded-full bg-slate-100 p-3 text-slate-400 dark:bg-slate-800">
                      {loadError ? <AlertCircle className="h-6 w-6" /> : <ReceiptText className="h-6 w-6" />}
                    </div>
                    <div className="font-medium text-slate-700 dark:text-slate-200">
                      {loadError ? 'Server belum siap' : 'Belum ada biaya operasional'}
                    </div>
                    <div className="text-sm">
                      {loadError ? 'Setelah migration dan function terbaru aktif, data akan tampil di sini.' : 'Tidak ada data pada filter yang sedang dipilih.'}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{formatDate(row.expense_date)}</TableCell>
                <TableCell>
                  <div className="font-medium text-slate-900 dark:text-slate-100">{row.category}</div>
                  <div className="text-xs text-slate-500">{row.subcategory || '-'}</div>
                </TableCell>
                <TableCell className="text-slate-600 dark:text-slate-300">{row.branch_name || '-'}</TableCell>
                <TableCell className="max-w-[320px] truncate">{row.description || '-'}</TableCell>
                <TableCell className="max-w-[180px] truncate">{row.vendor_name || '-'}</TableCell>
                <TableCell className="text-right font-semibold text-rose-600">{formatCurrency(row.amount)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setDetailRow(row)}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(row)} disabled={!canEdit}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setVoidRow(row)} disabled={!canDelete}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit Biaya Operasional' : 'Tambah Biaya Operasional'}</DialogTitle>
            <DialogDescription>Isi kategori dan subkategori dengan rapi supaya laporan mudah dibaca.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input type="date" value={form.expense_date} onChange={(event) => setForm((prev) => ({ ...prev, expense_date: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Cabang</Label>
              <Select value={form.branch_id} onValueChange={(value) => setForm((prev) => ({ ...prev, branch_id: value }))}>
                <SelectTrigger><SelectValue placeholder="Umum / tanpa cabang" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Umum / tanpa cabang</SelectItem>
                  {branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={form.category} onValueChange={(value) => setForm((prev) => ({ ...prev, category: value, subcategory: '' }))}>
                <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subkategori</Label>
              <Select value={form.subcategory || 'none'} onValueChange={(value) => setForm((prev) => ({ ...prev, subcategory: value === 'none' ? '' : value }))}>
                <SelectTrigger><SelectValue placeholder="Pilih subkategori" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tanpa subkategori</SelectItem>
                  {formSubcategoryOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vendor / Penerima</Label>
              <Input value={form.vendor_name} onChange={(event) => setForm((prev) => ({ ...prev, vendor_name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Nominal</Label>
              <Input type="number" min="0" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Sumber Pembayaran</Label>
              <Input placeholder="Cash, BCA, Mandiri..." value={form.payment_source} onChange={(event) => setForm((prev) => ({ ...prev, payment_source: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Referensi</Label>
              <Input placeholder="No bukti / invoice" value={form.source_ref} onChange={(event) => setForm((prev) => ({ ...prev, source_ref: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Keterangan</Label>
              <Input value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Catatan</Label>
              <Textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSave} disabled={saving || (form.id ? !canEdit : !canCreate)}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailRow)} onOpenChange={(open) => !open && setDetailRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Biaya Operasional</DialogTitle>
          </DialogHeader>
          {detailRow && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Status</span>
                <Badge variant="outline">{detailRow.status === 'active' ? 'Aktif' : 'Void'}</Badge>
              </div>
              <div className="flex justify-between"><span>Tanggal</span><strong>{formatDate(detailRow.expense_date)}</strong></div>
              <div className="flex justify-between"><span>Kategori</span><strong>{detailRow.category}</strong></div>
              <div className="flex justify-between"><span>Subkategori</span><strong>{detailRow.subcategory || '-'}</strong></div>
              <div className="flex justify-between"><span>Cabang</span><strong>{detailRow.branch_name || '-'}</strong></div>
              <div className="flex justify-between"><span>Nominal</span><strong>{formatCurrency(detailRow.amount)}</strong></div>
              <div><span className="text-slate-500">Keterangan</span><p className="mt-1 font-medium">{detailRow.description || '-'}</p></div>
              <div><span className="text-slate-500">Catatan</span><p className="mt-1 font-medium">{detailRow.notes || '-'}</p></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(voidRow)} onOpenChange={(open) => !open && setVoidRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void biaya operasional?</AlertDialogTitle>
            <AlertDialogDescription>Data tidak dihapus permanen, tetapi statusnya berubah menjadi void dan tidak masuk summary aktif.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="Alasan void" value={voidReason} onChange={(event) => setVoidReason(event.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoid} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? 'Memproses...' : 'Void'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
