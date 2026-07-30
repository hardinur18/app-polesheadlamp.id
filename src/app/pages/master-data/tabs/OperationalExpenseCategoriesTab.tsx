import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Edit,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { buildMakeServerUrl } from '@/app/services/internal/functionsBaseUrl';
import { getSessionBackedEdgeHeaders } from '@/app/services/internal/sessionClientHeaders';
import { usePermissions } from '@/app/hooks/usePermissions';
import { DEFAULT_OPERATIONAL_EXPENSE_ACCOUNTS } from '@/app/data/operationalExpenseAccounts';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import {
  OperationalEmptyState,
  OperationalFilterPanel,
  OperationalKpiCard,
  OperationalKpiGrid,
  OperationalPageHeader,
  OperationalTableCard,
  RequiredLabel,
} from '../../../components/ui/operational-page';

type OperationalExpenseCategory = {
  id: string;
  category: string;
  subcategory: string;
  account_code: string;
  account_type: 'income' | 'expense' | 'cogs';
  description: string;
  sort_order: number;
  is_active: boolean;
};

type FormState = {
  id?: string;
  category: string;
  subcategory: string;
  account_code: string;
  account_type: 'income' | 'expense' | 'cogs';
  description: string;
  sort_order: string;
  is_active: boolean;
};

const CATEGORIES_URL = buildMakeServerUrl('/finance/operational-expense-categories');
const EMPTY_FORM: FormState = {
  category: '',
  subcategory: '',
  account_code: '',
  account_type: 'expense',
  description: '',
  sort_order: '0',
  is_active: true,
};

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: await getSessionBackedEdgeHeaders({
      includeJsonContentType: Boolean(options.body),
      headers: options.headers,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Endpoint master kategori biaya belum tersedia di server.');
    }
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }

  return payload as T;
}

export function OperationalExpenseCategoriesTab() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('master_data.create');
  const canEdit = hasPermission('master_data.edit');
  const canDelete = hasPermission('master_data.delete');

  const lastLoadErrorRef = useRef('');
  const [items, setItems] = useState<OperationalExpenseCategory[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<OperationalExpenseCategory | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await requestJson<OperationalExpenseCategory[]>(`${CATEGORIES_URL}?includeInactive=true`);
      setItems(data);
      setLoadError(null);
      lastLoadErrorRef.current = '';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memuat master kategori biaya';
      if (message.includes('Endpoint master kategori biaya')) {
        setItems(DEFAULT_OPERATIONAL_EXPENSE_ACCOUNTS);
        setLoadError('Server belum siap. Menampilkan Chart of Accounts default sementara.');
      } else {
        setLoadError(message);
      }
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

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      `${item.category} ${item.subcategory} ${item.account_code} ${item.description}`.toLowerCase().includes(q),
    );
  }, [items, search]);

  const activeCount = items.filter((item) => item.is_active).length;
  const inactiveCount = items.length - activeCount;
  const categoryCount = new Set(items.filter((item) => item.is_active).map((item) => item.category)).size;

  const groupedItems = useMemo(() => {
    return filteredItems.reduce<Record<string, OperationalExpenseCategory[]>>((acc, item) => {
      const key = item.category || 'Tanpa Kategori';
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [filteredItems]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, sort_order: String((items.length + 1) * 10) });
    setDialogOpen(true);
  };

  const openEdit = (item: OperationalExpenseCategory) => {
    setForm({
      id: item.id,
      category: item.category,
      subcategory: item.subcategory,
      account_code: item.account_code || '',
      account_type: item.account_type || 'expense',
      description: item.description || '',
      sort_order: String(item.sort_order || 0),
      is_active: item.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.category.trim() || !form.subcategory.trim() || !form.account_code.trim()) {
      toast.error('Kategori, nama akun, dan kode wajib diisi.');
      return;
    }

    if (!/^\d{5}$/.test(form.account_code.trim())) {
      toast.error('Kode akun wajib 5 digit angka.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        category: form.category.trim(),
        subcategory: form.subcategory.trim(),
        account_code: form.account_code.trim(),
        account_type: form.account_type,
        description: form.description.trim(),
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      };

      await requestJson<{ data: OperationalExpenseCategory }>(
        form.id ? `${CATEGORIES_URL}/${form.id}` : CATEGORIES_URL,
        {
          method: form.id ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        },
      );

      toast.success(form.id ? 'Kategori biaya diperbarui.' : 'Kategori biaya ditambahkan.');
      setDialogOpen(false);
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan master kategori biaya';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setSaving(true);
    try {
      await requestJson<{ data: OperationalExpenseCategory }>(`${CATEGORIES_URL}/${deleteItem.id}`, {
        method: 'DELETE',
      });
      toast.success('Kategori biaya dinonaktifkan.');
      setDeleteItem(null);
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menonaktifkan kategori biaya';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <OperationalPageHeader
        eyebrow="Biaya Operasional"
        icon={ReceiptText}
        title="Chart of Accounts"
        subtitle="Kategori, nama akun, kode, tipe, dan deskripsi."
        actions={
          <>
            <Button variant="outline" className="h-9 gap-2" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button className="h-9 gap-2" onClick={openCreate} disabled={!canCreate}>
              <Plus className="h-4 w-4" />
              Akun Baru
            </Button>
          </>
        }
      >

        {loadError && (
          <div className="mx-4 mt-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        <OperationalKpiGrid className="p-4 sm:grid-cols-3 xl:grid-cols-3">
          <OperationalKpiCard label="Kategori Aktif" value={categoryCount.toLocaleString('id-ID')} />
          <OperationalKpiCard label="Akun Aktif" value={activeCount.toLocaleString('id-ID')} tone="emerald" />
          <OperationalKpiCard label="Nonaktif" value={inactiveCount.toLocaleString('id-ID')} />
        </OperationalKpiGrid>
      </OperationalPageHeader>

      <OperationalFilterPanel className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Cari akun..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Badge variant="outline" className="w-fit">
          {filteredItems.length.toLocaleString('id-ID')} data
        </Badge>
      </OperationalFilterPanel>

      {loading ? (
        <OperationalTableCard className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </OperationalTableCard>
      ) : filteredItems.length === 0 ? (
        <OperationalTableCard className="border-dashed">
          <OperationalEmptyState
            icon={ReceiptText}
            title="Belum ada akun"
            description="Tambahkan chart of accounts sebelum input transaksi."
          />
        </OperationalTableCard>
      ) : (
        <OperationalTableCard>
          <div className="overflow-x-auto">
            <Table className="min-w-[1120px] table-fixed">
              <TableHeader>
                <TableRow className="border-b border-slate-100 bg-slate-50/70 hover:bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-950/40">
                  <TableHead className="h-10 w-[260px] text-xs font-semibold uppercase tracking-wide text-slate-500">Kategori</TableHead>
                  <TableHead className="h-10 w-[260px] text-xs font-semibold uppercase tracking-wide text-slate-500">Nama Akun</TableHead>
                  <TableHead className="h-10 w-[110px] text-xs font-semibold uppercase tracking-wide text-slate-500">Kode</TableHead>
                  <TableHead className="h-10 w-[140px] text-xs font-semibold uppercase tracking-wide text-slate-500">Tipe</TableHead>
                  <TableHead className="h-10 text-xs font-semibold uppercase tracking-wide text-slate-500">Deskripsi</TableHead>
                  <TableHead className="h-10 w-[120px] text-xs font-semibold uppercase tracking-wide text-slate-500">Status</TableHead>
                  {(canEdit || canDelete) && <TableHead className="h-10 w-[110px] text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(groupedItems).flatMap(([category, rows]) => [
                  <TableRow key={`group-${category}`} className="border-b border-slate-100 bg-slate-50/50 hover:bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/30">
                    <TableCell colSpan={canEdit || canDelete ? 7 : 6} className="h-11 px-4 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{category}</span>
                        <Badge variant="secondary" className="border-0 bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {rows.filter((row) => row.is_active).length} aktif
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>,
                  ...rows.map((item, index) => (
                    <TableRow key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/40">
                      <TableCell className="py-3 text-sm text-slate-500">
                        {index === 0 ? category : ''}
                      </TableCell>
                      <TableCell className="py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{item.subcategory}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-600 dark:text-slate-300">{item.account_code || '-'}</TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant="outline"
                          className={item.account_type === 'income'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300'
                            : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300'}
                        >
                          {item.account_type === 'income' ? 'Penghasilan' : item.account_type === 'cogs' ? 'HPP' : 'Pengeluaran'}
                        </Badge>
                      </TableCell>
                      <TableCell className="truncate py-3 text-sm text-slate-500">{item.description || '-'}</TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant="outline"
                          className={item.is_active
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300'
                            : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'}
                        >
                          {item.is_active ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </TableCell>
                      {(canEdit || canDelete) && (
                        <TableCell className="py-3">
                          <div className="flex justify-end gap-1">
                            {canEdit && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50 hover:text-blue-700" onClick={() => openEdit(item)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && item.is_active && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => setDeleteItem(item)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  )),
                ])}
              </TableBody>
            </Table>
          </div>
        </OperationalTableCard>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit Akun' : 'Tambah Akun'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label><RequiredLabel>Kategori</RequiredLabel></Label>
              <Input value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label><RequiredLabel>Nama Akun</RequiredLabel></Label>
              <Input value={form.subcategory} onChange={(event) => setForm((prev) => ({ ...prev, subcategory: event.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label><RequiredLabel>Kode</RequiredLabel></Label>
                <Input
                  value={form.account_code}
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="5 digit"
                  onChange={(event) => setForm((prev) => ({ ...prev, account_code: event.target.value.replace(/\D/g, '') }))}
                />
              </div>
              <div className="space-y-2">
                <Label><RequiredLabel>Tipe</RequiredLabel></Label>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900"
                  value={form.account_type}
                  onChange={(event) => setForm((prev) => ({ ...prev, account_type: event.target.value as FormState['account_type'] }))}
                >
                  <option value="income">Penghasilan</option>
                  <option value="expense">Pengeluaran</option>
                  <option value="cogs">HPP</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Input value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
            </div>
            <div className="space-y-2">
            <Label>Urutan</Label>
              <Input type="number" value={form.sort_order} onChange={(event) => setForm((prev) => ({ ...prev, sort_order: event.target.value }))} />
            </div>
            <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={form.is_active}
                onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
              />
              <span className="font-medium text-slate-700 dark:text-slate-200">Aktif</span>
            </label>
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

      <AlertDialog open={Boolean(deleteItem)} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nonaktifkan subkategori?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteItem ? `${deleteItem.category} - ${deleteItem.subcategory}` : 'Data ini'} tidak akan muncul di pilihan transaksi baru.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? 'Memproses...' : 'Nonaktifkan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
