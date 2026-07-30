import React from 'react';
import {
  Car,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Eye,
  EyeOff,
  Images,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Switch } from '@/app/components/ui/switch';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/app/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import {
  OperationalEmptyState,
  OperationalFilterPanel,
  OperationalKpiCard,
  OperationalKpiGrid,
  OperationalPageHeader,
  OperationalPageShell,
  OperationalTableCard,
  RequiredLabel,
} from '@/app/components/ui/operational-page';
import { cn } from '@/app/components/ui/utils';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useMasterData } from '@/app/pages/master-data/context';
import {
  createProofAsset,
  createProofAssetId,
  deleteProofAsset,
  deleteProofAssetImage,
  getProofAssetPublicUrl,
  listProofAssets,
  normalizeProofAssetTags,
  ProofAsset,
  updateProofAsset,
  uploadProofAssetImage,
} from '@/app/services/proofAssets';

const ALL_FILTER_VALUE = 'all';
const NONE_VEHICLE_VALUE = 'none';
const NONE_YEAR_VALUE = 'none';
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MIN_PROOF_ASSET_YEAR = 1980;
const MAX_PROOF_ASSET_YEAR = new Date().getFullYear() + 1;
const PROOF_ASSET_YEAR_OPTIONS = Array.from(
  { length: MAX_PROOF_ASSET_YEAR - MIN_PROOF_ASSET_YEAR + 1 },
  (_, index) => String(MAX_PROOF_ASSET_YEAR - index),
);

type AssetStatusFilter = 'all' | 'active' | 'inactive';

type ProofAssetFormState = {
  title: string;
  vehicleTypeId: string;
  year: string;
  tags: string;
  caption: string;
  isActive: boolean;
};

const emptyFormState: ProofAssetFormState = {
  title: '',
  vehicleTypeId: '',
  year: '',
  tags: '',
  caption: '',
  isActive: true,
};

const formatNumber = (value: number) => new Intl.NumberFormat('id-ID').format(value || 0);

const assetMatchesSearch = (asset: ProofAsset, search: string, vehicleName: string) => {
  const query = search.trim().toLowerCase();
  if (!query) return true;

  return [
    asset.id,
    asset.title,
    asset.caption || '',
    vehicleName,
    asset.year ? String(asset.year) : '',
    asset.tags.join(' '),
  ].some((value) => value.toLowerCase().includes(query));
};

export function ProofAssetLibraryPage() {
  const { vehicles, currentUser } = useMasterData();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('proof_assets.create');
  const canEdit = hasPermission('proof_assets.edit');
  const canDelete = hasPermission('proof_assets.delete');

  const [assets, setAssets] = React.useState<ProofAsset[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [vehicleFilter, setVehicleFilter] = React.useState(ALL_FILTER_VALUE);
  const [statusFilter, setStatusFilter] = React.useState<AssetStatusFilter>('active');
  const [formOpen, setFormOpen] = React.useState(false);
  const [vehicleComboboxOpen, setVehicleComboboxOpen] = React.useState(false);
  const [editingAsset, setEditingAsset] = React.useState<ProofAsset | null>(null);
  const [previewAsset, setPreviewAsset] = React.useState<ProofAsset | null>(null);
  const [formState, setFormState] = React.useState<ProofAssetFormState>(emptyFormState);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [selectedFilePreview, setSelectedFilePreview] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [deletingAsset, setDeletingAsset] = React.useState<ProofAsset | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const activeVehicles = React.useMemo(
    () => vehicles.filter((vehicle) => vehicle.status === 'active'),
    [vehicles],
  );

  const vehicleNameById = React.useMemo(
    () => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.name])),
    [vehicles],
  );

  const loadAssets = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAssets(await listProofAssets());
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat Galeri Bukti.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  React.useEffect(() => {
    if (!selectedFile) {
      setSelectedFilePreview('');
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setSelectedFilePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const filteredAssets = React.useMemo(() => {
    return assets.filter((asset) => {
      const vehicleName = asset.vehicleTypeId ? vehicleNameById.get(asset.vehicleTypeId) || '' : '';
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? asset.isActive : !asset.isActive);
      const matchesVehicle =
        vehicleFilter === ALL_FILTER_VALUE || asset.vehicleTypeId === vehicleFilter;

      return matchesStatus && matchesVehicle && assetMatchesSearch(asset, search, vehicleName);
    });
  }, [assets, search, statusFilter, vehicleFilter, vehicleNameById]);

  const stats = React.useMemo(() => {
    const active = assets.filter((asset) => asset.isActive).length;
    const inactive = assets.length - active;
    const usage = assets.reduce((sum, asset) => sum + asset.usageCount, 0);
    return {
      total: assets.length,
      active,
      inactive,
      usage,
    };
  }, [assets]);

  const resetForm = React.useCallback(() => {
    setEditingAsset(null);
    setVehicleComboboxOpen(false);
    setFormState(emptyFormState);
    setSelectedFile(null);
    setSelectedFilePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const openCreateForm = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditForm = (asset: ProofAsset) => {
    setEditingAsset(asset);
    setFormState({
      title: asset.title,
      vehicleTypeId: asset.vehicleTypeId || '',
      year: asset.year ? String(asset.year) : '',
      tags: asset.tags.join(', '),
      caption: asset.caption || '',
      isActive: asset.isActive,
    });
    setSelectedFile(null);
    setSelectedFilePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFormOpen(true);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Gambar harus JPG, PNG, atau WebP.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Ukuran gambar maksimal 25MB.');
      event.target.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const validateForm = () => {
    if (!formState.title.trim()) {
      toast.error('Nama aset wajib diisi.');
      return false;
    }

    if (!formState.vehicleTypeId) {
      toast.error('Tipe mobil wajib dipilih.');
      return false;
    }

    const yearValue = formState.year.trim();
    if (yearValue) {
      const parsedYear = Number(yearValue);
      if (
        !Number.isInteger(parsedYear) ||
        parsedYear < MIN_PROOF_ASSET_YEAR ||
        parsedYear > MAX_PROOF_ASSET_YEAR
      ) {
        toast.error(`Tahun harus antara ${MIN_PROOF_ASSET_YEAR} sampai ${MAX_PROOF_ASSET_YEAR}.`);
        return false;
      }
    }

    if (!editingAsset && !selectedFile) {
      toast.error('Gambar wajib diupload.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    let uploadedPath = '';
    try {
      const assetId = editingAsset?.id || createProofAssetId();
      const imagePath = selectedFile
        ? await uploadProofAssetImage(selectedFile, assetId)
        : editingAsset?.imagePath || '';
      uploadedPath = imagePath;

      const payload = {
        title: formState.title,
        vehicleTypeId: formState.vehicleTypeId,
        year: formState.year.trim() ? Number(formState.year) : null,
        imagePath,
        tags: normalizeProofAssetTags(formState.tags),
        caption: formState.caption,
        isActive: formState.isActive,
      };

      const savedAsset = editingAsset
        ? await updateProofAsset(editingAsset.id, payload)
        : await createProofAsset({
            ...payload,
            id: assetId,
            createdBy: currentUser?.id || null,
          });

      if (editingAsset && selectedFile && editingAsset.imagePath !== imagePath) {
        await deleteProofAssetImage(editingAsset.imagePath).catch(() => undefined);
      }

      setAssets((current) => {
        const exists = current.some((asset) => asset.id === savedAsset.id);
        if (exists) return current.map((asset) => asset.id === savedAsset.id ? savedAsset : asset);
        return [savedAsset, ...current];
      });
      toast.success(editingAsset ? 'Aset berhasil diperbarui.' : 'Aset berhasil ditambahkan.');
      setFormOpen(false);
      resetForm();
    } catch (err: any) {
      if (!editingAsset && uploadedPath) {
        await deleteProofAssetImage(uploadedPath).catch(() => undefined);
      }
      toast.error(err?.message || 'Gagal menyimpan aset.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingAsset) return;

    setSaving(true);
    try {
      await deleteProofAsset(deletingAsset.id);
      await deleteProofAssetImage(deletingAsset.imagePath).catch(() => undefined);
      setAssets((current) => current.filter((asset) => asset.id !== deletingAsset.id));
      toast.success('Aset berhasil dihapus.');
      setDeletingAsset(null);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menghapus aset.');
    } finally {
      setSaving(false);
    }
  };

  const previewUrl =
    selectedFilePreview ||
    (editingAsset ? getProofAssetPublicUrl(editingAsset.imagePath) : '');
  const selectedVehicleName = formState.vehicleTypeId
    ? vehicleNameById.get(formState.vehicleTypeId) || 'Tipe mobil tidak tersedia'
    : 'Belum pilih';

  return (
    <OperationalPageShell>
      <OperationalPageHeader
        eyebrow="Library"
        icon={Images}
        title="Galeri Bukti"
        subtitle="Koleksi gambar hasil edit, before-after, dan testimoni yang rapi untuk dipakai lintas fitur."
        actions={
          <>
            <Button variant="outline" onClick={() => void loadAssets()} disabled={loading}>
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </Button>
            {canCreate && (
              <Button
                className="h-9 bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                onClick={openCreateForm}
              >
                <Plus className="mr-2 h-4 w-4" />
                Tambah Aset
              </Button>
            )}
          </>
        }
      />

      <OperationalKpiGrid>
        <OperationalKpiCard label="Total Aset" value={formatNumber(stats.total)} icon={Images} />
        <OperationalKpiCard label="Aktif" value={formatNumber(stats.active)} icon={Eye} tone="emerald" />
        <OperationalKpiCard label="Nonaktif" value={formatNumber(stats.inactive)} icon={EyeOff} tone="amber" />
        <OperationalKpiCard label="Terpakai" value={formatNumber(stats.usage)} icon={CheckCircle2} tone="blue" />
      </OperationalKpiGrid>

      <OperationalFilterPanel>
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
              placeholder="Cari judul, tipe mobil, tahun, tags, caption, atau ID"
            />
          </div>
          <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Semua tipe mobil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>Semua tipe mobil</SelectItem>
              {activeVehicles.map((vehicle) => (
                <SelectItem key={vehicle.id} value={vehicle.id}>
                  {vehicle.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as AssetStatusFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="inactive">Nonaktif</SelectItem>
              <SelectItem value="all">Semua status</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </OperationalFilterPanel>

      <OperationalTableCard>
        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 pb-10">
            <OperationalEmptyState
              icon={Images}
              title="Galeri belum siap"
              description={error}
              className="pb-0"
            />
            <Button variant="outline" onClick={() => void loadAssets()}>
              Coba Lagi
            </Button>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 pb-10">
            <OperationalEmptyState
              icon={Images}
              title="Belum ada aset"
              description="Aset yang cocok dengan filter belum tersedia."
              className="pb-0"
            />
            {canCreate && (
              <Button onClick={openCreateForm}>
                Tambah Aset
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredAssets.map((asset) => {
              const vehicleName = asset.vehicleTypeId
                ? vehicleNameById.get(asset.vehicleTypeId) || 'Tipe mobil tidak tersedia'
                : 'Tanpa tipe mobil';
              const imageUrl = getProofAssetPublicUrl(asset.imagePath);

              return (
                <article
                  key={asset.id}
                  className="group overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:shadow-[0_10px_28px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                >
                  <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-800">
                    <img
                      src={imageUrl}
                      alt={asset.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/35 to-transparent opacity-70" />
                    <div className="absolute left-3 top-3">
                      <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-white/88 px-2 text-[11px] font-medium text-slate-700 shadow-sm backdrop-blur dark:bg-slate-950/75 dark:text-slate-200">
                        <span className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          asset.isActive ? 'bg-emerald-500' : 'bg-slate-400',
                        )} />
                        {asset.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                    <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 rounded-full bg-white/88 text-slate-600 shadow-sm backdrop-blur hover:bg-white"
                        aria-label={`Lihat ${asset.title}`}
                        title="Lihat detail"
                        onClick={() => setPreviewAsset(asset)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                        {canEdit && (
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 rounded-full bg-white/88 text-slate-600 shadow-sm backdrop-blur hover:bg-white"
                            onClick={() => openEditForm(asset)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 rounded-full bg-white/88 text-red-500 shadow-sm backdrop-blur hover:bg-white hover:text-red-600"
                            onClick={() => setDeletingAsset(asset)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="min-w-0 space-y-1">
                      <h2 className="truncate text-sm font-semibold leading-5 text-slate-900 dark:text-slate-100">
                        {asset.title}
                      </h2>
                      <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <Car className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{vehicleName}{asset.year ? ` - ${asset.year}` : ''}</span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </OperationalTableCard>

      <Dialog open={Boolean(previewAsset)} onOpenChange={(open) => !open && setPreviewAsset(null)}>
        {previewAsset && (() => {
          const imageUrl = getProofAssetPublicUrl(previewAsset.imagePath);

          return (
            <DialogContent className="max-h-[94dvh] w-auto max-w-[calc(100vw-1rem)] overflow-hidden border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
              <DialogHeader className="sr-only">
                <DialogTitle>{previewAsset.title}</DialogTitle>
                <DialogDescription>Preview gambar aset.</DialogDescription>
              </DialogHeader>
              <div className="flex max-h-[88dvh] max-w-[calc(100vw-1rem)] items-center justify-center bg-white p-1 dark:bg-slate-950">
                <img
                  src={imageUrl}
                  alt={previewAsset.title}
                  className="block max-h-[88dvh] max-w-[calc(100vw-1rem)] rounded-md object-contain"
                />
              </div>
            </DialogContent>
          );
        })()}
      </Dialog>

      <Dialog open={formOpen} onOpenChange={(open) => {
        setFormOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAsset ? 'Edit Aset' : 'Tambah Aset'}</DialogTitle>
            <DialogDescription>
              {editingAsset ? editingAsset.id : 'Upload gambar final dan metadata aset.'}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
              <div className="space-y-3">
                <Label>
                  <RequiredLabel>Gambar</RequiredLabel>
                </Label>
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Preview aset"
                      className="aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center text-slate-400">
                      <Images className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Pilih Gambar
                </Button>
                <p className="text-xs leading-5 text-slate-500">
                  Gambar otomatis dikompres untuk tampilan app.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="proof-title">
                    <RequiredLabel>Nama Aset</RequiredLabel>
                  </Label>
                  <Input
                    id="proof-title"
                    value={formState.title}
                    onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Contoh: Innova lampu kuning"
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    <RequiredLabel>Tipe Mobil</RequiredLabel>
                  </Label>
                  <Popover open={vehicleComboboxOpen} onOpenChange={setVehicleComboboxOpen}>
                    <PopoverTrigger
                      type="button"
                      role="combobox"
                      aria-expanded={vehicleComboboxOpen}
                      className={cn(
                        'flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-sm font-normal shadow-sm outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900',
                        !formState.vehicleTypeId && 'text-slate-500',
                      )}
                    >
                      <span className="truncate">{selectedVehicleName}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0"
                    >
                      <Command>
                        <CommandInput placeholder="Cari tipe mobil..." />
                        <CommandList>
                          <CommandEmpty>Tipe mobil tidak ditemukan.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value={NONE_VEHICLE_VALUE}
                              onSelect={() => {
                                setFormState((current) => ({ ...current, vehicleTypeId: '' }));
                                setVehicleComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  !formState.vehicleTypeId ? 'opacity-100' : 'opacity-0',
                                )}
                              />
                              Belum pilih
                            </CommandItem>
                            {activeVehicles.map((vehicle) => (
                              <CommandItem
                                key={vehicle.id}
                                value={`${vehicle.name} ${vehicle.category || ''}`}
                                onSelect={() => {
                                  setFormState((current) => ({ ...current, vehicleTypeId: vehicle.id }));
                                  setVehicleComboboxOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    formState.vehicleTypeId === vehicle.id ? 'opacity-100' : 'opacity-0',
                                  )}
                                />
                                <span className="truncate">{vehicle.name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="proof-year">Tahun</Label>
                  <Select
                    value={formState.year || NONE_YEAR_VALUE}
                    onValueChange={(value) => setFormState((current) => ({
                      ...current,
                      year: value === NONE_YEAR_VALUE ? '' : value,
                    }))}
                  >
                    <SelectTrigger id="proof-year">
                      <SelectValue placeholder="Pilih tahun" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_YEAR_VALUE}>Belum pilih</SelectItem>
                      {PROOF_ASSET_YEAR_OPTIONS.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="proof-tags">Tags</Label>
                  <Input
                    id="proof-tags"
                    value={formState.tags}
                    onChange={(event) => setFormState((current) => ({ ...current, tags: event.target.value }))}
                    placeholder="kuning, buram, home service"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="proof-caption">Caption</Label>
                  <Textarea
                    id="proof-caption"
                    value={formState.caption}
                    onChange={(event) => setFormState((current) => ({ ...current, caption: event.target.value }))}
                    placeholder="Deskripsi singkat tentang mobil atau gambar"
                    rows={3}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                  <Label htmlFor="proof-active" className="text-sm">
                    Status Aktif
                  </Label>
                  <Switch
                    id="proof-active"
                    checked={formState.isActive}
                    onCheckedChange={(checked) => setFormState((current) => ({ ...current, isActive: checked }))}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFormOpen(false);
                  resetForm();
                }}
                disabled={saving}
              >
                Batal
              </Button>
              <Button type="submit" disabled={saving || (!canCreate && !editingAsset) || (!canEdit && Boolean(editingAsset))}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deletingAsset)} onOpenChange={(open) => !open && setDeletingAsset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus aset?</AlertDialogTitle>
            <AlertDialogDescription>
              Aset {deletingAsset?.title || ''} akan dihapus dari library dan storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              disabled={saving}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </OperationalPageShell>
  );
}
