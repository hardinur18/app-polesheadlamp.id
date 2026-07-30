import React, { useState } from 'react';
import { 
  Plus, Filter, Edit, Trash2, Activity, CheckCircle2, XCircle
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { ControlPanel, ControlRow, SearchBox } from '../../../components/ui/control-panel';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../../../components/ui/table';
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
import { useMasterData } from '../context';
import { usePermissions } from '@/app/hooks/usePermissions';
import { toast } from 'sonner';
import { ServiceTypeForm } from '../forms/ServiceTypeForm';
import { cn } from '../../../components/ui/utils';

interface ServicesTabProps {
  currentRole: Role;
}

export const ServicesTab: React.FC<ServicesTabProps> = ({ currentRole: _currentRole }) => {
  const { services, addService, updateService, deleteService } = useMasterData();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  const canCreate = hasPermission('master_data.create');
  const canEdit = hasPermission('master_data.edit');
  const canDelete = hasPermission('master_data.delete');

  const filteredData = services.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const activeData = filteredData.filter(item => item.status === 'active');
  const inactiveData = filteredData.filter(item => item.status !== 'active');

  const handleSubmit = async (formData: any) => {
    if (editingItem) {
      if (!canEdit) {
        toast.error("Anda tidak memiliki izin untuk mengubah data layanan");
        return;
      }
      await updateService({ ...editingItem, ...formData });
    } else {
      if (!canCreate) {
        toast.error("Anda tidak memiliki izin untuk menambah data layanan");
        return;
      }
      const newItem = {
        id: Math.random().toString(36).substr(2, 9),
        ...formData
      };
      await addService(newItem);
    }
    setIsAddOpen(false);
    setEditingItem(null);
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) {
      toast.error("Anda tidak memiliki izin untuk menghapus data layanan");
      return;
    }
    await deleteService(id);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setIsAddOpen(true);
  };

  const renderTable = (items: any[], title: string, variant: 'active' | 'inactive') => {
    if (items.length === 0) return null;

    return (
      <div className="mb-8 last:mb-0">
         <div className="flex items-center gap-2 mb-4 px-1">
            <div className={cn("p-1.5 rounded-lg", variant === 'active' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400")}>
                {variant === 'active' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
            <Badge variant="secondary" className="ml-2 bg-slate-100 dark:bg-slate-800 text-slate-500">
                {items.length}
            </Badge>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-700/50">
                <TableRow className="border-b border-slate-100 dark:border-slate-700">
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4 pl-6">Nama Layanan</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Kategori</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Harga</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4 text-center">Status</TableHead>
                  {(canEdit || canDelete) && <TableHead className="text-right font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4 pr-6">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors">
                    <TableCell className="py-4 pl-6 font-medium text-slate-900 dark:text-slate-200 text-sm">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
                          <Activity className="h-4 w-4" />
                        </div>
                        <span className="font-semibold">{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-sm text-slate-600 dark:text-slate-400">{item.category}</TableCell>
                    <TableCell className="py-4 text-sm text-slate-600 dark:text-slate-400">
                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.price || 0)}
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      <Badge 
                        variant="outline"
                        className={item.status === 'active' 
                          ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800 uppercase text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-sm" 
                          : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 uppercase text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-sm"}
                      >
                        {item.status === 'active' ? 'AKTIF' : 'NON AKTIF'}
                      </Badge>
                    </TableCell>
                    {(canEdit || canDelete) && (
                      <TableCell className="py-4 pr-6 text-right">
                        <div className="flex justify-end gap-1">
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
                                  <AlertDialogTitle className="dark:text-slate-200">Hapus Layanan</AlertDialogTitle>
                                  <AlertDialogDescription className="dark:text-slate-400">
                                    Apakah anda yakin ingin menghapus layanan <strong>{item.name}</strong>?
                                    <br/>Tindakan ini tidak dapat dibatalkan.
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
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
             {items.map((item) => (
                <div key={item.id} className="p-4 bg-white dark:bg-slate-800">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                           <div className={cn("p-2 rounded-lg", variant === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>
                                <Activity className="w-5 h-5" />
                           </div>
                           <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">{item.name}</h3>
                        </div>
                        <Badge 
                          variant="outline"
                          className={item.status === 'active' 
                            ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800 text-[10px] px-1.5 py-0.5 h-5" 
                            : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 text-[10px] px-1.5 py-0.5 h-5"}
                        >
                          {item.status === 'active' ? 'AKTIF' : 'NON AKTIF'}
                        </Badge>
                    </div>
                    
                    <div className="pl-[52px] space-y-2 mb-3">
                        <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 pb-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Kategori</span>
                            <span className="text-sm text-slate-800 dark:text-slate-200 font-semibold">{item.category}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Harga</span>
                            <span className="text-base text-blue-600 dark:text-blue-400 font-bold">
                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.price || 0)}
                            </span>
                        </div>
                    </div>

                    {(canEdit || canDelete) && (
                       <div className="pl-[52px] flex gap-2 pt-2">
                           {canEdit && (
                             <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex-1 text-xs h-8 text-blue-600 border-slate-200 dark:border-slate-700"
                                onClick={() => openEdit(item)}
                             >
                                <Edit className="w-3 h-3 mr-2" />
                                Edit
                             </Button>
                           )}
                           {canDelete && (
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                   <Button variant="outline" size="sm" className="w-8 px-0 text-red-600 border-slate-200 dark:border-slate-700 h-8 shrink-0">
                                      <Trash2 className="w-3 h-3" />
                                   </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-white dark:bg-slate-800 dark:border-slate-700">
                                   <AlertDialogHeader>
                                      <AlertDialogTitle className="dark:text-slate-200">Hapus Layanan</AlertDialogTitle>
                                      <AlertDialogDescription className="dark:text-slate-400">
                                        Apakah anda yakin ingin menghapus layanan <strong>{item.name}</strong>?
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
    <div className="masterDataTabSurface">
      <ControlPanel aria-label="Filter layanan">
        <ControlRow className="masterDataControlRow">
          <SearchBox
            placeholder="Cari layanan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {canCreate && (
            <div className="masterDataControlActions">
            <Button 
              className="masterDataActionButton"
              onClick={() => {
                setEditingItem(null);
                setIsAddOpen(true);
              }}
            >
              <Plus /> Tambah Layanan
            </Button>
            </div>
          )}
        </ControlRow>
      </ControlPanel>

      {filteredData.length > 0 ? (
          <>
            {renderTable(activeData, "Layanan Aktif", 'active')}
            {renderTable(inactiveData, "Layanan Non-Aktif", 'inactive')}
          </>
      ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
               <div className="p-4 rounded-full bg-slate-50 dark:bg-slate-900 mb-4">
                   <Activity className="w-8 h-8 text-slate-300" />
               </div>
               <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Tidak ada data layanan</h3>
               <p className="text-slate-500 text-sm max-w-xs mx-auto mt-1">
                   {search ? 'Tidak ditemukan data yang sesuai dengan pencarian Anda.' : 'Belum ada data layanan yang ditambahkan.'}
               </p>
          </div>
      )}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-900 border-none shadow-2xl p-0 overflow-hidden rounded-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="px-6 py-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                {editingItem ? 'Edit Layanan' : 'Tambah Layanan'}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Kelola daftar layanan dan harga.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 overflow-y-auto bg-slate-50/50 dark:bg-slate-950">
            <ServiceTypeForm 
              item={editingItem}
              onSubmit={handleSubmit}
              onCancel={() => setIsAddOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
