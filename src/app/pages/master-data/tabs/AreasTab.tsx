import React, { useState } from 'react';
import { 
  Plus, Filter, Edit, Trash2, Map
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { ControlPanel, ControlRow, SearchBox } from '../../../components/ui/control-panel';
import { DataTable, TableActionCell, TableActionHeader, TableActionMenu, TableActionMenuItem, TableStatusCell, TableStatusIcon, TableText } from '../../../components/ui/data-table';
import { MasterDataTableTitle } from '../../../components/ui/master-data-table-title';
import { MobileCardActions } from '../../../components/ui/master-data-ui';
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
} from "../../../components/ui/alert-dialog"
import { Badge } from '../../../components/ui/badge';
import { Area, Role } from '../data';
import { useMasterData } from '../context';
import { usePermissions } from '@/app/hooks/usePermissions';
import { toast } from 'sonner';
import { AreaForm } from '../forms/AreaForm';
import { cn } from '../../../components/ui/utils';

interface AreasTabProps {
  currentRole: Role;
}

export const AreasTab: React.FC<AreasTabProps> = ({ currentRole: _currentRole }) => {
  const { areas, branches, addArea, updateArea, deleteArea } = useMasterData();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Area | null>(null);
  const [deletingItem, setDeletingItem] = useState<Area | null>(null);

  const canCreate = hasPermission('master_data.create');
  const canEdit = hasPermission('master_data.edit');
  const canDelete = hasPermission('master_data.delete');

  const getBranchName = (id: string) => branches.find(b => b.id === id)?.name || 'Unknown Branch';

  const filteredData = areas.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    getBranchName(item.branchId).toLowerCase().includes(search.toLowerCase())
  );

  const activeData = filteredData.filter(item => item.status === 'active');
  const inactiveData = filteredData.filter(item => item.status !== 'active');

  const handleSubmit = async (formData: any) => {
    if (editingItem) {
      if (!canEdit) {
        toast.error("Anda tidak memiliki izin untuk mengubah data daerah");
        return;
      }
      await updateArea({ ...editingItem, ...formData });
    } else {
      if (!canCreate) {
        toast.error("Anda tidak memiliki izin untuk menambah data daerah");
        return;
      }
      const newItem: Area = {
        id: Math.random().toString(36).substr(2, 9),
        ...formData
      };
      await addArea(newItem);
    }
    setIsAddOpen(false);
    setEditingItem(null);
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) {
      toast.error("Anda tidak memiliki izin untuk menghapus data daerah");
      return;
    }
    await deleteArea(id);
  };

  const openEdit = (item: Area) => {
    setEditingItem(item);
    setIsAddOpen(true);
  };

  const renderTable = (items: Area[], title: string, variant: 'active' | 'inactive') => {
    if (items.length === 0) return null;

    return (
      <div className="mb-8 last:mb-0">
        <MasterDataTableTitle title={title} count={items.length} variant={variant} />

        <div className="tablePanel">
          {/* Desktop Table */}
          <div className="hidden md:block">
            <DataTable
              actionWidth={82}
              cellY={12}
              className="masterDataAreaTable"
              columns={[64, 300, 300, 90, (canEdit || canDelete) ? 82 : null]}
              minWidth={canEdit || canDelete ? 836 : 754}
              rowMinHeight={64}
            >
            <table>
              <thead>
                <tr>
                  <th className="text-center">No</th>
                  <th>Nama Daerah</th>
                  <th>Induk Cabang</th>
                  <th className="text-center">Status</th>
                  {(canEdit || canDelete) && <TableActionHeader />}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id}>
                    <td className="monoCell text-center">
                      {index + 1}
                    </td>
                    <td>
                      <TableText primary={item.name} />
                    </td>
                    <td>
                      <TableText primary={getBranchName(item.branchId)} />
                    </td>
                    <TableStatusCell>
                      <TableStatusIcon
                        label={item.status === 'active' ? 'Aktif' : 'Non aktif'}
                        tone={item.status === 'active' ? 'active' : 'inactive'}
                      />
                    </TableStatusCell>
                    {(canEdit || canDelete) && (
                      <TableActionCell>
                        <TableActionMenu>
                          {canEdit && (
                            <TableActionMenuItem icon={Edit} onClick={() => openEdit(item)}>
                              Edit Daerah
                            </TableActionMenuItem>
                          )}
                          {canDelete && (
                            <TableActionMenuItem danger icon={Trash2} onClick={() => setDeletingItem(item)}>
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

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
             {items.map((item) => (
                <div key={item.id} className="p-4 bg-white dark:bg-slate-800">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                           <div className={cn("p-2 rounded-lg", variant === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>
                                <Map className="w-5 h-5" />
                           </div>
                           <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">{item.name}</h3>
                        </div>
                        <TableStatusIcon
                          label={item.status === 'active' ? 'Aktif' : 'Non aktif'}
                          tone={item.status === 'active' ? 'active' : 'inactive'}
                        />
                    </div>
                    
                    <div className="pl-[52px] space-y-1 mb-3">
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Induk Cabang</p>
                        <p className="text-sm text-slate-800 dark:text-slate-200 font-semibold">{getBranchName(item.branchId)}</p>
                    </div>

                    {(canEdit || canDelete) && (
                      <MobileCardActions
                        className="ml-[52px]"
                        actions={[
                          ...(canEdit ? [{ icon: Edit, label: 'Edit', onClick: () => openEdit(item) }] : []),
                          ...(canDelete ? [{ danger: true, icon: Trash2, label: 'Hapus', onClick: () => setDeletingItem(item) }] : []),
                        ]}
                      />
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
      
      <ControlPanel aria-label="Filter daerah">
        <ControlRow className="masterDataControlRow">
          <SearchBox
            placeholder="Cari daerah..."
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
              <Plus /> Tambah Daerah
            </Button>
            </div>
          )}
        </ControlRow>
      </ControlPanel>

      {filteredData.length > 0 ? (
          <>
            {renderTable(activeData, "Daerah Aktif", 'active')}
            {renderTable(inactiveData, "Daerah Non-Aktif", 'inactive')}
          </>
      ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
               <div className="p-4 rounded-full bg-slate-50 dark:bg-slate-900 mb-4">
                   <Map className="w-8 h-8 text-slate-300" />
               </div>
               <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Tidak ada data daerah</h3>
               <p className="text-slate-500 text-sm max-w-xs mx-auto mt-1">
                   {search ? 'Tidak ditemukan data yang sesuai dengan pencarian Anda.' : 'Belum ada data daerah yang ditambahkan.'}
               </p>
          </div>
      )}

      {/* Modal Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-900 border-none shadow-2xl p-0 overflow-hidden rounded-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="px-6 py-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Map className="w-5 h-5 text-blue-600" />
                {editingItem ? 'Edit Daerah' : 'Tambah Daerah Baru'}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Kelola data daerah operasional berdasarkan cabang.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 overflow-y-auto bg-slate-50/50 dark:bg-slate-950">
            <AreaForm 
              item={editingItem}
              branches={branches}
              onSubmit={handleSubmit}
              onCancel={() => {
                setIsAddOpen(false);
                setEditingItem(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent className="bg-white dark:bg-slate-800 dark:border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-slate-200">Hapus Daerah</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-slate-400">
              Apakah anda yakin ingin menghapus daerah <strong>{deletingItem?.name}</strong>?
              <br/>Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">Batal</AlertDialogCancel>
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
    </div>
  );
};
