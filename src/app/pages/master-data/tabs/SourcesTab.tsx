import React, { useState } from 'react';
import { 
  Search, Plus, Edit, Trash2, FileText, Filter
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../../../components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '../../../components/ui/dialog';
import { Badge } from '../../../components/ui/badge';
import { Role, MOCK_SOURCES, MOCK_AD_ACCOUNTS } from '../data';
import { toast } from 'sonner';
import { AdSourceForm } from '../forms/AdSourceForm';
import { useMasterData } from '../context';
import { usePermissions } from '@/app/hooks/usePermissions';
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
} from "../../../components/ui/alert-dialog";

interface SourcesTabProps {
  currentRole: Role;
}

export const SourcesTab: React.FC<SourcesTabProps> = ({ currentRole }) => {
  const { sources, addSource, updateSource, deleteSource, adAccounts } = useMasterData();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  const canCreate = hasPermission('master_data.create');
  const canEdit = hasPermission('master_data.edit');
  const canDelete = hasPermission('master_data.delete');
  const canManage = canCreate || canEdit || canDelete;

  const getAdAccountName = (id: string) => {
    const acc = adAccounts.find(a => a.id === id);
    return acc ? `${acc.accountName}` : 'Unknown Account';
  };

  const filteredData = sources.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    getAdAccountName(item.adAccountId).toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (formData: any) => {
    if (editingItem) {
      updateSource({ ...editingItem, ...formData });
      toast.success("Sumber Iklan berhasil diperbarui");
    } else {
      const newItem = {
        id: Math.random().toString(36).substr(2, 9),
        ...formData
      };
      addSource(newItem);
      toast.success("Sumber Iklan berhasil ditambahkan");
    }
    setIsAddOpen(false);
    setEditingItem(null);
  };

  const handleDelete = (id: string) => {
    deleteSource(id);
    toast.success("Data berhasil dihapus");
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setIsAddOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex justify-end mb-2 absolute top-8 right-8 z-10">
        {canCreate && (
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            onClick={() => {
              setEditingItem(null);
              setIsAddOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Tambah Sumber
          </Button>
        )}
      </div>

      {/* Main Content Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
          <div className="flex items-center space-x-2 w-full max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Cari sumber atau akun iklan..." 
                className="pl-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-blue-500 transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="border-slate-200 text-slate-500 hover:bg-slate-50 shrink-0 w-10 h-10">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Data Table (Desktop) */}
        <div className="hidden md:block overflow-x-auto">
          {filteredData.length > 0 ? (
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                <TableRow className="border-b border-slate-100 dark:border-slate-800">
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4 pl-6">Nama Campaign</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Akun Iklan</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Default CS</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4 text-center">Status</TableHead>
                  {canManage && <TableHead className="text-right font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4 pr-6">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors">
                    <TableCell className="py-4 pl-6 font-medium text-slate-900 dark:text-slate-100 text-sm">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500">
                          <FileText className="h-4 w-4" />
                        </div>
                        <span className="font-semibold">{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-sm text-slate-600 dark:text-slate-400">{getAdAccountName(item.adAccountId)}</TableCell>
                    <TableCell className="py-4 text-sm text-slate-600 dark:text-slate-400">{item.defaultCsName || '-'}</TableCell>
                    <TableCell className="py-4 text-center">
                      <Badge 
                        variant="outline"
                        className={item.status === 'active' 
                          ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-700/40 uppercase text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-sm" 
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 uppercase text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-sm"}
                      >
                        {item.status === 'active' ? 'AKTIF' : 'NON AKTIF'}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="py-4 pr-6 text-right">
                        <div className="flex justify-end gap-1">
                          {canEdit && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => openEdit(item)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-white dark:bg-slate-900">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Hapus Sumber Iklan</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Apakah anda yakin ingin menghapus sumber iklan <strong>{item.name}</strong>?
                                    <br/>Tindakan ini tidak dapat dibatalkan.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
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
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <div className="h-12 w-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Belum ada data sumber iklan</p>
            </div>
          )}
        </div>

        {/* Mobile Card List */}
        <div className="md:hidden p-4 space-y-4 pt-0">
          {filteredData.length === 0 ? (
             <div className="text-center py-12 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">Tidak ada data sumber iklan.</div>
          ) : (
             filteredData.map((item) => (
                <div key={item.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                           <FileText className="w-5 h-5 text-slate-500" />
                           <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{item.name}</h3>
                        </div>
                        <Badge 
                          variant="outline"
                          className={item.status === 'active' 
                            ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-700/40 text-[10px] px-1.5 py-0.5 h-5" 
                            : "bg-slate-100 text-slate-500 border-slate-200 text-[10px] px-1.5 py-0.5 h-5"}
                        >
                          {item.status === 'active' ? 'AKTIF' : 'NON AKTIF'}
                        </Badge>
                    </div>
                    
                    <div className="space-y-1 mb-4">
                        <div className="flex justify-between">
                            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Akun Iklan</span>
                            <span className="text-xs text-slate-800 dark:text-slate-200 font-semibold max-w-[60%] text-right">{getAdAccountName(item.adAccountId)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Default CS</span>
                            <span className="text-xs text-slate-800 dark:text-slate-200 font-semibold">{item.defaultCsName || '-'}</span>
                        </div>
                    </div>

                    {canEdit && (
                       <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                           <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1 text-xs h-9 text-blue-600 border-slate-200"
                              onClick={() => openEdit(item)}
                           >
                              <Edit className="w-3 h-3 mr-2" />
                              Edit
                           </Button>
                           <AlertDialog>
                              <AlertDialogTrigger asChild>
                                 <Button variant="outline" size="sm" className="w-9 px-0 text-red-600 border-slate-200 h-9 shrink-0">
                                    <Trash2 className="w-3 h-3" />
                                 </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-white dark:bg-slate-900">
                                 <AlertDialogHeader>
                                    <AlertDialogTitle>Hapus Sumber Iklan</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Apakah anda yakin ingin menghapus sumber iklan <strong>{item.name}</strong>?
                                    </AlertDialogDescription>
                                 </AlertDialogHeader>
                                 <AlertDialogFooter>
                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                    <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDelete(item.id)}>
                                      Hapus
                                    </AlertDialogAction>
                                 </AlertDialogFooter>
                              </AlertDialogContent>
                           </AlertDialog>
                       </div>
                    )}
                </div>
             ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Menampilkan <span className="font-medium text-slate-900 dark:text-slate-100">{filteredData.length}</span> data
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs font-normal text-slate-500 border-slate-200 hover:text-slate-700" disabled>
              Prev
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs font-normal text-slate-500 border-slate-200 hover:text-slate-700" disabled>
              Next
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-900 p-0 overflow-hidden rounded-xl">
          <DialogHeader className="px-6 py-4 bg-slate-50 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">{editingItem ? 'Edit Sumber Iklan' : 'Tambah Sumber Iklan'}</DialogTitle>
            <DialogDescription className="sr-only">Form untuk sumber iklan</DialogDescription>
          </DialogHeader>
          <div className="px-6">
            <AdSourceForm 
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
