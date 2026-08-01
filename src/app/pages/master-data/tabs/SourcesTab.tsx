import React, { useState } from 'react';
import { Plus, Edit, Trash2, FileText } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { DataTable, TableActionCell, TableActionHeader, TableActionMenu, TableActionMenuItem, TableStatusCell, TableStatusIcon, TableText } from '../../../components/ui/data-table';
import {
  Dialog, DialogHeader, DialogTitle, DialogDescription
} from '../../../components/ui/dialog';
import { Badge } from '../../../components/ui/badge';
import { Role, MOCK_SOURCES, MOCK_AD_ACCOUNTS } from '../data';
import { toast } from 'sonner';
import { AdSourceForm } from '../forms/AdSourceForm';
import { useMasterData } from '../context';
import { usePermissions } from '@/app/hooks/usePermissions';
import { ControlPanel, ControlRow, SearchBox } from '../../../components/ui/control-panel';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import { MasterDataTableTitle } from '../../../components/ui/master-data-table-title';
import {
  MasterDataFormDialogContent,
  MasterDataUnsavedChangesDialog,
  MobileCardActions,
  useMasterDataFormCloseGuard,
} from '../../../components/ui/master-data-ui';

interface SourcesTabProps {
  currentRole: Role;
}

export const SourcesTab: React.FC<SourcesTabProps> = ({ currentRole }) => {
  const { sources, addSource, updateSource, deleteSource, adAccounts } = useMasterData();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [deletingItem, setDeletingItem] = useState<any | null>(null);
  const [isFormDirty, setIsFormDirty] = useState(false);

  const canCreate = hasPermission('master_data.create');
  const canEdit = hasPermission('master_data.edit');
  const canDelete = hasPermission('master_data.delete');
  const canManage = canCreate || canEdit || canDelete;

  const closeFormDialog = React.useCallback(() => {
    setIsFormDirty(false);
    setIsAddOpen(false);
  }, []);

  const formCloseGuard = useMasterDataFormCloseGuard({
    hasUnsavedChanges: isFormDirty,
    onClose: closeFormDialog,
  });

  const requestFormDialogOpenChange = (open: boolean) => {
    if (open) {
      setIsAddOpen(true);
      return;
    }
    formCloseGuard.requestClose();
  };

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
    <div className="masterDataTabSurface">
      {/* Main Content Card */}
      <div className="space-y-4">
        
        {/* Toolbar */}
        <ControlPanel aria-label="Filter sumber iklan">
          <ControlRow className="masterDataControlRow">
            <SearchBox
              placeholder="Cari sumber atau akun iklan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="masterDataControlActions">
              {canCreate && (
                <Button
                  className="masterDataActionButton"
                  onClick={() => {
                    setEditingItem(null);
                    setIsAddOpen(true);
                  }}
                >
                  <Plus />
                  Tambah Sumber
                </Button>
              )}
            </div>
          </ControlRow>
        </ControlPanel>

        {/* Data Table (Desktop) */}
        <div className="hidden md:block">
          {filteredData.length > 0 ? (
            <div>
              <MasterDataTableTitle title="Sumber Iklan" count={filteredData.length} />
              <div className="tablePanel">
                <DataTable
                  actionWidth={82}
                  cellY={12}
                  columns={[64, 300, 280, 220, 90, canManage ? 82 : null]}
                  minWidth={canManage ? 1036 : 954}
                  rowMinHeight={64}
                >
                  <table>
                    <thead>
                      <tr>
                        <th className="text-center">No</th>
                        <th>Nama Campaign</th>
                        <th>Akun Iklan</th>
                        <th>Default CS</th>
                        <th className="text-center">Status</th>
                        {canManage && <TableActionHeader />}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((item, index) => (
                        <tr key={item.id}>
                          <td className="monoCell text-center">{index + 1}</td>
                          <td><TableText primary={item.name} /></td>
                          <td><TableText primary={getAdAccountName(item.adAccountId)} /></td>
                          <td><TableText primary={item.defaultCsName || '-'} /></td>
                          <TableStatusCell>
                            <TableStatusIcon
                              label={item.status === 'active' ? 'Aktif' : 'Non aktif'}
                              tone={item.status === 'active' ? 'active' : 'inactive'}
                            />
                          </TableStatusCell>
                          {canManage && (
                            <TableActionCell>
                              <TableActionMenu>
                                {canEdit && (
                                  <TableActionMenuItem icon={Edit} onClick={() => openEdit(item)}>
                                    Edit Sumber
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
            </div>
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
                        <TableStatusIcon
                          label={item.status === 'active' ? 'Aktif' : 'Non aktif'}
                          tone={item.status === 'active' ? 'active' : 'inactive'}
                        />
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
                      <MobileCardActions
                        actions={[
                          { icon: Edit, label: 'Edit', onClick: () => openEdit(item) },
                          { danger: true, icon: Trash2, label: 'Hapus', onClick: () => setDeletingItem(item) },
                        ]}
                      />
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

      <Dialog open={isAddOpen} onOpenChange={requestFormDialogOpenChange}>
        <MasterDataFormDialogContent>
          <DialogHeader className="px-6 py-4 bg-slate-50 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">{editingItem ? 'Edit Sumber Iklan' : 'Tambah Sumber Iklan'}</DialogTitle>
            <DialogDescription className="sr-only">Form untuk sumber iklan</DialogDescription>
          </DialogHeader>
          <div className="px-6">
            <AdSourceForm 
              item={editingItem}
              onSubmit={handleSubmit}
              onDirtyChange={setIsFormDirty}
              onCancel={formCloseGuard.requestClose}
            />
          </div>
        </MasterDataFormDialogContent>
        <MasterDataUnsavedChangesDialog
          open={formCloseGuard.isConfirmOpen}
          onCancel={formCloseGuard.cancelClose}
          onConfirm={formCloseGuard.confirmClose}
        />
      </Dialog>

      <AlertDialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent className="bg-white dark:bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Sumber Iklan</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah anda yakin ingin menghapus sumber iklan <strong>{deletingItem?.name}</strong>?
              <br/>Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="dangerButton"
              onClick={() => {
                if (deletingItem) handleDelete(deletingItem.id);
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
