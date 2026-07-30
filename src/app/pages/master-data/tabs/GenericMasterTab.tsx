import React, { useState } from 'react';
import {
  Search, Plus, Edit, Trash2,
  LucideIcon, CheckCircle2, XCircle
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../../../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '../../../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog"
import { Badge } from '../../../components/ui/badge';
import { Role } from '../data';
import { toast } from 'sonner';
import { usePermissions } from '@/app/hooks/usePermissions';
import { logActivity } from '@/app/services/auditService';
import { useMasterData } from '../context';
import { GenericForm } from '../forms/GenericForm';
import { MasterDataDetailDialog } from './MasterDataDetailDialog';
import { cn } from '../../../components/ui/utils';
import { getVehicleNameValidationMessage, normalizeVehicleName } from '../vehicleValidation';

const PAGE_SIZE_OPTIONS = [50, 100, 200, 300];

interface GenericMasterTabProps {
  currentRole: Role;
  title: string;
  type: 'simple' | 'vehicle' | 'payment' | 'sub_channel' | 'vendor';
  initialData?: any[];
  data?: any[]; // Optional controlled data
  onAdd?: (item: any) => void; // Optional controlled handler
  onUpdate?: (item: any) => void; // Optional controlled handler
  onDelete?: (id: string) => void; // Optional controlled handler
  onImport?: () => void; // Optional import handler
  icon: LucideIcon;
  hideDescription?: boolean;
  platforms?: any[]; // For sub_channel dropdown
  columns?: {
    header: string;
    accessor: string;
    width?: string;
    render?: (item: any) => React.ReactNode;
  }[];
}

export const GenericMasterTab: React.FC<GenericMasterTabProps> = ({ 
  currentRole, 
  title, 
  type, 
  initialData = [],
  data: controlledData,
  onAdd,
  onUpdate,
  onDelete,
  onImport,
  icon: Icon,
  hideDescription,
  platforms,
  columns 
}) => {
  const [localData, setLocalData] = useState<any[]>(initialData);
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [viewingItem, setViewingItem] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const { hasPermission } = usePermissions();
  const { currentUser } = useMasterData();

  const canAdd = hasPermission('master_data.create');
  const canEdit = hasPermission('master_data.edit');
  const canDelete = hasPermission('master_data.delete');

  // Use controlled data if provided, otherwise local data
  const data = controlledData || localData;

  const filteredData = data.filter(item => {
    const itemName = item.name || item.bankName || '';
    const customValues = columns?.map((col) => String(item[col.accessor] || '')) || [];
    return [itemName, ...customValues].some((value) => value.toLowerCase().includes(search.toLowerCase()));
  });

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const pageStartIndex = filteredData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const pageEndIndex = Math.min(pageStartIndex + itemsPerPage, filteredData.length);
  const paginatedRows = filteredData
    .slice(pageStartIndex, pageEndIndex)
    .map((item, index) => ({ item, rowNumber: pageStartIndex + index + 1 }));
  const activeTotal = filteredData.filter(item => item.status === 'active' || !item.status).length;
  const inactiveTotal = filteredData.filter(item => item.status === 'inactive' || item.status === 'non-active').length;
  const activeItems = paginatedRows.filter(({ item }) => item.status === 'active' || !item.status);
  const inactiveItems = paginatedRows.filter(({ item }) => item.status === 'inactive' || item.status === 'non-active');

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, itemsPerPage, data.length]);

  React.useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const handleSubmit = async (formData: any) => {
    const cleanData: any = {
      status: formData.status
    };

    if (type === 'vehicle') {
      const vehicleName = normalizeVehicleName(formData.name);
      const validationMessage = getVehicleNameValidationMessage(vehicleName);
      if (validationMessage) {
        toast.error(validationMessage);
        return;
      }
      cleanData.name = vehicleName;
      cleanData.category = formData.category;
    } else if (type === 'payment') {
      cleanData.bankName = formData.name;
      cleanData.accountNumber = formData.accountNumber;
      cleanData.accountHolder = formData.accountHolder;
    } else if (type === 'sub_channel') {
      cleanData.name = formData.name;
      cleanData.platformId = formData.platformId;
    } else if (type === 'vendor') {
        cleanData.name = formData.name;
        cleanData.phone = formData.phone;
        cleanData.address = formData.address;
    } else {
      cleanData.name = formData.name;
      cleanData.description = formData.description;
    }

    try {
      if (editingItem) {
        const updatePayload = { ...cleanData, id: editingItem.id };
        if (onUpdate) {
          await onUpdate(updatePayload);
        } else {
          setLocalData(prev => prev.map(item => item.id === editingItem.id ? { ...item, ...updatePayload } : item));
        }
        toast.success(`${title} berhasil diperbarui`);
        if (currentUser) {
          logActivity(
            { id: currentUser.id, name: currentUser.name, role: currentUser.role },
            'UPDATE', `Master Data`,
            `Memperbarui ${title}: ${cleanData.name || ''}`,
            editingItem.id
          );
        }
      } else {
        const newItem = {
          id: Math.random().toString(36).substr(2, 9),
          ...cleanData
        };
        if (onAdd) {
          await onAdd(newItem);
        } else {
          setLocalData(prev => [...prev, newItem]);
        }
        toast.success(`${title} berhasil ditambahkan`);
        if (currentUser) {
          logActivity(
            { id: currentUser.id, name: currentUser.name, role: currentUser.role },
            'CREATE', `Master Data`,
            `Menambahkan ${title}: ${cleanData.name || ''}`,
            newItem.id
          );
        }
      }
      
      setIsAddOpen(false);
      setEditingItem(null);
    } catch (error: any) {
      console.error("Form submission error:", error);
      toast.error(`Terjadi kesalahan: ${error.message || "Gagal menyimpan data"}`); 
    }
  };

  const handleDelete = (id: string) => {
    if (onDelete) {
      onDelete(id);
    } else {
      setLocalData(prev => prev.filter(item => item.id !== id));
    }
    toast.success("Data berhasil dihapus");
    if (currentUser) {
      const deletedItem = filteredData.find(item => item.id === id);
      logActivity(
        { id: currentUser.id, name: currentUser.name, role: currentUser.role },
        'DELETE', `Master Data`,
        `Menghapus ${title}: ${deletedItem?.name || ''}`,
        id
      );
    }
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setIsAddOpen(true);
  };

  const renderSection = (
    rows: Array<{ item: any; rowNumber: number }>,
    sectionTitle: string,
    variant: 'active' | 'inactive',
    totalCount: number,
  ) => {
    if (rows.length === 0) return null;

    return (
      <div className="mb-8 last:mb-0">
        <div className="flex items-center gap-2 mb-4 px-1">
            <div className={cn("p-1.5 rounded-lg", variant === 'active' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400")}>
                {variant === 'active' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">{sectionTitle}</h3>
            <Badge variant="secondary" className="ml-2 bg-slate-100 dark:bg-slate-800 text-slate-500">
                {totalCount}
            </Badge>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-700/50">
                <TableRow className="border-b border-slate-100 dark:border-slate-700">
                  <TableHead className="w-[72px] font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4 pl-6 text-center">No</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4 pl-6 min-w-[150px]">Nama {title}</TableHead>
                  {columns?.map((col, idx) => (
                    <TableHead key={idx} className={`font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4 ${col.width || ''} min-w-[150px]`}>
                      {col.header}
                    </TableHead>
                  ))}
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4 text-center">Status</TableHead>
                  {(canEdit || canDelete) && <TableHead className="text-right font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4 pr-6">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ item, rowNumber }) => (
                  <TableRow 
                    key={item.id} 
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors cursor-pointer"
                    onClick={() => setViewingItem(item)}
                  >
                    <TableCell className="py-4 pl-6 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                      {rowNumber}
                    </TableCell>
                    <TableCell className="py-4 pl-6 font-medium text-slate-900 dark:text-slate-200 text-sm">
                      <div className="flex items-center space-x-3">
                        <span className="font-semibold">{item.name || item.bankName}</span>
                      </div>
                    </TableCell>
                    {columns?.map((col, idx) => (
                      <TableCell key={idx} className="py-4 text-slate-600 dark:text-slate-400 text-sm">
                        {col.render ? col.render(item) : item[col.accessor]}
                      </TableCell>
                    ))}
                    <TableCell className="py-4 text-center">
                      <Badge 
                        variant="outline"
                        className={item.status === 'active' || !item.status
                          ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800 uppercase text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-sm" 
                          : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 uppercase text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-sm"}
                      >
                        {item.status === 'active' || !item.status ? 'AKTIF' : 'NON AKTIF'}
                      </Badge>
                    </TableCell>
                    {(canEdit || canDelete) && (
                      <TableCell className="py-4 pr-6 text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {canEdit && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/30" onClick={() => openEdit(item)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/30">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-white dark:bg-slate-800 dark:border-slate-700">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="dark:text-slate-200">Hapus {title}</AlertDialogTitle>
                                  <AlertDialogDescription className="dark:text-slate-400">
                                    Apakah anda yakin ingin menghapus {title.toLowerCase()} <strong>{item.name || item.bankName}</strong>?
                                    <br/>Tindakan ini tidak dapat dibatalkan.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">Batal</AlertDialogCancel>
                                  <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-700" onClick={() => handleDelete(item.id)}>
                                    Hapus
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
             {rows.map(({ item, rowNumber }) => (
                <div 
                    key={item.id} 
                    className="p-4 bg-white dark:bg-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    onClick={() => setViewingItem(item)}
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                             <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-slate-100 px-2 text-xs font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                                {rowNumber}
                             </span>
                             <div className={cn("p-2 rounded-lg", variant === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>
                                <Icon className="w-5 h-5" />
                             </div>
                             <div>
                                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                                    {item.name || item.bankName}
                                </h4>
                                <Badge 
                                  variant="outline"
                                  className={cn("mt-1 text-[10px] px-1.5 py-0 h-4 border-0",
                                    item.status === 'active' || !item.status
                                      ? "bg-emerald-50 text-emerald-600" 
                                      : "bg-slate-100 text-slate-500"
                                  )}
                                >
                                  {item.status === 'active' || !item.status ? 'Active' : 'Non-Active'}
                                </Badge>
                             </div>
                        </div>
                    </div>

                    {columns && columns.length > 0 && (
                        <div className="pl-[52px] space-y-1 mb-3">
                            {columns.map((col, idx) => (
                                <div key={idx} className="flex flex-col">
                                    <span className="text-[10px] text-slate-400 uppercase font-medium">{col.header}</span>
                                    <span className="text-sm text-slate-700 dark:text-slate-300">
                                        {col.render ? col.render(item) : item[col.accessor]}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {(canEdit || canDelete) && (
                       <div className="pl-[52px] flex gap-2 pt-2">
                           {canEdit && (
                           <Button 
                               variant="outline" 
                               size="sm" 
                               className="flex-1 text-xs h-8 text-blue-600 border-slate-200 dark:border-slate-700"
                               onClick={(e) => {
                                 e.stopPropagation();
                                 openEdit(item);
                               }}
                           >
                               <Edit className="w-3 h-3 mr-2" />
                               Edit
                           </Button>
                           )}
                           {canDelete && (
                           <AlertDialog>
                               <AlertDialogTrigger asChild>
                                  <Button 
                                     variant="outline" 
                                     size="sm" 
                                     className="w-8 px-0 text-red-600 border-slate-200 dark:border-slate-700 h-8 shrink-0"
                                     onClick={(e) => e.stopPropagation()}
                                  >
                                     <Trash2 className="w-3 h-3" />
                                  </Button>
                               </AlertDialogTrigger>
                               <AlertDialogContent className="bg-white dark:bg-slate-800 dark:border-slate-700">
                                  <AlertDialogHeader>
                                     <AlertDialogTitle className="dark:text-slate-200">Hapus {title}</AlertDialogTitle>
                                     <AlertDialogDescription className="dark:text-slate-400">
                                       Apakah anda yakin ingin menghapus {title.toLowerCase()} <strong>{item.name || item.bankName}</strong>?
                                     </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                     <AlertDialogCancel className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">Batal</AlertDialogCancel>
                                     <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDelete(item.id)}>
                                       Hapus
                                     </AlertDialogAction>
                                  </AlertDialogFooter>
                               </AlertDialogContent>
                            </AlertDialog>
                           )}
                       </div>
                    )}
                </div>
             ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Search Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <Input 
              placeholder={`Cari ${title}...`}
              className="pl-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
        </div>

        {canAdd && (
            <div className="flex gap-2 w-full sm:w-auto">
              {onImport && (
                <Button 
                  variant="outline"
                  className="border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 w-full sm:w-auto"
                  onClick={onImport}
                >
                  Import Data
                </Button>
              )}
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200/50 dark:shadow-none w-full sm:w-auto"
                onClick={() => {
                  setEditingItem(null);
                  setIsAddOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Tambah {title}
              </Button>
            </div>
        )}
      </div>

      {filteredData.length > 0 ? (
          <>
            {renderSection(activeItems, `${title} Aktif`, 'active', activeTotal)}
            {renderSection(inactiveItems, `${title} Non-Aktif`, 'inactive', inactiveTotal)}

            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Menampilkan {pageStartIndex + 1}-{pageEndIndex} dari {filteredData.length} data
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  >
                    &lt;
                  </Button>
                  <div className="flex min-w-[64px] items-center justify-center text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {currentPage}
                    <span className="mx-1 text-slate-400">/</span>
                    <span className="text-slate-500">{totalPages}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                    disabled={currentPage === totalPages || totalPages === 0}
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  >
                    &gt;
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Tampilkan</span>
                  <Select
                    value={String(itemsPerPage)}
                    onValueChange={(value) => setItemsPerPage(Number(value))}
                  >
                    <SelectTrigger className="h-8 w-[140px] rounded-md border-slate-200 bg-white text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={String(option)}>
                          {option} / Halaman
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </>
      ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
               <div className="p-4 rounded-full bg-slate-50 dark:bg-slate-900 mb-4">
                   <Icon className="w-8 h-8 text-slate-300" />
               </div>
               <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Tidak ada data {title}</h3>
               <p className="text-slate-500 text-sm max-w-xs mx-auto mt-1">
                   {search ? 'Tidak ditemukan data yang sesuai dengan pencarian Anda.' : `Belum ada data ${title} yang ditambahkan.`}
               </p>
          </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-900 border-none shadow-2xl p-0 overflow-hidden rounded-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="px-6 py-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Icon className="w-5 h-5 text-blue-600" />
                {editingItem ? `Edit ${title}` : `Tambah ${title}`}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              {hideDescription ? 'Kelola data master sistem.' : `Kelola informasi ${title.toLowerCase()}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 overflow-y-auto bg-slate-50/50 dark:bg-slate-950">
            <GenericForm 
              type={type}
              item={editingItem}
              label={title}
              onSubmit={handleSubmit}
              onCancel={() => setIsAddOpen(false)}
              hideDescription={hideDescription}
              platforms={platforms}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <MasterDataDetailDialog 
        open={!!viewingItem} 
        onOpenChange={(open) => !open && setViewingItem(null)}
        item={viewingItem}
        title={title}
        type={type}
        columns={columns}
      />
    </div>
  );
};
