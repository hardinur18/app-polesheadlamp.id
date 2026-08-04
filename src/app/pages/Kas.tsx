import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Building2,
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
import { supabase } from '@/lib/supabaseClient';
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
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
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
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  DataTable,
  TableActionCell,
  TableActionHeader,
} from '../components/ui/data-table';
import {
  OperationalEmptyState,
  OperationalFilterPanel,
  OperationalKpiCard,
  OperationalKpiGrid,
  OperationalPageHeader,
  OperationalPageShell,
  OperationalTableCard,
} from '../components/ui/operational-page';
import {
  MasterDataCurrencyInput,
  MasterDataDialogBody,
  MasterDataFieldLabel,
  MasterDataFormActions,
  MasterDataFormDialogContent,
  MasterDataFormField,
  MasterDataFormGrid,
  MasterDataFormHeader,
} from '../components/ui/master-data-ui';

type OperationalExpenseCategory = {
  id: string;
  category: string;
  subcategory: string;
  account_code?: string;
  account_type?: 'income' | 'expense' | 'cogs';
  description?: string;
  finance_account_id?: string;
  finance_category_id?: string;
  is_active?: boolean;
  sort_order?: number;
};

type FinanceCategoryRow = {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'cogs';
  active: boolean;
  sort_order: number;
};

type FinanceAccountRow = {
  id: string;
  category_id: string;
  name: string;
  code: string;
  description: string | null;
  active: boolean;
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
const OPTIONAL_SELECT_NONE = '__none__';
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

const mapFinanceCategoriesToOperationalOptions = (
  financeCategories: FinanceCategoryRow[],
  financeAccounts: FinanceAccountRow[],
): OperationalExpenseCategory[] => {
  const categoryById = new Map(
    financeCategories
      .filter((category) => category.active && (category.type === 'expense' || category.type === 'cogs'))
      .map((category) => [category.id, category]),
  );

  return financeAccounts
    .flatMap((account) => {
      const category = categoryById.get(account.category_id);
      if (!category || !account.active) return [];

      return [{
        id: account.id,
        category: category.name,
        subcategory: account.name,
        account_code: account.code,
        account_type: category.type,
        description: account.description || '',
        finance_account_id: account.id,
        finance_category_id: category.id,
        is_active: true,
        sort_order: (category.sort_order || 0) * 100 + (Number(account.code) || 0),
      }];
    })
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.category.localeCompare(b.category) || a.subcategory.localeCompare(b.subcategory));
};

const fetchFinanceExpenseCategoryOptions = async () => {
  const [categoryResult, accountResult] = await Promise.all([
    supabase
      .from('finance_categories')
      .select('id, name, type, active, sort_order')
      .in('type', ['expense', 'cogs'])
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('finance_accounts')
      .select('id, category_id, name, code, description, active')
      .eq('active', true)
      .order('category_id', { ascending: true })
      .order('code', { ascending: true })
      .order('name', { ascending: true }),
  ]);

  if (categoryResult.error) throw categoryResult.error;
  if (accountResult.error) throw accountResult.error;

  return mapFinanceCategoriesToOperationalOptions(
    (categoryResult.data || []) as FinanceCategoryRow[],
    (accountResult.data || []) as FinanceAccountRow[],
  );
};

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

const getPaymentSourceLabel = (payment: { bankName: string; accountNumber?: string; accountHolder?: string }) =>
  [payment.bankName, payment.accountNumber, payment.accountHolder].filter(Boolean).join(' - ');

export function Kas() {
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const { activeBranches, payments, vendors } = useMasterData();
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

  const activeVendorOptions = useMemo(
    () => vendors
      .filter((vendor) => vendor.status === 'active')
      .sort((left, right) => left.name.localeCompare(right.name)),
    [vendors],
  );

  const activePaymentOptions = useMemo(
    () => payments
      .filter((payment) => payment.status === 'active')
      .sort((left, right) => getPaymentSourceLabel(left).localeCompare(getPaymentSourceLabel(right))),
    [payments],
  );

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
      fetchFinanceExpenseCategoryOptions(),
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
    if (!form.expense_date || !form.category || !form.subcategory || !form.amount || Number(form.amount) <= 0) {
      toast.error('Tanggal, kategori finance, subkategori finance, dan nominal wajib diisi.');
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
      <OperationalPageShell>
        <OperationalEmptyState
          icon={Lock}
          title="Akses Dibatasi"
          description="Anda tidak memiliki izin untuk membuka Biaya Operasional."
          className="min-h-[70vh]"
        />
      </OperationalPageShell>
    );
  }

  return (
    <OperationalPageShell className="pb-20">
      <OperationalPageHeader
        eyebrow="Keuangan"
        icon={WalletCards}
        title="Biaya Operasional"
        subtitle={`Periode ${formatDate(filters.startDate)} sampai ${formatDate(filters.endDate)}`}
        actions={
          <>
            <Button variant="outline" onClick={refreshData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={openCreate} disabled={!canCreate}>
              <Plus className="h-4 w-4" />
              Tambah Biaya
            </Button>
          </>
        }
      />

      {loadError && (
        <div className="surfacePanel flex gap-3 border-amber-200 bg-amber-50 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">Data belum bisa dimuat dari server.</div>
            <div className="mt-0.5 text-amber-700 dark:text-amber-300">{loadError}</div>
          </div>
        </div>
      )}

      <OperationalKpiGrid>
        <OperationalKpiCard label="Total Biaya" value={formatCurrency(summary.totalAmount)} icon={ReceiptText} tone="rose" />
        <OperationalKpiCard label="Transaksi" value={summary.transactionCount.toLocaleString('id-ID')} icon={ClipboardList} tone="blue" />
        <OperationalKpiCard label="Rata-rata" value={formatCurrency(summary.averageAmount)} icon={BarChart3} tone="emerald" />
        <OperationalKpiCard label="Kategori Finance" value={categoryOptions.length.toLocaleString('id-ID')} icon={Building2} tone="violet" />
      </OperationalKpiGrid>

      <OperationalFilterPanel>
        <div className="masterDataControlRow">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[160px_160px_minmax(160px,1fr)_minmax(170px,1fr)_minmax(190px,1fr)_minmax(240px,1.4fr)]">
          <Input className="filterDateButton" type="date" value={filters.startDate} onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))} />
          <Input className="filterDateButton" type="date" value={filters.endDate} onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))} />
          <Select value={filters.branchId} onValueChange={(value) => setFilters((prev) => ({ ...prev, branchId: value }))}>
            <SelectTrigger className="uiSelectTrigger"><SelectValue placeholder="Semua Cabang" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Cabang</SelectItem>
              {activeBranches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.category} onValueChange={(value) => setFilters((prev) => ({ ...prev, category: value, subcategory: 'all' }))}>
            <SelectTrigger className="uiSelectTrigger"><SelectValue placeholder="Semua Kategori Finance" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori Finance</SelectItem>
              {categoryOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.subcategory} onValueChange={(value) => setFilters((prev) => ({ ...prev, subcategory: value }))}>
            <SelectTrigger className="uiSelectTrigger"><SelectValue placeholder="Semua Subkategori Finance" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Subkategori Finance</SelectItem>
              {subcategoryOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex min-w-0 gap-2 sm:col-span-2 xl:col-span-1">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="uiInput pl-9" placeholder="Cari biaya, vendor, atau catatan..." value={filters.q} onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))} onKeyDown={(event) => event.key === 'Enter' && refreshData()} />
            </div>
            <Button variant="outline" onClick={refreshData} className="shrink-0">Cari</Button>
          </div>
        </div>
        </div>
      </OperationalFilterPanel>

      <OperationalTableCard>
        <DataTable columns={[64, 132, 236, 170, 280, 180, 160, 120]} minWidth={1342} rowMinHeight={62} cellY={12} textMax={280}>
        <table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">No</TableHead>
              <TableHead className="w-[130px]">Tanggal</TableHead>
              <TableHead className="w-[220px]">Kategori</TableHead>
              <TableHead className="w-[160px]">Cabang</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead className="w-[180px]">Vendor</TableHead>
              <TableHead className="w-[160px] text-right">Nominal</TableHead>
              <TableActionHeader />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <OperationalEmptyState
                    icon={loadError ? AlertCircle : ReceiptText}
                    title={loadError ? 'Server belum siap' : 'Belum ada biaya operasional'}
                    description={loadError ? 'Setelah migration dan function terbaru aktif, data akan tampil di sini.' : 'Tidak ada data pada filter yang sedang dipilih.'}
                  />
                </TableCell>
              </TableRow>
            ) : rows.map((row, index) => (
              <TableRow key={row.id}>
                <TableCell className="monoCell text-center">{index + 1}</TableCell>
                <TableCell>{formatDate(row.expense_date)}</TableCell>
                <TableCell>
                  <div className="tableTextStack" data-full-text={`${row.category} - ${row.subcategory || '-'}`}>
                    <span className="tableTextPrimary">{row.category}</span>
                    <small className="tableTextSecondary">{row.subcategory || '-'}</small>
                  </div>
                </TableCell>
                <TableCell className="text-slate-600 dark:text-slate-300">{row.branch_name || '-'}</TableCell>
                <TableCell className="max-w-[320px] truncate">{row.description || '-'}</TableCell>
                <TableCell className="max-w-[180px] truncate">{row.vendor_name || '-'}</TableCell>
                <TableCell className="text-right text-rose-600">{formatCurrency(row.amount)}</TableCell>
                <TableActionCell>
                    <Button variant="ghost" size="icon" onClick={() => setDetailRow(row)}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(row)} disabled={!canEdit}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setVoidRow(row)} disabled={!canDelete}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </TableActionCell>
              </TableRow>
            ))}
          </TableBody>
        </table>
        </DataTable>
      </OperationalTableCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <MasterDataFormDialogContent size="wide">
          <MasterDataFormHeader
            icon={ReceiptText}
            title={form.id ? 'Edit Biaya Operasional' : 'Tambah Biaya Operasional'}
            description="Isi kategori dan subkategori dengan rapi supaya laporan mudah dibaca."
          />
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleSave();
            }}
          >
          <MasterDataDialogBody>
          <MasterDataFormGrid>
            <MasterDataFormField span="half">
              <MasterDataFieldLabel required>Tanggal</MasterDataFieldLabel>
              <Input className="uiInput" type="date" value={form.expense_date} onChange={(event) => setForm((prev) => ({ ...prev, expense_date: event.target.value }))} />
            </MasterDataFormField>
            <MasterDataFormField span="half">
              <MasterDataFieldLabel required>Kategori Finance</MasterDataFieldLabel>
              <Select value={form.category} onValueChange={(value) => setForm((prev) => ({ ...prev, category: value, subcategory: '' }))}>
                <SelectTrigger className="uiSelectTrigger"><SelectValue placeholder="Pilih kategori finance" /></SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </MasterDataFormField>
            <MasterDataFormField span="half">
              <MasterDataFieldLabel required>Subkategori Finance</MasterDataFieldLabel>
              <Select value={form.subcategory} onValueChange={(value) => setForm((prev) => ({ ...prev, subcategory: value }))} disabled={!form.category}>
                <SelectTrigger className="uiSelectTrigger"><SelectValue placeholder={form.category ? 'Pilih subkategori finance' : 'Pilih kategori dulu'} /></SelectTrigger>
                <SelectContent>
                  {formSubcategoryOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </MasterDataFormField>
            <MasterDataFormField span="half">
              <MasterDataFieldLabel optional>Cabang</MasterDataFieldLabel>
              <Select value={form.branch_id} onValueChange={(value) => setForm((prev) => ({ ...prev, branch_id: value }))}>
                <SelectTrigger className="uiSelectTrigger"><SelectValue placeholder="Umum / tanpa cabang" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Umum / tanpa cabang</SelectItem>
                  {activeBranches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </MasterDataFormField>
            <MasterDataFormField span="half">
              <MasterDataFieldLabel optional>Vendor / Penerima</MasterDataFieldLabel>
              <Select
                value={form.vendor_name || OPTIONAL_SELECT_NONE}
                onValueChange={(value) => setForm((prev) => ({ ...prev, vendor_name: value === OPTIONAL_SELECT_NONE ? '' : value }))}
              >
                <SelectTrigger className="uiSelectTrigger"><SelectValue placeholder="Pilih vendor / penerima" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={OPTIONAL_SELECT_NONE}>Tanpa vendor</SelectItem>
                  {activeVendorOptions.map((vendor) => <SelectItem key={vendor.id} value={vendor.name}>{vendor.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </MasterDataFormField>
            <MasterDataFormField span="half">
              <MasterDataFieldLabel optional>Sumber Pembayaran</MasterDataFieldLabel>
              <Select
                value={form.payment_source || OPTIONAL_SELECT_NONE}
                onValueChange={(value) => setForm((prev) => ({ ...prev, payment_source: value === OPTIONAL_SELECT_NONE ? '' : value }))}
              >
                <SelectTrigger className="uiSelectTrigger"><SelectValue placeholder="Pilih bank / sumber dana" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={OPTIONAL_SELECT_NONE}>Tanpa sumber pembayaran</SelectItem>
                  {activePaymentOptions.map((payment) => {
                    const label = getPaymentSourceLabel(payment);
                    return <SelectItem key={payment.id} value={label}>{label}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </MasterDataFormField>
            <MasterDataFormField span="half">
              <MasterDataFieldLabel required>Nominal</MasterDataFieldLabel>
              <MasterDataCurrencyInput value={form.amount} onValueChange={(amount) => setForm((prev) => ({ ...prev, amount }))} />
            </MasterDataFormField>
            <MasterDataFormField span="half">
              <MasterDataFieldLabel optional>Referensi</MasterDataFieldLabel>
              <Input className="uiInput" placeholder="No bukti / invoice" value={form.source_ref} onChange={(event) => setForm((prev) => ({ ...prev, source_ref: event.target.value }))} />
            </MasterDataFormField>
            <MasterDataFormField span="full">
              <MasterDataFieldLabel optional>Keterangan</MasterDataFieldLabel>
              <Input className="uiInput" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
            </MasterDataFormField>
            <MasterDataFormField span="full">
              <MasterDataFieldLabel optional>Catatan</MasterDataFieldLabel>
              <Textarea className="min-h-[96px]" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
            </MasterDataFormField>
          </MasterDataFormGrid>
          <MasterDataFormActions
            isSubmitting={saving}
            onCancel={() => setDialogOpen(false)}
            saveLabel={form.id ? 'Simpan Perubahan' : 'Simpan Biaya'}
            submitDisabled={form.id ? !canEdit : !canCreate}
          />
          </MasterDataDialogBody>
          </form>
        </MasterDataFormDialogContent>
      </Dialog>

      <Dialog open={Boolean(detailRow)} onOpenChange={(open) => !open && setDetailRow(null)}>
        <MasterDataFormDialogContent>
          <MasterDataFormHeader
            icon={Eye}
            title="Detail Biaya Operasional"
            description="Ringkasan transaksi biaya operasional yang tercatat."
          />
          {detailRow && (
            <MasterDataDialogBody compact>
              <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <span className="text-sm font-medium text-slate-500">Status</span>
                  <Badge variant="outline">{detailRow.status === 'active' ? 'Aktif' : 'Void'}</Badge>
                </div>
                {[
                  ['Tanggal', formatDate(detailRow.expense_date)],
                  ['Kategori Finance', detailRow.category],
                  ['Subkategori Finance', detailRow.subcategory || '-'],
                  ['Cabang', detailRow.branch_name || '-'],
                  ['Vendor / Penerima', detailRow.vendor_name || '-'],
                  ['Sumber Pembayaran', detailRow.payment_source || '-'],
                  ['Referensi', detailRow.source_ref || '-'],
                  ['Nominal', formatCurrency(detailRow.amount)],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[150px_minmax(0,1fr)] gap-4 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 dark:border-slate-800">
                    <span className="font-medium text-slate-500">{label}</span>
                    <span className="min-w-0 text-slate-900 dark:text-slate-100">{value}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-slate-500">Keterangan</div>
                  <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">{detailRow.description || '-'}</p>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-500">Catatan</div>
                  <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">{detailRow.notes || '-'}</p>
                </div>
              </div>
            </MasterDataDialogBody>
          )}
        </MasterDataFormDialogContent>
      </Dialog>

      <AlertDialog open={Boolean(voidRow)} onOpenChange={(open) => !open && setVoidRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void biaya operasional?</AlertDialogTitle>
            <AlertDialogDescription>Data tidak dihapus permanen, tetapi statusnya berubah menjadi void dan tidak masuk summary aktif.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea className="min-h-[96px] rounded-2xl" placeholder="Alasan void" value={voidReason} onChange={(event) => setVoidReason(event.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoid} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? 'Memproses...' : 'Void'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </OperationalPageShell>
  );
}
