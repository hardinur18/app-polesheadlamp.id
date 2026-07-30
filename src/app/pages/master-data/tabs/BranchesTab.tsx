import React, { useState } from 'react';
import {
  Plus, Edit, Trash2,
  MapPin, Building2, Clock
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { ControlPanel, ControlRow, SearchBox } from '../../../components/ui/control-panel';
import { DataTable, TableActionCell, TableActionHeader, TableText } from '../../../components/ui/data-table';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/ui/tooltip"
import { Badge } from '../../../components/ui/badge';
import { Branch, Role } from '../data';
import { useMasterData } from '../context';
import { usePermissions } from '@/app/hooks/usePermissions';
import { toast } from 'sonner';
import { BranchForm } from '../forms/BranchForm';
import { cn } from '../../../components/ui/utils';

interface BranchesTabProps {
  currentRole: Role;
}

export const BranchesTab: React.FC<BranchesTabProps> = ({ currentRole: _currentRole }) => {
  const { branches, addBranch, updateBranch, deleteBranch } = useMasterData();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Branch | null>(null);

  const canCreate = hasPermission('master_data.create');
  const canEdit = hasPermission('master_data.edit');
  const canDelete = hasPermission('master_data.delete');

  const filteredData = branches
    .filter(item => 
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.city.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

  const activeBranches = filteredData.filter(b => b.status === 'active');
  const otherBranches = filteredData.filter(b => b.status !== 'active');

  const handleSubmit = async (formData: any) => {
    if (editingItem) {
      if (!canEdit) {
        toast.error("Anda tidak memiliki izin untuk mengubah data cabang");
        return;
      }
      await updateBranch({ ...editingItem, ...formData });
    } else {
      if (!canCreate) {
        toast.error("Anda tidak memiliki izin untuk menambah data cabang");
        return;
      }
      const newItem: Branch = {
        id: Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString(),
        ...formData
      };
      await addBranch(newItem);
    }
    
    setIsAddOpen(false);
    setEditingItem(null);
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) {
      toast.error("Anda tidak memiliki izin untuk menghapus data cabang");
      return;
    }
    await deleteBranch(id);
  };

  const openEdit = (item: Branch) => {
    setEditingItem(item);
    setIsAddOpen(true);
  };

  const renderBranchTable = (data: Branch[], title: string, icon: any, variant: 'active' | 'other') => {
    if (data.length === 0) return null;

    return (
      <div className="mb-8 last:mb-0">
        <div className="flex items-center gap-2 mb-4 px-1">
            <div className={cn("p-1.5 rounded-lg", variant === 'active' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400")}>
                {icon}
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
            <Badge variant="secondary" className="ml-2 bg-slate-100 dark:bg-slate-800 text-slate-500">
                {data.length}
            </Badge>
        </div>

        <div className="tablePanel">
          {/* Desktop Table */}
          <div className="hidden md:block">
          <DataTable actionWidth={112} cellY={12} minWidth={1180} rowMinHeight={66}>
            <table>
              <colgroup>
                <col style={{ width: 230 }} />
                <col style={{ width: 300 }} />
                <col style={{ width: 190 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 130 }} />
                {(canEdit || canDelete) && <col style={{ width: 112 }} />}
              </colgroup>
              <thead>
                <tr>
                  <th>Nama Cabang</th>
                  <th>Lokasi</th>
                  <th>Koordinat</th>
                  <th>Maps</th>
                  <th>Coverage</th>
                  <th>Status</th>
                  {(canEdit || canDelete) && <TableActionHeader />}
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <TableText primary={item.name} secondary={item.code || '-'} />
                    </td>
                    <td>
                      <TableText primary={item.city} secondary={item.address || '-'} />
                    </td>
                    <td>
                       {item.lat && item.lng ? (
                          <TableText primary={`${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}`} />
                       ) : (
                         <TableText primary="-" />
                       )}
                    </td>
                    <td>
                      {item.mapsUrl ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a 
                                href={item.mapsUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="iconButton ghostButton mx-auto"
                              >
                                <MapPin className="h-4 w-4" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Buka di Google Maps</p>
                            </TooltipContent>
                          </Tooltip>
                      ) : (
                        <TableText primary="-" />
                      )}
                    </td>
                    <td>
                      <TableText primary={item.radius ? `${item.radius} KM` : (item.geofence ? 'Geofence' : '-')} />
                    </td>
                    <td>
                      <div className="flex flex-col items-center gap-1">
                        <Badge 
                          variant="outline"
                          className={cn("uppercase text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-sm",
                             item.status === 'active' 
                            ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800" 
                            : item.status === 'coming_soon'
                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600"
                          )}
                        >
                          {item.status === 'active' ? 'AKTIF' : item.status === 'coming_soon' ? 'COMING SOON' : 'NON AKTIF'}
                        </Badge>
                        {item.status === 'coming_soon' && item.openingDate && (
                             <span className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                Est. {new Date(item.openingDate).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}
                             </span>
                          )}
                      </div>
                    </td>
                    {(canEdit || canDelete) && (
                      <TableActionCell>
                          {canEdit && (
                            <Button variant="ghost" size="icon" onClick={() => openEdit(item)} aria-label="Edit cabang">
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="Hapus cabang">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-white dark:bg-slate-800 dark:border-slate-700">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="dark:text-slate-200">Hapus Cabang</AlertDialogTitle>
                                  <AlertDialogDescription className="dark:text-slate-400">
                                    Hapus cabang <strong>{item.name}</strong> secara permanen?
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
                      </TableActionCell>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
          </div>

          {/* Mobile List View */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
             {data.map((item) => (
                <div key={item.id} className="p-4 bg-white dark:bg-slate-800">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                             <div className={cn("p-2 rounded-lg", variant === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>
                                <Building2 className="w-5 h-5" />
                             </div>
                             <div>
                                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base">{item.name}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <Badge 
                                        variant="outline"
                                        className={cn("text-[10px] px-1.5 py-0 h-4 border-0", 
                                            item.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                                        )}
                                    >
                                        {item.status === 'active' ? 'Active' : 'Coming Soon'}
                                    </Badge>
                                    <span className="text-xs text-slate-400">|</span>
                                    <span className="text-xs text-slate-500">{item.code}</span>
                                </div>
                             </div>
                        </div>
                        {canEdit && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-slate-400" onClick={() => openEdit(item)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                    </div>
                    
                    <div className="pl-[52px] space-y-2">
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                            {item.address || 'Belum ada alamat'}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                             <div className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {item.city}
                             </div>
                             {item.radius && (
                                <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                    {item.radius} KM
                                </div>
                             )}
                        </div>
                        
                        <div className="flex gap-2 pt-2">
                             {item.mapsUrl && (
                                <a href={item.mapsUrl} target="_blank" className="flex-1">
                                    <Button variant="outline" size="sm" className="w-full text-xs h-8">
                                        Open Maps
                                    </Button>
                                </a>
                             )}
                        </div>
                    </div>
                </div>
             ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="masterDataTabSurface">
      <ControlPanel aria-label="Filter cabang">
        <ControlRow className="masterDataControlRow">
            <SearchBox
              placeholder="Cari cabang atau kota..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

          {canCreate && (
            <Button 
              className="masterDataActionButton"
              onClick={() => {
                setEditingItem(null);
                setIsAddOpen(true);
              }}
            >
              <Plus /> Tambah Cabang
            </Button>
          )}
        </ControlRow>
      </ControlPanel>

      {/* Render Sections */}
      {filteredData.length > 0 ? (
          <>
            {renderBranchTable(activeBranches, 'Cabang Operasional', <Building2 className="w-5 h-5" />, 'active')}
            {renderBranchTable(otherBranches, 'Coming Soon / Non-Aktif', <Clock className="w-5 h-5" />, 'other')}
          </>
      ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
               <div className="p-4 rounded-full bg-slate-50 dark:bg-slate-900 mb-4">
                   <Building2 className="w-8 h-8 text-slate-300" />
               </div>
               <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Tidak ada data cabang</h3>
               <p className="text-slate-500 text-sm max-w-xs mx-auto mt-1">
                   {search ? 'Tidak ditemukan data yang sesuai dengan pencarian Anda.' : 'Belum ada data cabang yang ditambahkan.'}
               </p>
          </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[600px] bg-white dark:bg-slate-900 border-none shadow-2xl p-0 overflow-hidden rounded-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="px-6 py-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                {editingItem ? 'Edit Cabang' : 'Tambah Cabang Baru'}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Kelola informasi lokasi dan cakupan wilayah operasional.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 overflow-y-auto bg-slate-50/50 dark:bg-slate-950">
            <BranchForm 
              item={editingItem}
              existingBranches={branches}
              onSubmit={handleSubmit}
              onCancel={() => setIsAddOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
