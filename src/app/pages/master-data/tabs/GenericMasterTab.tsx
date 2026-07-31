import React, { useState } from 'react';
import {
  Plus, Edit, Trash2,
  LucideIcon
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
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
} from "../../../components/ui/alert-dialog"
import { Badge } from '../../../components/ui/badge';
import { ControlPanel, ControlRow, SearchBox } from '../../../components/ui/control-panel';
import { DataTable, TableActionCell, TableActionHeader, TableActionMenu, TableActionMenuItem, TableStatusCell, TableStatusIcon, TableText } from '../../../components/ui/data-table';
import { MasterDataTableTitle } from '../../../components/ui/master-data-table-title';
import { MobileCardActions } from '../../../components/ui/master-data-ui';
import { PlatformLogo } from '../../../components/ui/platform-logo';
import { OperationalEmptyState, OperationalTableCard } from '../../../components/ui/operational-page';
import { Role } from '../data';
import { toast } from 'sonner';
import { usePermissions } from '@/app/hooks/usePermissions';
import { logActivity } from '@/app/services/auditService';
import { useMasterData } from '../context';
import { GenericForm } from '../forms/GenericForm';
import { MasterDataDetailDialog } from './MasterDataDetailDialog';
import { cn } from '../../../components/ui/utils';
import { getVehicleNameValidationMessage, normalizeVehicleName } from '../vehicleValidation';
import { deletePlatformLogo, uploadPlatformLogo } from '@/app/services/platformLogoService';

const PAGE_SIZE_OPTIONS = [50, 100, 200, 300];

interface GenericMasterTabProps {
  currentRole: Role;
  title: string;
  type: 'simple' | 'vehicle' | 'payment' | 'sub_channel' | 'vendor' | 'platform';
  initialData?: any[];
  data?: any[]; // Optional controlled data
  onAdd?: (item: any) => void | Promise<void>; // Optional controlled handler
  onUpdate?: (item: any) => void | Promise<void>; // Optional controlled handler
  onDelete?: (id: string) => void | Promise<void>; // Optional controlled handler
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
  const [deletingItem, setDeletingItem] = useState<any | null>(null);
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
    let uploadedLogoPath: string | null = null;
    let previousLogoToDelete: string | null = null;

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
    } else if (type === 'platform') {
      cleanData.name = formData.name;
      cleanData.description = formData.description;
      cleanData.logoPath = editingItem?.logoPath || null;
    } else {
      cleanData.name = formData.name;
      cleanData.description = formData.description;
    }

    try {
      if (editingItem) {
        if (type === 'platform') {
          if (formData.removeLogo && editingItem.logoPath) {
            cleanData.logoPath = null;
            previousLogoToDelete = editingItem.logoPath;
          }
          if (formData.logoFile instanceof File) {
            cleanData.logoPath = await uploadPlatformLogo(editingItem.id, formData.logoFile, editingItem.logoPath, {
              removePrevious: false,
            });
            uploadedLogoPath = cleanData.logoPath;
            if (editingItem.logoPath && editingItem.logoPath !== cleanData.logoPath) {
              previousLogoToDelete = editingItem.logoPath;
            }
          }
        }
        const updatePayload = { ...cleanData, id: editingItem.id };
        if (onUpdate) {
          await onUpdate(updatePayload);
        } else {
          setLocalData(prev => prev.map(item => item.id === editingItem.id ? { ...item, ...updatePayload } : item));
        }
        if (previousLogoToDelete) {
          await deletePlatformLogo(previousLogoToDelete).catch((error) => {
            console.warn('Gagal membersihkan logo platform lama:', error);
          });
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
        const newId = Math.random().toString(36).substr(2, 9);
        if (type === 'platform' && formData.logoFile instanceof File) {
          cleanData.logoPath = await uploadPlatformLogo(newId, formData.logoFile, null);
          uploadedLogoPath = cleanData.logoPath;
        }
        const newItem = {
          id: newId,
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
      if (!editingItem && uploadedLogoPath) {
        await deletePlatformLogo(uploadedLogoPath).catch(() => undefined);
      } else if (editingItem && uploadedLogoPath && uploadedLogoPath !== editingItem.logoPath) {
        await deletePlatformLogo(uploadedLogoPath).catch(() => undefined);
      }
      console.error("Form submission error:", error);
      toast.error(`Terjadi kesalahan: ${error.message || "Gagal menyimpan data"}`); 
    }
  };

  const handleDelete = async (id: string) => {
    const deletedItem = filteredData.find(item => item.id === id);
    if (type === 'platform' && deletedItem?.logoPath) {
      await deletePlatformLogo(deletedItem.logoPath).catch((error) => {
        console.warn('Gagal menghapus logo platform:', error);
      });
    }
    if (onDelete) {
      await onDelete(id);
    } else {
      setLocalData(prev => prev.filter(item => item.id !== id));
    }
    toast.success("Data berhasil dihapus");
    if (currentUser) {
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
        <MasterDataTableTitle
          title={sectionTitle}
          count={totalCount}
          variant={variant}
        />

        <OperationalTableCard>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <DataTable
              actionWidth={82}
              cellY={12}
              columns={[72, 260, ...(columns?.map(() => 220) || []), 90, (canEdit || canDelete) ? 82 : null]}
              minWidth={columns?.length ? 504 + columns.length * 220 : 504}
              rowMinHeight={64}
            >
            <table>
              <thead>
                <tr>
                  <th className="text-center">No</th>
                  <th>Nama {title}</th>
                  {columns?.map((col, idx) => (
                    <th key={idx}>{col.header}</th>
                  ))}
                  <th className="text-center">Status</th>
                  {(canEdit || canDelete) && <TableActionHeader />}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ item, rowNumber }) => (
                  <tr
                    key={item.id} 
                    className="cursor-pointer"
                    onClick={() => setViewingItem(item)}
                  >
                    <td className="monoCell text-center">
                      {rowNumber}
                    </td>
                    <td>
                      {type === 'platform' ? (
                        <div className="platformLogoTableCell">
                          <PlatformLogo density="compact" logoPath={item.logoPath} name={item.name || item.bankName} size="sm" />
                          <TableText primary={item.name || item.bankName} />
                        </div>
                      ) : (
                        <TableText primary={item.name || item.bankName} />
                      )}
                    </td>
                    {columns?.map((col, idx) => (
                      <td key={idx}>
                        <TableText primary={col.render ? col.render(item) : item[col.accessor]} />
                      </td>
                    ))}
                    <TableStatusCell>
                      <TableStatusIcon
                        label={item.status === 'active' || !item.status ? 'Aktif' : 'Non aktif'}
                        tone={item.status === 'active' || !item.status ? 'active' : 'inactive'}
                      />
                    </TableStatusCell>
                    {(canEdit || canDelete) && (
                      <TableActionCell onClick={(e) => e.stopPropagation()}>
                        <TableActionMenu>
                          {canEdit && (
                            <TableActionMenuItem icon={Edit} onClick={() => openEdit(item)}>
                                Edit {title}
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
                             {type === 'platform' ? (
                                <PlatformLogo logoPath={item.logoPath} name={item.name || item.bankName} />
                             ) : (
                               <div className={cn("p-2 rounded-lg", variant === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>
                                  <Icon className="w-5 h-5" />
                               </div>
                             )}
                             <div>
                                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                                    {item.name || item.bankName}
                                </h4>
                                <div className="mt-1">
                                  <TableStatusIcon
                                    label={item.status === 'active' || !item.status ? 'Aktif' : 'Non aktif'}
                                    tone={item.status === 'active' || !item.status ? 'active' : 'inactive'}
                                  />
                                </div>
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
                      <MobileCardActions
                        className="ml-[52px]"
                        actions={[
                          ...(canEdit ? [{
                            icon: Edit,
                            label: 'Edit',
                            onClick: () => openEdit(item),
                          }] : []),
                          ...(canDelete ? [{
                            danger: true,
                            icon: Trash2,
                            label: 'Hapus',
                            onClick: () => setDeletingItem(item),
                          }] : []),
                        ]}
                      />
                    )}
                </div>
             ))}
          </div>
        </OperationalTableCard>
      </div>
    );
  };

  return (
    <div className="masterDataTabSurface">
      <ControlPanel aria-label={`Filter ${title}`}>
        <ControlRow className="masterDataControlRow">
            <SearchBox
              placeholder={`Cari ${title}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

        {canAdd && (
            <div className="masterDataControlActions">
              {onImport && (
                <Button 
                  variant="outline"
                  className="masterDataActionButton secondary"
                  onClick={onImport}
                >
                  Import Data
                </Button>
              )}
              <Button 
                className="masterDataActionButton"
                onClick={() => {
                  setEditingItem(null);
                  setIsAddOpen(true);
                }}
              >
                <Plus /> Tambah {title}
              </Button>
            </div>
        )}
        </ControlRow>
      </ControlPanel>

      {filteredData.length > 0 ? (
          <>
            {renderSection(activeItems, `${title} Aktif`, 'active', activeTotal)}
            {renderSection(inactiveItems, `${title} Non-Aktif`, 'inactive', inactiveTotal)}

            <div className="surfacePanel flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[length:var(--text-xs)] font-semibold text-[color:var(--muted)]">
                Menampilkan {pageStartIndex + 1}-{pageEndIndex} dari {filteredData.length} data
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
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
                    disabled={currentPage === totalPages || totalPages === 0}
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  >
                    &gt;
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[color:var(--muted)]">Tampilkan</span>
                  <Select
                    value={String(itemsPerPage)}
                    onValueChange={(value) => setItemsPerPage(Number(value))}
                  >
                    <SelectTrigger className="h-8 w-[140px] rounded-md text-xs">
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
          <OperationalTableCard className="border-dashed">
            <OperationalEmptyState
              icon={Icon}
              title={`Tidak ada data ${title}`}
              description={search ? 'Tidak ditemukan data yang sesuai dengan pencarian Anda.' : `Belum ada data ${title} yang ditambahkan.`}
            />
          </OperationalTableCard>
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

      <AlertDialog open={Boolean(deletingItem)} onOpenChange={(open) => {
        if (!open) setDeletingItem(null);
      }}>
        <AlertDialogContent className="bg-white dark:bg-slate-800 dark:border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-slate-200">Hapus {title}</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-slate-400">
              Apakah anda yakin ingin menghapus {title.toLowerCase()} <strong>{deletingItem?.name || deletingItem?.bankName}</strong>?
              <br />Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">
              Batal
            </AlertDialogCancel>
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
