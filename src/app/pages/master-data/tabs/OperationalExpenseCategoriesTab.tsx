import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Edit,
  Layers3,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { usePermissions } from '@/app/hooks/usePermissions';
import { DEFAULT_OPERATIONAL_EXPENSE_ACCOUNTS } from '@/app/data/operationalExpenseAccounts';
import { Button } from '../../../components/ui/button';
import { ControlPanel, ControlRow, SearchBox } from '../../../components/ui/control-panel';
import {
  DataTable,
  TableActionCell,
  TableActionHeader,
  TableActionMenu,
  TableActionMenuItem,
  TableStatusCell,
  TableStatusIcon,
  TableText,
} from '../../../components/ui/data-table';
import { MasterDataTableTitle } from '../../../components/ui/master-data-table-title';
import type { NoticeItem } from '../../../components/ui/notice-stack';
import { Input } from '../../../components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../components/ui/alert-dialog';
import { Dialog, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import {
  MasterDataFieldLabel,
  MasterDataFormActions,
  MasterDataFormDialogContent,
  MasterDataUnsavedChangesDialog,
  useMasterDataFormCloseGuard,
} from '../../../components/ui/master-data-ui';
import {
  OperationalEmptyState,
  OperationalTableCard,
} from '../../../components/ui/operational-page';

type FinanceType = 'income' | 'expense' | 'cogs';

type FinanceCategory = {
  id: string;
  name: string;
  type: FinanceType;
  active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

type FinanceAccount = {
  id: string;
  category_id: string;
  name: string;
  code: string;
  description: string | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

type CategoryFormState = {
  id?: string;
  name: string;
  type: FinanceType;
  active: boolean;
  sort_order: string;
};

type AccountFormState = {
  id?: string;
  category_id: string;
  name: string;
  code: string;
  description: string;
  active: boolean;
};

type DeleteTarget =
  | { kind: 'category'; item: FinanceCategory }
  | { kind: 'account'; item: FinanceAccount };

const TYPE_LABEL: Record<FinanceType, string> = {
  income: 'Income',
  expense: 'Expense',
  cogs: 'HPP',
};

const EMPTY_CATEGORY_FORM: CategoryFormState = {
  name: '',
  type: 'expense',
  active: true,
  sort_order: '10',
};

const EMPTY_ACCOUNT_FORM: AccountFormState = {
  category_id: '',
  name: '',
  code: '',
  description: '',
  active: true,
};

function slugFinanceId(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function buildCategoryId(type: FinanceType, name: string) {
  return `cat_${type}_${slugFinanceId(name) || 'kategori'}`;
}

function buildAccountId(categoryId: string, name: string) {
  return `acc_${slugFinanceId(categoryId) || 'category'}_${slugFinanceId(name) || 'subkategori'}`;
}

function categoryFallback(): FinanceCategory[] {
  const rows = new Map<string, FinanceCategory>();
  DEFAULT_OPERATIONAL_EXPENSE_ACCOUNTS.forEach((account) => {
    const id = account.finance_category_id || buildCategoryId(account.account_type, account.category);
    if (rows.has(id)) return;
    rows.set(id, {
      id,
      name: account.category,
      type: account.account_type,
      active: DEFAULT_OPERATIONAL_EXPENSE_ACCOUNTS.some((item) => (item.finance_category_id || '') === id && item.is_active),
      sort_order: Math.floor(account.sort_order / 100) * 10 || account.sort_order,
    });
  });
  return Array.from(rows.values()).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

function accountFallback(): FinanceAccount[] {
  return DEFAULT_OPERATIONAL_EXPENSE_ACCOUNTS.map((account) => ({
    id: account.finance_account_id || buildAccountId(account.finance_category_id || '', account.subcategory),
    category_id: account.finance_category_id || buildCategoryId(account.account_type, account.category),
    name: account.subcategory,
    code: account.account_code,
    description: account.description,
    active: account.is_active,
  }));
}

type OperationalExpenseCategoriesTabProps = {
  setPageNotices?: (notices: NoticeItem[]) => void;
};

export function OperationalExpenseCategoriesTab({ setPageNotices }: OperationalExpenseCategoriesTabProps) {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('master_data.create');
  const canEdit = hasPermission('master_data.edit');
  const canDelete = hasPermission('master_data.delete');

  const lastLoadErrorRef = useRef('');
  const [activeView, setActiveView] = useState<'categories' | 'accounts'>('categories');
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(EMPTY_CATEGORY_FORM);
  const [initialCategoryForm, setInitialCategoryForm] = useState<CategoryFormState>(EMPTY_CATEGORY_FORM);
  const [accountForm, setAccountForm] = useState<AccountFormState>(EMPTY_ACCOUNT_FORM);
  const [initialAccountForm, setInitialAccountForm] = useState<AccountFormState>(EMPTY_ACCOUNT_FORM);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const isCategoryFormDirty = useMemo(() => JSON.stringify(categoryForm) !== JSON.stringify(initialCategoryForm), [categoryForm, initialCategoryForm]);
  const isAccountFormDirty = useMemo(() => JSON.stringify(accountForm) !== JSON.stringify(initialAccountForm), [accountForm, initialAccountForm]);

  const closeCategoryDialog = React.useCallback(() => {
    setCategoryDialogOpen(false);
    setInitialCategoryForm(EMPTY_CATEGORY_FORM);
  }, []);

  const closeAccountDialog = React.useCallback(() => {
    setAccountDialogOpen(false);
    setInitialAccountForm(EMPTY_ACCOUNT_FORM);
  }, []);

  const categoryCloseGuard = useMasterDataFormCloseGuard({
    hasUnsavedChanges: isCategoryFormDirty,
    onClose: closeCategoryDialog,
  });

  const accountCloseGuard = useMasterDataFormCloseGuard({
    hasUnsavedChanges: isAccountFormDirty,
    onClose: closeAccountDialog,
  });

  useEffect(() => {
    setPageNotices?.(
      loadError
        ? [{ id: 'finance-category-load', tone: 'warning', message: loadError }]
        : [],
    );

    return () => setPageNotices?.([]);
  }, [loadError, setPageNotices]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [categoryResult, accountResult] = await Promise.all([
        supabase.from('finance_categories').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
        supabase.from('finance_accounts').select('*').order('category_id', { ascending: true }).order('code', { ascending: true }).order('name', { ascending: true }),
      ]);

      if (categoryResult.error) throw categoryResult.error;
      if (accountResult.error) throw accountResult.error;

      setCategories((categoryResult.data || []) as FinanceCategory[]);
      setAccounts((accountResult.data || []) as FinanceAccount[]);
      setLoadError(null);
      lastLoadErrorRef.current = '';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memuat kategori finance.';
      setCategories(categoryFallback());
      setAccounts(accountFallback());
      setLoadError('Database finance belum siap. Menampilkan data fallback sementara.');
      if (message !== lastLoadErrorRef.current) {
        toast.error(message);
        lastLoadErrorRef.current = message;
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories.filter((category) =>
      !q || `${category.name} ${category.type} ${category.id}`.toLowerCase().includes(q),
    );
  }, [categories, search]);

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((account) => {
      const category = categoryById.get(account.category_id);
      return !q || `${account.name} ${account.code} ${account.description || ''} ${account.id} ${category?.name || ''} ${category?.type || ''}`.toLowerCase().includes(q);
    });
  }, [accounts, categoryById, search]);

  const visibleRows = activeView === 'categories' ? filteredCategories : filteredAccounts;
  const syncOperationalExpenseBridge = async (nextCategories = categories, nextAccounts = accounts) => {
    if (!nextCategories.length || !nextAccounts.length) return;
    const nextCategoryById = new Map(nextCategories.map((category) => [category.id, category]));
    const rows = nextAccounts.map((account, index) => {
      const category = nextCategoryById.get(account.category_id);
      return {
        category: category?.name || 'Tanpa Kategori',
        subcategory: account.name,
        account_code: account.code,
        account_type: category?.type || 'expense',
        description: account.description || '',
        sort_order: (category?.sort_order || 0) * 100 + index + 1,
        is_active: Boolean(account.active && category?.active),
        finance_category_id: account.category_id,
        finance_account_id: account.id,
      };
    });

    const { error } = await supabase
      .from('operational_expense_categories')
      .upsert(rows, { onConflict: 'finance_account_id' });
    if (error) throw error;
  };

  const openCreateCategory = () => {
    const nextForm = { ...EMPTY_CATEGORY_FORM, sort_order: String((categories.length + 1) * 10) };
    setCategoryForm(nextForm);
    setInitialCategoryForm(nextForm);
    setCategoryDialogOpen(true);
  };

  const openEditCategory = (category: FinanceCategory) => {
    const nextForm = {
      id: category.id,
      name: category.name,
      type: category.type,
      active: category.active,
      sort_order: String(category.sort_order || 0),
    };
    setCategoryForm(nextForm);
    setInitialCategoryForm(nextForm);
    setCategoryDialogOpen(true);
  };

  const openCreateAccount = () => {
    const firstCategory = categories.find((category) => category.active) || categories[0];
    const nextForm = { ...EMPTY_ACCOUNT_FORM, category_id: firstCategory?.id || '' };
    setAccountForm(nextForm);
    setInitialAccountForm(nextForm);
    setAccountDialogOpen(true);
  };

  const openEditAccount = (account: FinanceAccount) => {
    const nextForm = {
      id: account.id,
      category_id: account.category_id,
      name: account.name,
      code: account.code,
      description: account.description || '',
      active: account.active,
    };
    setAccountForm(nextForm);
    setInitialAccountForm(nextForm);
    setAccountDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast.error('Nama kategori utama wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: categoryForm.id || buildCategoryId(categoryForm.type, categoryForm.name.trim()),
        name: categoryForm.name.trim(),
        type: categoryForm.type,
        active: categoryForm.active,
        sort_order: Number(categoryForm.sort_order) || 0,
        updated_at: new Date().toISOString(),
      };

      const result = categoryForm.id
        ? await supabase.from('finance_categories').update(payload).eq('id', categoryForm.id).select().single()
        : await supabase.from('finance_categories').insert(payload).select().single();
      if (result.error) throw result.error;

      const nextCategories = categoryForm.id
        ? categories.map((item) => (item.id === categoryForm.id ? result.data as FinanceCategory : item))
        : [...categories, result.data as FinanceCategory];
      await syncOperationalExpenseBridge(nextCategories, accounts);

      toast.success(categoryForm.id ? 'Kategori utama diperbarui.' : 'Kategori utama ditambahkan.');
      closeCategoryDialog();
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan kategori utama.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAccount = async () => {
    if (!accountForm.category_id || !accountForm.name.trim() || !accountForm.code.trim()) {
      toast.error('Kategori utama, nama sub kategori, dan kode wajib diisi.');
      return;
    }
    if (!/^\d{5}$/.test(accountForm.code.trim())) {
      toast.error('Kode akun wajib 5 digit angka.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: accountForm.id || buildAccountId(accountForm.category_id, accountForm.name.trim()),
        category_id: accountForm.category_id,
        name: accountForm.name.trim(),
        code: accountForm.code.trim(),
        description: accountForm.description.trim() || null,
        active: accountForm.active,
        updated_at: new Date().toISOString(),
      };

      const result = accountForm.id
        ? await supabase.from('finance_accounts').update(payload).eq('id', accountForm.id).select().single()
        : await supabase.from('finance_accounts').insert(payload).select().single();
      if (result.error) throw result.error;

      const nextAccounts = accountForm.id
        ? accounts.map((item) => (item.id === accountForm.id ? result.data as FinanceAccount : item))
        : [...accounts, result.data as FinanceAccount];
      await syncOperationalExpenseBridge(categories, nextAccounts);

      toast.success(accountForm.id ? 'Sub kategori diperbarui.' : 'Sub kategori ditambahkan.');
      closeAccountDialog();
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan sub kategori.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      if (deleteTarget.kind === 'category') {
        await supabase.from('operational_expense_categories').delete().eq('finance_category_id', deleteTarget.item.id);
        const { error } = await supabase.from('finance_categories').delete().eq('id', deleteTarget.item.id);
        if (error) throw error;
        toast.success('Kategori utama dihapus.');
      } else {
        await supabase.from('operational_expense_categories').delete().eq('finance_account_id', deleteTarget.item.id);
        const { error } = await supabase.from('finance_accounts').delete().eq('id', deleteTarget.item.id);
        if (error) throw error;
        toast.success('Sub kategori dihapus.');
      }
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus data finance.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="masterDataTabSurface">
      <ControlPanel aria-label="Filter kategori finance">
        <ControlRow className="masterDataControlRow">
          <SearchBox
            placeholder="Cari kategori, sub kategori, kode akun..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="masterDataControlActions">
            <Button variant="outline" className="masterDataActionButton secondary" onClick={loadData} disabled={loading}>
              <RefreshCw className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button
              className="masterDataActionButton"
              onClick={activeView === 'categories' ? openCreateCategory : openCreateAccount}
              disabled={!canCreate}
            >
              <Plus />
              {activeView === 'categories' ? 'Tambah Kategori' : 'Tambah Sub Kategori'}
            </Button>
          </div>
        </ControlRow>
      </ControlPanel>

      <div className="adAccountViewSwitch" role="tablist" aria-label="Kategori finance">
        <button
          type="button"
          className={`adAccountViewSwitchItem ${activeView === 'categories' ? 'isActive' : ''}`}
          onClick={() => setActiveView('categories')}
          role="tab"
          aria-selected={activeView === 'categories'}
        >
          <span>Kategori Utama</span>
          <strong>{filteredCategories.length}</strong>
        </button>
        <button
          type="button"
          className={`adAccountViewSwitchItem ${activeView === 'accounts' ? 'isActive' : ''}`}
          onClick={() => setActiveView('accounts')}
          role="tab"
          aria-selected={activeView === 'accounts'}
        >
          <span>Sub Kategori</span>
          <strong>{filteredAccounts.length}</strong>
        </button>
      </div>

      <MasterDataTableTitle
        title={activeView === 'categories' ? 'Kategori Utama Finance' : 'Sub Kategori Finance'}
        count={visibleRows.length}
        icon={activeView === 'categories' ? Layers3 : ReceiptText}
      />

      {loading ? (
        <OperationalTableCard className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </OperationalTableCard>
      ) : visibleRows.length === 0 ? (
        <OperationalTableCard className="border-dashed">
          <OperationalEmptyState
            icon={activeView === 'categories' ? Layers3 : ReceiptText}
            title={activeView === 'categories' ? 'Belum ada kategori utama' : 'Belum ada sub kategori'}
            description={activeView === 'categories' ? 'Tambahkan kategori finance utama.' : 'Tambahkan sub kategori finance sebelum input transaksi.'}
          />
        </OperationalTableCard>
      ) : activeView === 'categories' ? (
        <div className="tablePanel">
          <DataTable actionWidth={82} cellY={12} columns={[72, 360, 180, 140, 104, (canEdit || canDelete) ? 82 : null]} minWidth={canEdit || canDelete ? 938 : 856} rowMinHeight={64}>
            <table>
              <thead>
                <tr>
                  <th className="text-center">No</th>
                  <th>Nama Kategori Finance</th>
                  <th>Tipe</th>
                  <th className="text-center">Urutan</th>
                  <th className="text-center">Status</th>
                  {(canEdit || canDelete) && <TableActionHeader />}
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((category, index) => (
                  <tr key={category.id}>
                    <td className="monoCell text-center">{index + 1}</td>
                    <td>
                      <TableText primary={category.name} secondary={category.id} />
                    </td>
                    <td>
                      <TableText primary={TYPE_LABEL[category.type]} />
                    </td>
                    <td className="monoCell text-center">{category.sort_order || 0}</td>
                    <TableStatusCell>
                      <TableStatusIcon label={category.active ? 'Aktif' : 'Non aktif'} tone={category.active ? 'active' : 'inactive'} />
                    </TableStatusCell>
                    {(canEdit || canDelete) && (
                      <TableActionCell>
                        <TableActionMenu>
                          {canEdit && (
                            <TableActionMenuItem icon={Edit} onClick={() => openEditCategory(category)}>
                              Edit Kategori
                            </TableActionMenuItem>
                          )}
                          {canDelete && (
                            <TableActionMenuItem danger icon={Trash2} onClick={() => setDeleteTarget({ kind: 'category', item: category })}>
                              Hapus
                            </TableActionMenuItem>
                          )}
                        </TableActionMenu>
                      </TableActionCell>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        </div>
      ) : (
        <div className="tablePanel">
          <DataTable actionWidth={82} cellY={12} columns={[72, 320, 260, 120, 360, 104, (canEdit || canDelete) ? 82 : null]} minWidth={canEdit || canDelete ? 1318 : 1236} rowMinHeight={64}>
            <table>
              <thead>
                <tr>
                  <th className="text-center">No</th>
                  <th>Sub Kategori Finance</th>
                  <th>Kategori Utama</th>
                  <th>Kode</th>
                  <th>Deskripsi</th>
                  <th className="text-center">Status</th>
                  {(canEdit || canDelete) && <TableActionHeader />}
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((account, index) => {
                  const category = categoryById.get(account.category_id);
                  return (
                    <tr key={account.id}>
                      <td className="monoCell text-center">{index + 1}</td>
                      <td>
                        <TableText primary={account.name} secondary={account.id} />
                      </td>
                      <td>
                        <TableText primary={category?.name || 'Kategori tidak ditemukan'} secondary={category ? TYPE_LABEL[category.type] : account.category_id} />
                      </td>
                      <td>
                        <TableText primary={account.code || '-'} />
                      </td>
                      <td>
                        <TableText primary={account.description || '-'} />
                      </td>
                      <TableStatusCell>
                        <TableStatusIcon
                          label={account.active && category?.active !== false ? 'Aktif' : 'Non aktif'}
                          tone={account.active && category?.active !== false ? 'active' : 'inactive'}
                        />
                      </TableStatusCell>
                      {(canEdit || canDelete) && (
                        <TableActionCell>
                          <TableActionMenu>
                            {canEdit && (
                              <TableActionMenuItem icon={Edit} onClick={() => openEditAccount(account)}>
                                Edit Sub Kategori
                              </TableActionMenuItem>
                            )}
                            {canDelete && (
                              <TableActionMenuItem danger icon={Trash2} onClick={() => setDeleteTarget({ kind: 'account', item: account })}>
                                Hapus
                              </TableActionMenuItem>
                            )}
                          </TableActionMenu>
                        </TableActionCell>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTable>
        </div>
      )}

      <Dialog open={categoryDialogOpen} onOpenChange={(open) => (open ? setCategoryDialogOpen(true) : categoryCloseGuard.requestClose())}>
        <MasterDataFormDialogContent>
          <DialogHeader className="px-6 py-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-slate-100">
              <Layers3 className="h-5 w-5 text-blue-600" />
              {categoryForm.id ? 'Edit Kategori Utama' : 'Tambah Kategori Utama'}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleSaveCategory();
            }}
          >
            <div className="grid gap-4 bg-slate-50/50 px-6 py-5 dark:bg-slate-950">
              <div className="space-y-2">
                <MasterDataFieldLabel required>Nama Kategori</MasterDataFieldLabel>
                <Input value={categoryForm.name} placeholder="Contoh: Beban Operasional" onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <MasterDataFieldLabel required>Tipe</MasterDataFieldLabel>
                  <select className="uiSelectTrigger" value={categoryForm.type} onChange={(event) => setCategoryForm((prev) => ({ ...prev, type: event.target.value as FinanceType }))}>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                    <option value="cogs">HPP</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <MasterDataFieldLabel>Urutan</MasterDataFieldLabel>
                  <Input type="number" value={categoryForm.sort_order} onChange={(event) => setCategoryForm((prev) => ({ ...prev, sort_order: event.target.value }))} />
                </div>
              </div>
              <label className="masterDataToggleField">
                <span>
                  <strong>Status Aktif</strong>
                  <small>Nonaktif membuat kategori dan sub kategorinya tidak muncul di pilihan transaksi baru.</small>
                </span>
                <input type="checkbox" checked={categoryForm.active} onChange={(event) => setCategoryForm((prev) => ({ ...prev, active: event.target.checked }))} />
              </label>
            </div>
            <MasterDataFormActions isSubmitting={saving} onCancel={categoryCloseGuard.requestClose} saveLabel="Simpan Kategori" submitDisabled={categoryForm.id ? !canEdit : !canCreate} />
          </form>
        </MasterDataFormDialogContent>
        <MasterDataUnsavedChangesDialog open={categoryCloseGuard.isConfirmOpen} onCancel={categoryCloseGuard.cancelClose} onConfirm={categoryCloseGuard.confirmClose} />
      </Dialog>

      <Dialog open={accountDialogOpen} onOpenChange={(open) => (open ? setAccountDialogOpen(true) : accountCloseGuard.requestClose())}>
        <MasterDataFormDialogContent size="wide">
          <DialogHeader className="px-6 py-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-slate-100">
              <ReceiptText className="h-5 w-5 text-blue-600" />
              {accountForm.id ? 'Edit Sub Kategori' : 'Tambah Sub Kategori'}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleSaveAccount();
            }}
          >
            <div className="grid gap-4 bg-slate-50/50 px-6 py-5 dark:bg-slate-950">
              <div className="space-y-2">
                <MasterDataFieldLabel required>Kategori Utama</MasterDataFieldLabel>
                <select className="uiSelectTrigger" value={accountForm.category_id} onChange={(event) => setAccountForm((prev) => ({ ...prev, category_id: event.target.value }))}>
                  <option value="">Pilih kategori</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} - {TYPE_LABEL[category.type]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                <div className="space-y-2">
                  <MasterDataFieldLabel required>Nama Sub Kategori</MasterDataFieldLabel>
                  <Input value={accountForm.name} placeholder="Contoh: Biaya Iklan" onChange={(event) => setAccountForm((prev) => ({ ...prev, name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <MasterDataFieldLabel required>Kode Akun</MasterDataFieldLabel>
                  <Input value={accountForm.code} inputMode="numeric" maxLength={5} placeholder="5 digit" onChange={(event) => setAccountForm((prev) => ({ ...prev, code: event.target.value.replace(/\D/g, '') }))} />
                </div>
              </div>
              <div className="space-y-2">
                <MasterDataFieldLabel>Deskripsi</MasterDataFieldLabel>
                <Input value={accountForm.description} placeholder="Keterangan penggunaan sub kategori" onChange={(event) => setAccountForm((prev) => ({ ...prev, description: event.target.value }))} />
              </div>
              <label className="masterDataToggleField">
                <span>
                  <strong>Status Aktif</strong>
                  <small>Nonaktif tidak muncul di pilihan transaksi baru.</small>
                </span>
                <input type="checkbox" checked={accountForm.active} onChange={(event) => setAccountForm((prev) => ({ ...prev, active: event.target.checked }))} />
              </label>
            </div>
            <MasterDataFormActions isSubmitting={saving} onCancel={accountCloseGuard.requestClose} saveLabel="Simpan Sub Kategori" submitDisabled={accountForm.id ? !canEdit : !canCreate} />
          </form>
        </MasterDataFormDialogContent>
        <MasterDataUnsavedChangesDialog open={accountCloseGuard.isConfirmOpen} onCancel={accountCloseGuard.cancelClose} onConfirm={accountCloseGuard.confirmClose} />
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data finance?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === 'category'
                ? `Kategori ${deleteTarget.item.name} dan sub kategorinya akan dihapus.`
                : `Sub kategori ${deleteTarget?.item.name || ''} akan dihapus.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={saving} className="dangerButton">
              {saving ? 'Memproses...' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
