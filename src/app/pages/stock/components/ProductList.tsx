import React, { useState, useEffect } from 'react';
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/app/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Label } from "@/app/components/ui/label";
import { Plus, Search, MoreHorizontal, Edit, Trash2, RefreshCcw, Loader2, Wand2, Check, ChevronsUpDown, Building2, UserCircle, ClipboardList, AlertTriangle, Boxes, PackageCheck, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";
import { Badge } from "@/app/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/app/components/ui/alert";
import { useMasterData } from "@/app/pages/master-data/context";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/app/components/ui/command";
import { cn } from "@/app/components/ui/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/app/components/ui/alert-dialog";
import { usePermissions } from "@/app/hooks/usePermissions";
import { logActivity } from "@/app/services/auditService";
import { StockCard } from "./StockCard";
import { STOCK_UPDATED_EVENT, emitStockUpdated, groupTransactionsByProduct, reconcileProductStock, toStockNumber, type StockTransactionLike } from "../utils/stockLedger";
import { isMissingStockTransactionScopeColumnError, omitStockTransactionScope, retryWithoutInvalidStockScope, type StockScopeField } from "../utils/stockTransactionScope";
import { isTechnicianRole } from "@/app/data/roleHelpers";
import {
  OperationalEmptyState,
  OperationalFilterPanel,
  OperationalKpiCard,
  OperationalKpiGrid,
  OperationalTableCard,
} from "@/app/components/ui/operational-page";

interface Product {
  id: string;
  sku?: string;
  name: string;
  category: string;
  service_type: string;
  unit: string;
  branch_id?: string;
  technician_id?: string;
  current_qty: number;
  average_cost: number;
  sell_price?: number;
  min_stock?: number;
  description?: string;
  updated_at?: string;
  recorded_qty?: number;
  recorded_average_cost?: number;
  stock_delta?: number;
  stock_value_delta?: number;
  stock_has_transactions?: boolean;
  stock_needs_review?: boolean;
}

interface ReferenceData {
    id: string;
    name: string;
}

interface ProductPayload extends Record<string, unknown> {
  name: string;
  category: string;
  service_type: string;
  unit: string;
  branch_id: string | null;
  technician_id: string | null;
  min_stock: number;
  sell_price: number;
  description: string;
  updated_at?: string;
  sku?: string;
  current_qty?: number;
  average_cost?: number;
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || error);
  }

  return String(error);
};

export function ProductList() {
  const { services, activeBranches, users, currentUser } = useMasterData();
  const { hasPermission } = usePermissions();
  const activeServices = services.filter(s => s.status === 'active');
  const canCreateProduct = hasPermission('inventory.create');
  const canEditProduct = hasPermission('inventory.edit');
  const canDeleteProduct = hasPermission('inventory.delete');
  const canViewStockCard = hasPermission('stock.card.view');
  const hasProductActions = canViewStockCard || canEditProduct || canDeleteProduct;

  // Filter technicians from users list
  const technicians = users.filter(u => isTechnicianRole(u.role) && u.status === 'active');

  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<ReferenceData[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Unit Combobox State
  const [unitPopoverOpen, setUnitPopoverOpen] = useState(false);
  const [unitSearch, setUnitSearch] = useState("");

  // Category Combobox State
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");

  // Form validation state
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({});
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // Kartu Stok State
  const [stockCardOpen, setStockCardOpen] = useState(false);
  const [stockCardProduct, setStockCardProduct] = useState<Product | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
      sku: '',
      name: '',
      category: '',
      service_type: '',
      unit: '',
      branch_id: '',
      technician_id: '',
      min_stock: '0',
      sell_price: '0',
      description: '',
      initial_qty: '0', // Only for new products
      initial_cost: '0' // Only for new products
  });

  useEffect(() => {
    fetchData();

    const handleStockUpdate = () => {
      fetchData();
    };

    window.addEventListener(STOCK_UPDATED_EVENT, handleStockUpdate);
    return () => window.removeEventListener(STOCK_UPDATED_EVENT, handleStockUpdate);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
        const [productsRes, transactionsRes, unitsRes] = await Promise.all([
            supabase.from('products').select('*').order('name', { ascending: true }),
            supabase
              .from('stock_transactions')
              .select('id, product_id, type, quantity, unit_price, total_value, date, created_at'),
            supabase.from('stock_units').select('*').order('name', { ascending: true })
        ]);

        if (productsRes.error) throw productsRes.error;
        if (transactionsRes.error) throw transactionsRes.error;
        if (unitsRes.error) throw unitsRes.error;

        const transactionsByProduct = groupTransactionsByProduct((transactionsRes.data || []) as StockTransactionLike[]);
        const nextProducts = (productsRes.data || []).map((product) => {
          const stockState = reconcileProductStock(product, transactionsByProduct.get(product.id) || []);
          return {
            ...product,
            current_qty: stockState.effectiveQty,
            average_cost: stockState.effectiveAverageCost,
            recorded_qty: stockState.recordedQty,
            recorded_average_cost: stockState.recordedAverageCost,
            stock_delta: stockState.quantityDelta,
            stock_value_delta: stockState.averageCostDelta,
            stock_has_transactions: stockState.hasTransactions,
            stock_needs_review: stockState.hasMismatch,
          } as Product;
        });

        setProducts(nextProducts);
        setUnits(unitsRes.data || []);

    } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Gagal memuat data produk");
    } finally {
        setLoading(false);
    }
  };

  const getScopeCompatibilityMessages = (fields: StockScopeField[], target: 'product' | 'history') => {
    const messages: string[] = [];

    if (fields.includes('branch_id')) {
      messages.push(
        target === 'product'
          ? "Cabang owner produk belum ikut tersimpan karena schema `products.branch_id` masih format lama."
          : "Cabang saldo awal belum ikut tersimpan ke histori transaksi karena schema `stock_transactions.branch_id` masih format lama."
      );
    }

    if (fields.includes('technician_id')) {
      messages.push(
        target === 'product'
          ? "Teknisi owner produk belum ikut tersimpan karena schema `products.technician_id` masih format lama."
          : "Teknisi saldo awal belum ikut tersimpan ke histori transaksi karena schema `stock_transactions.technician_id` masih format lama."
      );
    }

    return messages;
  };

  const saveProductWithScopeCompatibility = async (payload: ProductPayload, productId?: string) => {
    const result = await retryWithoutInvalidStockScope(payload, async (nextPayload) => {
      if (productId) {
        return await supabase
          .from('products')
          .update(nextPayload)
          .eq('id', productId)
          .select();
      }

      return await supabase
        .from('products')
        .insert([nextPayload])
        .select();
    });

    if (result.error) throw result.error;

    if (result.omittedScopeFields.length > 0) {
      console.warn(
        `[Stock] Simpan products memakai fallback kompatibilitas tanpa scope: ${result.omittedScopeFields.join(', ')}`
      );
    }

    return {
      data: result.data || [],
      omittedScopeFields: result.omittedScopeFields,
    };
  };

  const handleSave = async () => {
    if (isEditMode && !canEditProduct) {
      toast.error("Anda tidak memiliki izin untuk mengubah produk");
      return;
    }

    if (!isEditMode && !canCreateProduct) {
      toast.error("Anda tidak memiliki izin untuk menambah produk");
      return;
    }

    // Validate required fields
    const errors: Record<string, string> = {};
    if (!isEditMode && !formData.sku.trim()) errors.sku = "SKU / Kode wajib diisi";
    if (!formData.name.trim()) errors.name = "Nama Barang wajib diisi";
    if (!formData.service_type) errors.service_type = "Jenis Layanan wajib dipilih";
    if (!formData.unit) errors.unit = "Satuan wajib dipilih";
    if (Number(formData.min_stock) < 0) errors.min_stock = "Minimum stok tidak boleh negatif";
    if (Number(formData.sell_price) < 0) errors.sell_price = "Harga jual tidak boleh negatif";
    if (!isEditMode && Number(formData.initial_qty) < 0) {
      errors.initial_qty = "Stok awal tidak boleh negatif";
    }
    if (!isEditMode && Number(formData.initial_qty) > 0 && Number(formData.initial_cost) <= 0) {
      errors.initial_cost = "HPP Awal wajib diisi";
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Mohon lengkapi semua field wajib yang ditandai *");
      return;
    }

    setLoading(true);
    try {
        const openingQty = Number(formData.initial_qty);
        const openingCost = Number(formData.initial_cost || 0);
        const compatibilityWarnings = new Set<string>();
        let savedProductId = currentProduct.id || '';
        const payload: ProductPayload = {
            name: formData.name,
            category: formData.category,
            service_type: formData.service_type,
            unit: formData.unit,
            branch_id: formData.branch_id || null,
            technician_id: formData.technician_id || null,
            min_stock: Number(formData.min_stock),
            sell_price: Number(formData.sell_price),
            description: formData.description,
        };

        if (isEditMode && currentProduct.id) {
            // SKU tidak diubah saat edit
            payload.updated_at = new Date().toISOString();
            console.log('[Edit Product] Payload:', JSON.stringify(payload));
            console.log('[Edit Product] ID:', currentProduct.id);
            
            const { data, omittedScopeFields } = await saveProductWithScopeCompatibility(payload, currentProduct.id);
            getScopeCompatibilityMessages(omittedScopeFields, 'product').forEach((message) => compatibilityWarnings.add(message));
            savedProductId = data?.[0]?.id || currentProduct.id || '';
            
            console.log('[Edit Product] Response data:', data);
            
            if (!data || data.length === 0) {
                console.warn('[Edit Product] No rows updated — kemungkinan RLS atau ID tidak ditemukan');
                toast.error("Produk tidak ditemukan atau tidak bisa diupdate");
                setLoading(false);
                return;
            }
        } else {
            // SKU hanya di-set saat tambah baru
            payload.sku = formData.sku;
            // Initial Stock (Treat as opening balance)
            payload.current_qty = openingQty;
            payload.average_cost = openingQty > 0 ? openingCost : 0;
            
            console.log('[Add Product] Payload:', JSON.stringify(payload));
            
            const { data, omittedScopeFields } = await saveProductWithScopeCompatibility(payload);
            getScopeCompatibilityMessages(omittedScopeFields, 'product').forEach((message) => compatibilityWarnings.add(message));
            
            console.log('[Add Product] Response data:', data);

            const insertedProduct = data?.[0];
            if (!insertedProduct) {
                throw new Error("Produk baru gagal dibaca setelah disimpan");
            }
            savedProductId = insertedProduct.id;

            if (openingQty > 0) {
                const openingTransaction = {
                    product_id: insertedProduct.id,
                    type: 'IN' as const,
                    quantity: openingQty,
                     unit_price: openingCost,
                     total_value: openingQty * openingCost,
                     branch_id: formData.branch_id || null,
                     technician_id: formData.technician_id || null,
                     notes: 'Saldo awal produk',
                    date: new Date().toISOString().split('T')[0],
                };

                    const openingResult = await retryWithoutInvalidStockScope(openingTransaction, async (nextPayload) =>
                    await supabase
                        .from('stock_transactions')
                        .insert([nextPayload])
                );

                let openingError = openingResult.error;
                getScopeCompatibilityMessages(openingResult.omittedScopeFields, 'history').forEach((message) => compatibilityWarnings.add(message));

                if (openingError && isMissingStockTransactionScopeColumnError(openingError)) {
                    console.warn("[Stock] Kolom snapshot branch/technician belum ada di stock_transactions. Saldo awal tetap disimpan tanpa scope histori.");
                    const retry = await supabase
                        .from('stock_transactions')
                        .insert([omitStockTransactionScope(openingTransaction)]);
                    openingError = retry.error;
                    if (!openingError) {
                        compatibilityWarnings.add("Snapshot cabang dan teknisi saldo awal belum ikut tersimpan ke histori transaksi karena kolom scope di `stock_transactions` belum ada di database.");
                    }
                }

                if (openingError) {
                    await supabase.from('products').delete().eq('id', insertedProduct.id);
                    throw new Error(`Produk tersimpan tetapi transaksi saldo awal gagal dibuat: ${getErrorMessage(openingError)}`);
                }
            }
        }
        
        toast.success(isEditMode ? "Produk diperbarui" : "Produk ditambahkan");
        if (compatibilityWarnings.size > 0) {
          toast.warning(Array.from(compatibilityWarnings).join(' '), {
            duration: 7000,
          });
        }
        if (currentUser) {
          logActivity(
            { id: currentUser.id, name: currentUser.name, role: currentUser.role },
            isEditMode ? 'UPDATE' : 'CREATE',
            'Inventaris',
            `${isEditMode ? 'Memperbarui' : 'Menambahkan'} produk: ${formData.name} (${formData.sku})`,
            savedProductId
          );
        }
        setIsDialogOpen(false);
        emitStockUpdated();

    } catch (error: any) {
        console.error("Error saving product:", error);
        toast.error(`Gagal menyimpan produk: ${error.message || error}`);
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canDeleteProduct) {
        toast.error("Anda tidak memiliki izin untuk menghapus produk");
        return;
    }

    try {
        // Cek apakah ada transaksi terkait
        const { count, error: countError } = await supabase
            .from('stock_transactions')
            .select('id', { count: 'exact', head: true })
            .eq('product_id', id);

        if (countError) throw countError;

        if (count && count > 0) {
            toast.error(`Tidak bisa hapus: produk memiliki ${count} transaksi terkait. Batalkan transaksinya terlebih dahulu.`);
            setDeleteTarget(null);
            return;
        }

        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) throw error;

        toast.success("Produk dihapus");
        const deletedProduct = products.find(p => p.id === id);
        if (currentUser && deletedProduct) {
          logActivity(
            { id: currentUser.id, name: currentUser.name, role: currentUser.role },
            'DELETE',
            'Inventaris',
            `Menghapus produk: ${deletedProduct.name} (${deletedProduct.sku})`,
            id
          );
        }
        setProducts(products.filter(p => p.id !== id));
        emitStockUpdated();
    } catch (error: any) {
        if (!error.message?.includes('transaksi')) {
            toast.error("Gagal menghapus produk");
        }
    } finally {
        setDeleteTarget(null);
    }
  };

  const openAddDialog = () => {
    if (!canCreateProduct) {
      toast.error("Anda tidak memiliki izin untuk menambah produk");
      return;
    }

    setIsEditMode(false);
    setFormErrors({});
    setFormData({
        sku: '', 
        name: '', 
        category: '', 
        service_type: '', 
        unit: '', 
        branch_id: '',
        technician_id: '',
        min_stock: '0', 
        sell_price: '0', 
        description: '', 
        initial_qty: '0', 
        initial_cost: '0'
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    if (!canEditProduct) {
      toast.error("Anda tidak memiliki izin untuk mengubah produk");
      return;
    }

    setIsEditMode(true);
    setFormErrors({});
    setCurrentProduct(product);
    setFormData({
        sku: product.sku || '',
        name: product.name,
        category: product.category || '',
        service_type: product.service_type || '',
        unit: product.unit || '',
        branch_id: product.branch_id || '',
        technician_id: product.technician_id || '',
        min_stock: String(product.min_stock || 0),
        sell_price: String(product.sell_price || 0),
        description: product.description || '',
        initial_qty: String(product.current_qty), 
        initial_cost: String(product.average_cost) 
    });
    setIsDialogOpen(true);
  };

  // Filter Logic
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || p.service_type === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Calculate Summary
  const totalItems = filteredProducts.length;
  const totalValue = filteredProducts.reduce((sum, p) => sum + (toStockNumber(p.current_qty) * toStockNumber(p.average_cost)), 0);
  const lowStockCount = filteredProducts.filter((product) => product.current_qty <= (product.min_stock || 0)).length;
  const stockMismatchCount = filteredProducts.filter((product) => product.stock_needs_review).length;

  const generateSKU = () => {
    let prefix = 'PRD';
    if (formData.category && formData.category.length >= 3) {
        prefix = formData.category.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
    }
    const random = Math.floor(1000 + Math.random() * 9000); // 4 digit random
    const newSku = `${prefix}-${random}`;
    setFormData(prev => ({ ...prev, sku: newSku }));
  };

  // Create new unit and add to list
  const handleCreateUnit = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
        const { data, error } = await supabase
            .from('stock_units')
            .insert([{ name: trimmed }])
            .select();
        if (error) {
            if (error.code === '23505') {
                toast.error("Satuan sudah ada");
            } else {
                throw error;
            }
            return;
        }
        setUnits(prev => [...prev, data[0]]);
        setFormData(prev => ({ ...prev, unit: trimmed }));
        setUnitSearch("");
        setUnitPopoverOpen(false);
        toast.success(`Satuan "${trimmed}" ditambahkan`);
    } catch (err) {
        toast.error("Gagal menyimpan satuan baru");
    }
  };

  // Check if unitSearch matches an existing unit
  const unitSearchTrimmed = unitSearch.trim().toLowerCase();
  const filteredUnits = units.filter(u => u.name.toLowerCase().includes(unitSearchTrimmed));
  const exactUnitMatch = units.some(u => u.name.toLowerCase() === unitSearchTrimmed);

  // Category combobox: unique categories from existing products
  const uniqueCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
  const categorySearchTrimmed = categorySearch.trim().toLowerCase();
  const filteredCategories = uniqueCategories.filter(c => c.toLowerCase().includes(categorySearchTrimmed));
  const exactCategoryMatch = uniqueCategories.some(c => c.toLowerCase() === categorySearchTrimmed);

  return (
    <div className="space-y-4">
      {/* Filters & Actions */}
      <OperationalFilterPanel className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
        <div className="grid w-full gap-2 sm:grid-cols-[minmax(0,320px)_180px]">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input 
                    placeholder="Cari nama barang..." 
                    className="h-9 border-slate-200 bg-slate-50 pl-9 shadow-none focus-visible:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
             <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-9 border-slate-200 bg-slate-50 shadow-none dark:border-slate-800 dark:bg-slate-950">
                    <SelectValue placeholder="Filter Layanan" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Semua Layanan</SelectItem>
                    {activeServices.map((type) => (
                        <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                    ))}
                </SelectContent>
             </Select>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
            <Button variant="outline" size="icon" onClick={fetchData} title="Refresh" className="h-9 w-9 shrink-0 border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {canCreateProduct && (
                <Button onClick={openAddDialog} className="h-9 flex-1 bg-blue-600 text-white shadow-sm hover:bg-blue-700 sm:flex-none">
                    <Plus className="mr-2 h-4 w-4" /> Tambah Produk
                </Button>
            )}
        </div>
      </OperationalFilterPanel>

      {/* Summary Cards */}
      <OperationalKpiGrid className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <OperationalKpiCard label="Total Produk" value={totalItems} icon={Boxes} tone="blue" />
          <OperationalKpiCard
            label="Total Nilai Aset"
            value={`Rp ${totalValue.toLocaleString('id-ID')}`}
            icon={WalletCards}
            tone="emerald"
            className="xl:col-span-2"
          />
          <OperationalKpiCard label="Perlu Restock" value={lowStockCount} icon={PackageCheck} tone={lowStockCount > 0 ? "amber" : "default"} />
      </OperationalKpiGrid>

      {stockMismatchCount > 0 && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Stok diselaraskan dari histori transaksi</AlertTitle>
          <AlertDescription>
            {stockMismatchCount} produk terdeteksi punya selisih antara data tabel dan histori mutasi.
            Tampilan inventaris sekarang memakai histori transaksi agar angka stok lebih konsisten.
          </AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <OperationalTableCard>
        <Table className="min-w-[1240px]">
          <TableHeader className="bg-slate-50/80 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
            <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
              <TableHead className="h-11 w-[56px] text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">No</TableHead>
              <TableHead className="h-11 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">SKU</TableHead>
              <TableHead className="h-11 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Nama Barang</TableHead>
              <TableHead className="h-11 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cabang</TableHead>
              <TableHead className="h-11 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Teknisi</TableHead>
              <TableHead className="h-11 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Kategori</TableHead>
              <TableHead className="h-11 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Layanan</TableHead>
              <TableHead className="h-11 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Stok</TableHead>
              <TableHead className="h-11 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">HPP (Avg)</TableHead>
              <TableHead className="h-11 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Harga Jual</TableHead>
              <TableHead className="h-11 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Nilai</TableHead>
              {hasProductActions && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && products.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={hasProductActions ? 12 : 11} className="h-32 text-center border-0">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
                    </TableCell>
                 </TableRow>
            ) : filteredProducts.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={hasProductActions ? 12 : 11} className="border-0">
                        <OperationalEmptyState icon={Boxes} title="Tidak ada data produk" description="Belum ada produk yang cocok dengan filter saat ini." className="py-12" />
                    </TableCell>
                 </TableRow>
            ) : (
                filteredProducts.map((product, index) => (
                    <TableRow
                      key={product.id}
                      className={cn(
                        "border-slate-100 hover:bg-blue-50/40 dark:border-slate-800 dark:hover:bg-slate-800/60",
                        product.stock_needs_review && "bg-amber-50/30 dark:bg-amber-950/10",
                        product.current_qty <= (product.min_stock || 0) && !product.stock_needs_review && "bg-red-50/20 dark:bg-red-950/10"
                      )}
                    >
                        <TableCell className="w-[56px] text-xs font-semibold text-slate-400">
                            <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border border-slate-200 bg-white px-2 tabular-nums text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                              {index + 1}
                            </span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 font-mono">
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                              {product.sku || '-'}
                            </span>
                        </TableCell>
                        <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={cn(
                                  "h-2 w-2 rounded-full",
                                  product.stock_needs_review
                                    ? "bg-amber-500"
                                    : product.current_qty <= (product.min_stock || 0)
                                    ? "bg-red-500"
                                    : "bg-emerald-500"
                                )}
                              />
                              <span>{product.name}</span>
                              {product.current_qty <= (product.min_stock || 0) && (
                                <Badge variant="destructive" className="text-[10px] h-5 px-1">Low Stock</Badge>
                              )}
                              {product.stock_needs_review && (
                                <Badge className="h-5 border-amber-200 bg-amber-100 px-1.5 text-[10px] text-amber-800 hover:bg-amber-100">
                                  Audit Histori
                                </Badge>
                              )}
                            </div>
                            {product.stock_needs_review && typeof product.recorded_qty === 'number' && (
                              <p className="mt-1 text-[11px] font-normal text-amber-700">
                                Data tersimpan: {product.recorded_qty} {product.unit}
                              </p>
                            )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-cyan-50 px-2 py-1 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300">
                              <Building2 className="h-3 w-3" />
                              {product.branch_id ? (activeBranches.find(b => b.id === product.branch_id)?.name || '-') : '-'}
                            </span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2 py-1 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300">
                              <UserCircle className="h-3 w-3" />
                              {product.technician_id ? (users.find(u => u.id === product.technician_id)?.name || '-') : '-'}
                            </span>
                        </TableCell>
                        <TableCell>
                            <Badge variant="outline" className="rounded-md border-violet-200 bg-violet-50 font-medium text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300">
                              {product.category || '-'}
                            </Badge>
                        </TableCell>
                        <TableCell>
                            <Badge variant="secondary" className="rounded-md bg-sky-50 font-medium text-sky-700 hover:bg-sky-50 dark:bg-sky-950/30 dark:text-sky-300">{product.service_type}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                            <span
                              className={cn(
                                "inline-flex items-baseline gap-1 rounded-md px-2 py-1 tabular-nums",
                                product.current_qty <= (product.min_stock || 0)
                                  ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                              )}
                            >
                              {product.current_qty} <span className="text-xs font-normal opacity-70">{product.unit}</span>
                            </span>
                        </TableCell>
                        <TableCell className={cn("text-right tabular-nums", product.stock_needs_review ? "text-amber-700 dark:text-amber-300" : "text-slate-600 dark:text-slate-400")}>
                            {product.average_cost?.toLocaleString('id-ID')}
                            <span className="text-[10px] text-slate-400 block">/{product.unit}</span>
                            {product.stock_needs_review && typeof product.recorded_average_cost === 'number' && (
                              <span className="text-[10px] text-amber-600 block">
                                Tabel lama: Rp {product.recorded_average_cost.toLocaleString('id-ID')}
                              </span>
                            )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-blue-600">
                             {product.sell_price ? (
                                <>
                                    {product.sell_price.toLocaleString('id-ID')}
                                    <span className="text-[10px] text-slate-400 block font-normal">/{product.unit}</span>
                                </>
                             ) : '-'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-slate-800 dark:text-slate-200">
                            <span className="inline-flex rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                              {(product.current_qty * product.average_cost).toLocaleString('id-ID')}
                            </span>
                        </TableCell>
                        {hasProductActions && (
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                                            <span className="sr-only">Open menu</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        {canViewStockCard && (
                                            <DropdownMenuItem onClick={() => { setStockCardProduct(product); setStockCardOpen(true); }}>
                                                <ClipboardList className="mr-2 h-4 w-4" /> Kartu Stok
                                            </DropdownMenuItem>
                                        )}
                                        {canEditProduct && (
                                            <DropdownMenuItem onClick={() => openEditDialog(product)}>
                                                <Edit className="mr-2 h-4 w-4" /> Edit Detail
                                            </DropdownMenuItem>
                                        )}
                                        {canDeleteProduct && (
                                            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleteTarget(product)}>
                                                <Trash2 className="mr-2 h-4 w-4" /> Hapus
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        )}
                    </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </OperationalTableCard>

      {/* Dialog Form */}
      <Sheet open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <SheetContent side="right" className="w-[400px] sm:w-[480px] sm:max-w-[480px] z-[150] flex flex-col h-full p-0 gap-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
            <SheetHeader className="shrink-0 border-b border-slate-100 bg-slate-50/80 p-6 pb-4 text-left dark:border-slate-800 dark:bg-slate-900">
                <SheetTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">{isEditMode ? 'Edit Produk' : 'Tambah Produk Baru'}</SheetTitle>
                <SheetDescription className="text-slate-500 text-sm">
                    {isEditMode ? 'Perbarui informasi detail produk.' : 'Isi data untuk menambahkan produk baru.'}
                </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Row 1: Kategori + SKU */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label className="text-xs text-slate-500">Kategori</Label>
                        <Popover open={categoryPopoverOpen} onOpenChange={(open) => { setCategoryPopoverOpen(open); if (!open) setCategorySearch(""); }}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={categoryPopoverOpen}
                                    className="w-full justify-between bg-slate-50 border-slate-200 font-normal hover:bg-slate-100 h-9 text-sm"
                                >
                                    {formData.category || <span className="text-muted-foreground">Pilih kategori...</span>}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[200]" align="start">
                                <Command shouldFilter={false}>
                                    <CommandInput placeholder="Cari atau ketik kategori baru..." value={categorySearch} onValueChange={setCategorySearch} />
                                    <CommandList>
                                        {filteredCategories.length === 0 && !categorySearch.trim() && (
                                            <CommandEmpty>Belum ada kategori. Ketik untuk membuat baru.</CommandEmpty>
                                        )}
                                        {filteredCategories.length > 0 && (
                                            <CommandGroup heading="Kategori Tersedia">
                                                {filteredCategories.map(cat => (
                                                    <CommandItem 
                                                        key={cat} 
                                                        value={cat} 
                                                        onSelect={() => {
                                                            setFormData(prev => ({...prev, category: cat}));
                                                            setCategoryPopoverOpen(false);
                                                            setCategorySearch("");
                                                        }}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", formData.category === cat ? "opacity-100" : "opacity-0")} />
                                                        {cat}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        )}
                                        {categorySearch.trim() && !exactCategoryMatch && (
                                            <CommandGroup heading="Buat Baru">
                                                <CommandItem 
                                                    value={`create-cat-${categorySearch}`}
                                                    onSelect={() => {
                                                        setFormData(prev => ({...prev, category: categorySearch.trim()}));
                                                        setCategoryPopoverOpen(false);
                                                        setCategorySearch("");
                                                    }}
                                                    className="text-blue-600"
                                                >
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Tambah kategori &quot;{categorySearch.trim()}&quot;
                                                </CommandItem>
                                            </CommandGroup>
                                        )}
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs text-slate-500">SKU / Kode <span className="text-red-500">*</span></Label>
                        {isEditMode ? (
                            <div className="flex items-center h-9 px-3 rounded-md bg-slate-100 border border-slate-200 text-sm text-slate-600 font-mono">
                                {formData.sku || '-'}
                            </div>
                        ) : (
                            <div className="flex gap-1.5">
                                <Input 
                                    className={cn("bg-slate-50 border-slate-200", formErrors.sku && "border-red-400 ring-1 ring-red-400")}
                                    value={formData.sku} 
                                    onChange={(e) => { setFormData({...formData, sku: e.target.value}); setFormErrors(prev => ({...prev, sku: ''})); }}
                                    placeholder="CHM-001"
                                />
                                <Button 
                                    variant="outline" 
                                    size="icon" 
                                    onClick={generateSKU} 
                                    title="Generate SKU Otomatis"
                                    className="shrink-0 bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                                >
                                    <Wand2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                        {formErrors.sku && !isEditMode && <p className="text-[11px] text-red-500">{formErrors.sku}</p>}
                    </div>
                </div>

                {/* Nama Barang */}
                <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Nama Barang <span className="text-red-500">*</span></Label>
                    <Input 
                        className={cn("bg-slate-50 border-slate-200", formErrors.name && "border-red-400 ring-1 ring-red-400")}
                        value={formData.name} 
                        onChange={(e) => { setFormData({...formData, name: e.target.value}); setFormErrors(prev => ({...prev, name: ''})); }}
                        placeholder="Contoh: Shampoo Mobil"
                    />
                    {formErrors.name && <p className="text-[11px] text-red-500">{formErrors.name}</p>}
                </div>

                {/* Jenis Layanan */}
                <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Jenis Layanan <span className="text-red-500">*</span></Label>
                    <Select 
                        value={formData.service_type} 
                        onValueChange={(val) => { setFormData({...formData, service_type: val}); setFormErrors(prev => ({...prev, service_type: ''})); }}
                    >
                        <SelectTrigger className={cn("bg-slate-50 border-slate-200", formErrors.service_type && "border-red-400 ring-1 ring-red-400")}>
                            <SelectValue placeholder="Pilih Layanan" />
                        </SelectTrigger>
                        <SelectContent>
                            {activeServices.map(type => (
                                <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {formErrors.service_type && <p className="text-[11px] text-red-500">{formErrors.service_type}</p>}
                </div>

                {/* Row: Cabang + Teknisi */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label className="text-xs text-slate-500 flex items-center gap-1">
                            <Building2 className="h-3 w-3" /> Cabang
                        </Label>
                        <Select 
                            value={formData.branch_id} 
                            onValueChange={(val) => setFormData({...formData, branch_id: val === '_none_' ? '' : val})}
                        >
                            <SelectTrigger className="bg-slate-50 border-slate-200">
                                <SelectValue placeholder="Pilih Cabang" />
                            </SelectTrigger>
                            <SelectContent className="z-[200]">
                                <SelectItem value="_none_">
                                    <span className="text-slate-400">Tidak ditentukan</span>
                                </SelectItem>
                                {activeBranches.map(branch => (
                                    <SelectItem key={branch.id} value={branch.id}>
                                        {branch.name} {branch.city ? `(${branch.city})` : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs text-slate-500 flex items-center gap-1">
                            <UserCircle className="h-3 w-3" /> Teknisi PIC
                        </Label>
                        <Select 
                            value={formData.technician_id} 
                            onValueChange={(val) => setFormData({...formData, technician_id: val === '_none_' ? '' : val})}
                        >
                            <SelectTrigger className="bg-slate-50 border-slate-200">
                                <SelectValue placeholder="Pilih Teknisi" />
                            </SelectTrigger>
                            <SelectContent className="z-[200]">
                                <SelectItem value="_none_">
                                    <span className="text-slate-400">Tidak ditentukan</span>
                                </SelectItem>
                                {technicians.map(tech => (
                                    <SelectItem key={tech.id} value={tech.id}>
                                        {tech.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Row: Satuan + Min. Stok */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label className="text-xs text-slate-500">Satuan <span className="text-red-500">*</span></Label>
                        <Popover open={unitPopoverOpen} onOpenChange={(open) => { setUnitPopoverOpen(open); if (!open) setUnitSearch(""); }}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={unitPopoverOpen}
                                    className={cn("w-full justify-between bg-slate-50 border-slate-200 font-normal hover:bg-slate-100", formErrors.unit && "border-red-400 ring-1 ring-red-400")}
                                >
                                    {formData.unit || <span className="text-muted-foreground">Pilih satuan...</span>}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[200]" align="start">
                                <Command shouldFilter={false}>
                                    <CommandInput placeholder="Cari atau ketik satuan baru..." value={unitSearch} onValueChange={setUnitSearch} />
                                    <CommandList>
                                        {filteredUnits.length === 0 && !unitSearch.trim() && (
                                            <CommandEmpty>Belum ada data satuan. Ketik untuk membuat baru.</CommandEmpty>
                                        )}
                                        {filteredUnits.length > 0 && (
                                            <CommandGroup heading="Satuan Tersedia">
                                                {filteredUnits.map(unit => (
                                                    <CommandItem 
                                                        key={unit.id} 
                                                        value={unit.name} 
                                                        onSelect={() => {
                                                            setFormData(prev => ({...prev, unit: unit.name}));
                                                            setUnitPopoverOpen(false);
                                                            setUnitSearch("");
                                                        }}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", formData.unit === unit.name ? "opacity-100" : "opacity-0")} />
                                                        {unit.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        )}
                                        {unitSearch.trim() && !exactUnitMatch && (
                                            <CommandGroup heading="Buat Baru">
                                                <CommandItem 
                                                    value={`create-${unitSearch}`}
                                                    onSelect={() => handleCreateUnit(unitSearch)}
                                                    className="text-blue-600"
                                                >
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Tambah satuan &quot;{unitSearch.trim()}&quot;
                                                </CommandItem>
                                            </CommandGroup>
                                        )}
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        {formErrors.unit && <p className="text-[11px] text-red-500">{formErrors.unit}</p>}
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs text-slate-500">
                            Batas Minimum {formData.unit && <span className="text-slate-400">({formData.unit})</span>}
                        </Label>
                        <Input 
                            type="number"
                            className={cn("bg-slate-50 border-slate-200", formErrors.min_stock && "border-red-400 ring-1 ring-red-400")}
                            value={formData.min_stock} 
                            onChange={(e) => { setFormData({...formData, min_stock: e.target.value}); setFormErrors(prev => ({...prev, min_stock: ''})); }} 
                        />
                        <p className="text-[11px] text-slate-400">
                            Dipakai untuk pengingat restock, bukan stok aktual yang tersedia.
                        </p>
                        {formErrors.min_stock && <p className="text-[11px] text-red-500">{formErrors.min_stock}</p>}
                    </div>
                </div>

                {/* Harga Jual - full width */}
                <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">
                        Harga Jual {formData.unit && <span className="text-slate-400">(per {formData.unit})</span>}
                    </Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">Rp</span>
                        <Input 
                            type="number"
                            className={cn("pl-8 bg-slate-50 border-slate-200", formErrors.sell_price && "border-red-400 ring-1 ring-red-400")} 
                            value={formData.sell_price} 
                            onChange={(e) => { setFormData({...formData, sell_price: e.target.value}); setFormErrors(prev => ({...prev, sell_price: ''})); }}
                            placeholder="0" 
                        />
                    </div>
                    {formErrors.sell_price && <p className="text-[11px] text-red-500">{formErrors.sell_price}</p>}
                </div>

                {/* Deskripsi */}
                <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Deskripsi</Label>
                    <textarea 
                        className="flex h-20 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={formData.description} 
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        placeholder="Deskripsi produk..." 
                    />
                </div>

                {/* Saldo Awal - only for new product */}
                {!isEditMode && (
                    <>
                        <div className="border-t border-slate-100 pt-3">
                            <p className="text-xs font-medium text-slate-500 mb-3">Saldo Awal</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-500">
                                        Stok Awal {formData.unit && <span className="text-slate-400">({formData.unit})</span>}
                                    </Label>
                                    <Input 
                                        type="number"
                                        className={cn("bg-slate-50 border-slate-200", formErrors.initial_qty && "border-red-400 ring-1 ring-red-400")}
                                        value={formData.initial_qty} 
                                        onChange={(e) => { setFormData({...formData, initial_qty: e.target.value}); setFormErrors(prev => ({...prev, initial_qty: ''})); }} 
                                    />
                                    {formErrors.initial_qty && <p className="text-[11px] text-red-500">{formErrors.initial_qty}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-500">
                                        HPP Awal <span className="text-red-500">*</span> {formData.unit && <span className="text-slate-400">(per {formData.unit})</span>}
                                    </Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">Rp</span>
                                        <Input 
                                            type="number"
                                            className={cn("pl-8 bg-slate-50 border-slate-200", formErrors.initial_cost && "border-red-400 ring-1 ring-red-400")}
                                            value={formData.initial_cost} 
                                            onChange={(e) => { setFormData({...formData, initial_cost: e.target.value}); setFormErrors(prev => ({...prev, initial_cost: ''})); }}
                                            placeholder="0" 
                                        />
                                    </div>
                                    {formErrors.initial_cost && <p className="text-[11px] text-red-500">{formErrors.initial_cost}</p>}
                                </div>
                            </div>
                        </div>

                        {/* Summary calculation */}
                        {(Number(formData.initial_qty) > 0 || Number(formData.initial_cost) > 0 || Number(formData.sell_price) > 0) && (
                            <div className="bg-slate-50 rounded-lg p-3 space-y-1.5 border border-slate-100">
                                <p className="text-xs font-medium text-slate-500 mb-2">Ringkasan</p>
                                {Number(formData.initial_qty) > 0 && Number(formData.initial_cost) > 0 && (
                                    <div className="flex items-center justify-between text-xs gap-2">
                                        <span className="text-slate-500 shrink-0">Nilai Stok Awal</span>
                                        <span className="text-right text-slate-700 font-medium">
                                            {Number(formData.initial_qty)} {formData.unit} &times; Rp {Number(formData.initial_cost).toLocaleString('id-ID')} = <span className="text-emerald-600">Rp {(Number(formData.initial_qty) * Number(formData.initial_cost)).toLocaleString('id-ID')}</span>
                                        </span>
                                    </div>
                                )}
                                {Number(formData.sell_price) > 0 && (
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500">Harga Jual</span>
                                        <span className="text-blue-600 font-medium">Rp {Number(formData.sell_price).toLocaleString('id-ID')}{formData.unit ? ` / ${formData.unit}` : ''}</span>
                                    </div>
                                )}
                                {Number(formData.sell_price) > 0 && Number(formData.initial_cost) > 0 && (
                                    <div className="flex items-center justify-between text-xs border-t border-slate-200 pt-1.5 mt-1.5">
                                        <span className="text-slate-500">Margin</span>
                                        <span className={`font-medium ${(Number(formData.sell_price) - Number(formData.initial_cost)) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                            Rp {(Number(formData.sell_price) - Number(formData.initial_cost)).toLocaleString('id-ID')}{formData.unit ? ` / ${formData.unit}` : ''} ({Number(formData.initial_cost) > 0 ? ((Number(formData.sell_price) - Number(formData.initial_cost)) / Number(formData.initial_cost) * 100).toFixed(1) : '0'}%)
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* Edit mode: show current stock info as read-only context */}
                {isEditMode && (
                    <div className="border-t border-slate-100 pt-3">
                        <div className="bg-slate-50 rounded-lg p-3 space-y-1.5 border border-slate-100">
                            <p className="text-xs font-medium text-slate-500 mb-2">Info Stok Saat Ini</p>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500">Stok</span>
                                <span className="text-slate-700 font-medium">{currentProduct.current_qty} {currentProduct.unit}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500">HPP Rata-rata</span>
                                <span className="text-slate-700 font-medium">Rp {Number(currentProduct.average_cost || 0).toLocaleString('id-ID')}{currentProduct.unit ? ` / ${currentProduct.unit}` : ''}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500">Total Nilai Aset</span>
                                <span className="text-emerald-600 font-medium">Rp {((currentProduct.current_qty || 0) * (currentProduct.average_cost || 0)).toLocaleString('id-ID')}</span>
                            </div>
                            {Number(formData.sell_price) > 0 && (
                                <div className="flex justify-between text-xs border-t border-slate-200 pt-1.5 mt-1.5">
                                    <span className="text-slate-500">Harga Jual</span>
                                    <span className="text-blue-600 font-medium">Rp {Number(formData.sell_price).toLocaleString('id-ID')}{formData.unit ? ` / ${formData.unit}` : ''}</span>
                                </div>
                            )}
                            {Number(formData.sell_price) > 0 && Number(currentProduct.average_cost) > 0 && (
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Margin</span>
                                    <span className={`font-medium ${(Number(formData.sell_price) - Number(currentProduct.average_cost)) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                        Rp {(Number(formData.sell_price) - Number(currentProduct.average_cost)).toLocaleString('id-ID')}{formData.unit ? ` / ${formData.unit}` : ''} ({Number(currentProduct.average_cost) > 0 ? ((Number(formData.sell_price) - Number(currentProduct.average_cost)) / Number(currentProduct.average_cost) * 100).toFixed(1) : '0'}%)
                                    </span>
                                </div>
                            )}
                            <div className="border-t border-slate-200 pt-2 mt-2">
                                <p className="text-[11px] leading-relaxed text-slate-500">
                                    Stok aktual diubah lewat tab <span className="font-medium text-slate-600">Transaksi &amp; Mutasi</span>.
                                    Form detail produk ini hanya untuk metadata seperti nama barang, harga, satuan, dan batas minimum.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <SheetFooter className="shrink-0 flex-row gap-3 border-t border-slate-100 bg-white p-6 pt-4 dark:border-slate-800 dark:bg-slate-900 sm:justify-end">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="h-9 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">Batal</Button>
                <Button onClick={handleSave} disabled={loading} className="h-9 bg-blue-600 text-white shadow-sm hover:bg-blue-700">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Simpan
                </Button>
            </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="sm:max-w-[420px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-slate-900">Hapus Produk</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500">
              Apakah Anda yakin ingin menghapus produk{' '}
              <span className="font-semibold text-slate-700">{deleteTarget?.name}</span>
              {deleteTarget?.sku && <span className="text-slate-400"> ({deleteTarget.sku})</span>}
              ?{' '}
              Produk hanya bisa dihapus jika tidak memiliki transaksi. Jika ada transaksi terkait, hapus akan ditolak.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
              className="bg-red-600 hover:bg-red-700 text-white h-9"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Hapus Produk
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Kartu Stok Sheet */}
      <StockCard
        open={stockCardOpen}
        onOpenChange={setStockCardOpen}
        product={stockCardProduct}
      />
    </div>
  );
}
