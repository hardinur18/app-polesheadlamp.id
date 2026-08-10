import React, { useState, useEffect } from 'react';
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Plus, Trash2, List, Scale, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useMasterData } from "@/app/pages/master-data/context";
import { logActivity } from "@/app/services/auditService";
import { MasterDataTableTitle } from "@/app/components/ui/master-data-table-title";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { createDataTableColumns, DataTable, TableActionCell, TableActionHeader, TableText } from "@/app/components/ui/data-table";
import { OperationalEmptyState, OperationalTableCard } from "@/app/components/ui/operational-page";

export function StockSettings() {
  const { services, currentUser } = useMasterData();
  const activeServices = services.filter(s => s.status === 'active');

  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<{ id: string, name: string }[]>([]);
  const [newUnit, setNewUnit] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('stock_units')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Gagal memuat pengaturan stok");
    } finally {
      setLoading(false);
    }
  };

  const addUnit = async () => {
    if (!newUnit.trim()) return;
    
    try {
        const { data, error } = await supabase
            .from('stock_units')
            .insert([{ name: newUnit.trim() }])
            .select();

        if (error) throw error;
        
        setUnits([...units, data[0]]);
        setNewUnit("");
        toast.success("Satuan ditambahkan");
        if (currentUser) {
          logActivity(
            { id: currentUser.id, name: currentUser.name, role: currentUser.role },
            'CREATE',
            'Satuan Stok',
            `Menambahkan satuan baru: ${newUnit.trim()}`,
            data[0].id
          );
        }
    } catch (error: any) {
        if (error.code === '23505') {
            toast.error("Satuan sudah ada");
        } else {
            toast.error("Gagal menyimpan satuan");
        }
    }
  };

  const removeUnit = async (id: string) => {
    try {
        const { error } = await supabase
            .from('stock_units')
            .delete()
            .eq('id', id);

        if (error) throw error;
        const deletedUnit = units.find(u => u.id === id);
        setUnits(units.filter(u => u.id !== id));
        toast.success("Satuan dihapus");
        if (currentUser && deletedUnit) {
          logActivity(
            { id: currentUser.id, name: currentUser.name, role: currentUser.role },
            'DELETE',
            'Satuan Stok',
            `Menghapus satuan: ${deletedUnit.name}`,
            id
          );
        }
    } catch (error) {
        toast.error("Gagal menghapus satuan");
    }
  };

  return (
    <div className="inventorySettingsGrid">
      <OperationalTableCard className="inventoryTableCard">
          <MasterDataTableTitle title="Jenis Layanan Aktif" count={activeServices.length} variant="active" icon={List} />
          <DataTable
            columns={createDataTableColumns(['number', 'name', 'text', 'status'])}
            rowMinHeight={58}
            cellY={11}
            textMax={260}
          >
            <table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Layanan</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeServices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="border-0">
                      <OperationalEmptyState icon={List} title="Tidak ada layanan aktif" description="Data layanan aktif diambil dari Master Data Layanan." className="py-10" />
                    </TableCell>
                  </TableRow>
                ) : (
                  activeServices.map((service, index) => (
                    <TableRow key={service.id} className="border-slate-100 hover:bg-blue-50/40 dark:border-slate-800 dark:hover:bg-slate-800/60">
                      <TableCell className="inventoryTableIndexCell">{index + 1}</TableCell>
                      <TableCell><TableText primary={service.name} /></TableCell>
                      <TableCell><span className="inventoryPlainCellText">{service.category || '-'}</span></TableCell>
                      <TableCell><span className="inventoryStockTypeText isIN">Aktif</span></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </table>
          </DataTable>
      </OperationalTableCard>

      {/* Units */}
      <OperationalTableCard className="inventoryTableCard">
          <MasterDataTableTitle title="Satuan Stok" count={units.length} variant="active" icon={Scale} />
          <div className="inventorySettingsToolbar">
            <Input 
                className="uiInput"
                placeholder="Tambah satuan..." 
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addUnit()}
            />
            <Button onClick={addUnit} disabled={loading || !newUnit.trim()} icon={<Plus className="h-4 w-4" />} className="inventoryPrimaryButton">
                Tambah
            </Button>
          </div>
          <DataTable
            actionWidth={82}
            columns={createDataTableColumns(['number', 'name', 'action'])}
            rowMinHeight={58}
            cellY={11}
            textMax={300}
          >
            <table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Satuan</TableHead>
                  <TableActionHeader />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={3} className="h-28 text-center border-0"><Loader2 className="animate-spin h-6 w-6 mx-auto text-slate-300" /></TableCell></TableRow>
                ) : units.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="border-0">
                      <OperationalEmptyState icon={Scale} title="Belum ada satuan stok" description="Tambahkan satuan seperti pcs, liter, pack, atau kg." className="py-10" />
                    </TableCell>
                  </TableRow>
                ) : (
                  units.map((unit, index) => (
                    <TableRow key={unit.id} className="border-slate-100 hover:bg-blue-50/40 dark:border-slate-800 dark:hover:bg-slate-800/60">
                      <TableCell className="inventoryTableIndexCell">{index + 1}</TableCell>
                      <TableCell><TableText primary={unit.name} /></TableCell>
                      <TableActionCell>
                        <Button variant="ghost" size="icon" className="inventoryIconButton text-slate-400 hover:text-red-500" onClick={() => removeUnit(unit.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableActionCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </table>
          </DataTable>
      </OperationalTableCard>
    </div>
  );
}
