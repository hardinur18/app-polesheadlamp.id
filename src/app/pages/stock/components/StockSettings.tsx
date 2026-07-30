import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Plus, Trash2, List, Scale, Loader2, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useMasterData } from "@/app/pages/master-data/context";
import { logActivity } from "@/app/services/auditService";
import { Badge } from "@/app/components/ui/badge";

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
    <div className="grid gap-4 xl:grid-cols-2">
      {/* Service Types (Read-only from Master Data) */}
      <Card className="overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="border-b border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
             <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300">
               <List className="h-4 w-4" />
             </div>
             <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">Jenis Layanan</CardTitle>
          </div>
          <CardDescription className="flex items-start gap-1.5 text-sm">
            <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
            <span>Data diambil otomatis dari <strong>Master Data &gt; Layanan</strong> yang berstatus aktif. Untuk menambah/mengubah layanan, kelola di halaman Master Data.</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {activeServices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Tidak ada layanan aktif di Master Data</p>
            ) : (
                activeServices.map((service) => (
                    <div key={service.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3 transition-colors hover:bg-slate-100/70 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-800/70">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{service.name}</span>
                            {service.category && (
                                <Badge variant="secondary" className="text-[10px] font-normal">{service.category}</Badge>
                            )}
                        </div>
                        <span className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                            Aktif
                        </span>
                    </div>
                ))
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              Kelola layanan di menu <strong className="text-slate-500">Master Data</strong>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Units */}
      <Card className="overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="border-b border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
             <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300">
               <Scale className="h-4 w-4" />
             </div>
             <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">Satuan (UoM)</CardTitle>
          </div>
          <CardDescription>Satuan pengukuran stok (Pcs, Liter, Kg, dll)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input 
                className="h-9 border-slate-200 bg-slate-50 shadow-none focus-visible:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950"
                placeholder="Tambah satuan..." 
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addUnit()}
            />
            <Button onClick={addUnit} disabled={loading || !newUnit.trim()} className="h-9 bg-blue-600 text-white shadow-sm hover:bg-blue-700">
                <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-2 mt-4 max-h-[300px] overflow-y-auto pr-1">
            {loading ? (
                <div className="flex justify-center p-4"><Loader2 className="animate-spin h-6 w-6 text-slate-300" /></div>
            ) : units.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Belum ada data</p>
            ) : (
                units.map((unit) => (
                    <div key={unit.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 p-3 transition-colors hover:bg-slate-100/70 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-800/70">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{unit.name}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={() => removeUnit(unit.id)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
