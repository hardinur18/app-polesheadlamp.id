import React, { useState, useEffect, useMemo } from 'react';
import { useMasterData } from '../master-data/context';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription 
} from '../../components/ui/dialog';
import { Plus, Trash2, Save, Loader2, RefreshCw, X, Target, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '../../components/ui/utils';
import { Label } from '../../components/ui/label';
import { usePermissions } from '@/app/hooks/usePermissions';
import { getSessionBackedEdgeHeaders } from '@/app/services/internal/sessionClientHeaders';
import { buildMakeServerUrl } from '@/app/services/internal/functionsBaseUrl';

export interface TargetItem {
    id: string;
    branchId?: string; // Made optional as it's removed from UI
    serviceId: string;
    month: string; // YYYY-MM
    revenueTarget: number;
    orderTarget: number;
    leadsTarget: number; 
    workingDays: number;
}

export interface TargetManagerProps {
    month: Date;
    onClose: () => void;
    onUpdate: () => void; // Trigger refresh in parent
    className?: string;
    defaultShowPrompt?: boolean;
}

export function TargetManager({ month, onClose, onUpdate, className }: TargetManagerProps) {
    const { services } = useMasterData();
    const { hasPermission } = usePermissions();
    const [targets, setTargets] = useState<TargetItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // Form Dialog State
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newTarget, setNewTarget] = useState<Partial<TargetItem>>({
        workingDays: 26,
        revenueTarget: 0,
        orderTarget: 0,
        leadsTarget: 0
    });
    
    const monthKey = format(month, 'yyyy-MM');
    const monthDisplay = format(month, 'MMMM yyyy', { locale: localeId });
    const canManageTargets = hasPermission('targets.manage');

    // Fetch Targets
    const fetchTargets = async () => {
        setIsLoading(true);
        try {
            const url = buildMakeServerUrl(`/targets/${monthKey}`);
            const headers = await getSessionBackedEdgeHeaders();
            const res = await fetch(url, { headers });
            if (res.ok) {
                const data = await res.json();
                // Ensure unique IDs for UI keying if missing and handle new fields
                const rawList = Array.isArray(data) ? data : (data.targets || []);
                const sanitized = rawList.map((t: any) => ({
                    ...t,
                    id: t.id || crypto.randomUUID(),
                    workingDays: t.workingDays || 26,
                    leadsTarget: t.leadsTarget || 0 // Default for migration
                }));
                setTargets(sanitized);
            }
        } catch (e) {
            console.error("Failed to fetch targets", e);
            toast.error("Gagal memuat data target");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTargets();
    }, [monthKey]);

    if (!canManageTargets) {
        return (
            <div className={cn("flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-500", className)}>
                Anda tidak memiliki izin untuk mengelola target monitoring.
            </div>
        );
    }

    const handleAddTarget = () => {
        if (!newTarget.serviceId) {
            toast.error("Silakan pilih Layanan");
            return;
        }

        const newItem: TargetItem = {
            id: crypto.randomUUID(),
            // branchId removed
            serviceId: newTarget.serviceId,
            month: monthKey,
            revenueTarget: Number(newTarget.revenueTarget) || 0,
            orderTarget: Number(newTarget.orderTarget) || 0,
            leadsTarget: Number(newTarget.leadsTarget) || 0,
            workingDays: Number(newTarget.workingDays) || 26
        };

        setTargets(prev => [...prev, newItem]);
        
        // Reset form partially
        setNewTarget({
            serviceId: "", 
            workingDays: 26,
            revenueTarget: 0,
            orderTarget: 0,
            leadsTarget: 0
        });
        
        toast.success("Target ditambahkan ke daftar");
        setIsAddDialogOpen(false);
    };

    const handleRemoveRow = (id: string) => {
        setTargets(targets.filter(t => t.id !== id));
    };

    const updateRow = (id: string, field: keyof TargetItem, value: any) => {
        setTargets(targets.map(t => t.id === id ? { ...t, [field]: value } : t));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const url = buildMakeServerUrl(`/targets/${monthKey}`);
            const headers = await getSessionBackedEdgeHeaders({ includeJsonContentType: true });
            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({ targets })
            });
            
            if (res.ok) {
                toast.success("Database Target berhasil disimpan");
                onUpdate();
                onClose();
            } else {
                throw new Error("Failed to save");
            }
        } catch (e) {
            console.error(e);
            toast.error("Gagal menyimpan target");
        } finally {
            setIsSaving(false);
        }
    };

    const totalRevenue = targets.reduce((acc, curr) => acc + (curr.revenueTarget || 0), 0);
    const totalOrders = targets.reduce((acc, curr) => acc + (curr.orderTarget || 0), 0);
    const totalLeads = targets.reduce((acc, curr) => acc + (curr.leadsTarget || 0), 0);

    return (
        <div className={cn("flex flex-col w-full max-w-6xl mx-auto bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700 h-[85vh]", className)}>
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg text-blue-600 dark:text-blue-400">
                        <Target className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Target Database: {monthDisplay}</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">Manajemen Target Operasional</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="text-right mr-4 hidden sm:block">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">Total Target</div>
                        <div className="font-bold text-sm text-blue-600 dark:text-blue-400">
                            Rp {totalRevenue.toLocaleString('id-ID')} <span className="text-slate-400 dark:text-slate-500">|</span> {totalLeads} Leads
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchTargets} disabled={isLoading}>
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onClose} className="ml-2">
                        <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-slate-300 dark:text-slate-600" />
                    </div>
                ) : (
                    <Table>
                        <TableHeader className="bg-white dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
                            <TableRow>
                                <TableHead className="w-[200px]">Layanan</TableHead>
                                <TableHead className="w-[100px]">Hari Kerja</TableHead>
                                <TableHead className="w-[120px]">Target Leads</TableHead>
                                <TableHead className="w-[180px]">Target Omset (Rp)</TableHead>
                                <TableHead className="w-[120px]">Target Order</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {targets.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-16">
                                        <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                                            <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-3">
                                                <Target className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                                            </div>
                                            <p className="font-medium">Database Target Kosong</p>
                                            <p className="text-xs mt-1 max-w-xs text-center">Belum ada data target untuk bulan ini.</p>
                                            <Button variant="outline" className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
                                                <Plus className="w-4 h-4 mr-2" /> Tambah Target Baru
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                targets.map((row) => (
                                    <TableRow key={row.id} className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30/30 transition-colors">
                                        <TableCell>
                                            <Select value={row.serviceId} onValueChange={v => updateRow(row.id, 'serviceId', v)}>
                                                <SelectTrigger className="h-9 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:bg-slate-900 transition-all">
                                                    <SelectValue placeholder="Pilih Layanan" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {services.map(s => (
                                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Input 
                                                type="number" 
                                                className="h-9 bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:bg-slate-900 transition-all text-center" 
                                                value={row.workingDays} 
                                                onChange={e => updateRow(row.id, 'workingDays', Number(e.target.value))}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input 
                                                type="number" 
                                                className="h-9 bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:bg-slate-900 font-medium text-blue-600 dark:text-blue-400 transition-all text-center border-blue-100 dark:border-blue-800" 
                                                value={row.leadsTarget || ''} 
                                                onChange={e => updateRow(row.id, 'leadsTarget', Number(e.target.value))}
                                                placeholder="0"
                                            />
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 text-center">
                                                Est: {Math.ceil((row.leadsTarget || 0) / (row.workingDays || 1))} / hari
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="relative group">
                                                <span className="absolute left-3 top-2.5 text-xs text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 transition-colors">Rp</span>
                                                <Input 
                                                    type="number" 
                                                    className="h-9 pl-8 bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:bg-slate-900 font-medium text-slate-900 dark:text-slate-100 transition-all border-slate-200 dark:border-slate-700 focus:border-blue-400 dark:border-blue-600 focus:ring-2 focus:ring-blue-100" 
                                                    value={row.revenueTarget || ''} 
                                                    onChange={e => updateRow(row.id, 'revenueTarget', Number(e.target.value))}
                                                />
                                            </div>
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 pl-1">
                                                Est: {formatDaily(row.revenueTarget, row.workingDays)} / hari
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Input 
                                                type="number" 
                                                className="h-9 bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:bg-slate-900 font-medium text-slate-900 dark:text-slate-100 transition-all text-center" 
                                                value={row.orderTarget || ''} 
                                                onChange={e => updateRow(row.id, 'orderTarget', Number(e.target.value))}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveRow(row.id)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex justify-between items-center gap-4">
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="border-dashed border-slate-300 text-slate-600 dark:text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:text-blue-400 hover:border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                            <Plus className="w-4 h-4 mr-2" /> Tambah Target
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Tambah Target Baru</DialogTitle>
                            <DialogDescription>
                                Input target operasional untuk Layanan.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            {/* Read Only Month Display */}
                            <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-md border border-slate-100 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-400 dark:text-slate-500">
                                <Calendar className="w-4 h-4 text-blue-500" />
                                <span>Periode Target: <strong>{monthDisplay}</strong></span>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="service">Layanan</Label>
                                <Select 
                                    value={newTarget.serviceId} 
                                    onValueChange={(v) => setNewTarget({...newTarget, serviceId: v})}
                                >
                                    <SelectTrigger id="service">
                                        <SelectValue placeholder="Pilih Layanan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {services.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="grid gap-2">
                                <Label htmlFor="leads" className="text-blue-600 dark:text-blue-400">Target Leads (Masuk)</Label>
                                <Input 
                                    id="leads" 
                                    type="number" 
                                    placeholder="0"
                                    className="font-bold text-blue-600 dark:text-blue-400 border-blue-200 bg-blue-50/50 dark:bg-blue-900/20"
                                    value={newTarget.leadsTarget || ''}
                                    onChange={(e) => setNewTarget({...newTarget, leadsTarget: Number(e.target.value)})}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="revenue">Target Omset (Rp)</Label>
                                    <Input 
                                        id="revenue" 
                                        type="number" 
                                        placeholder="0"
                                        value={newTarget.revenueTarget || ''}
                                        onChange={(e) => setNewTarget({...newTarget, revenueTarget: Number(e.target.value)})}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="order">Target Order (Closing)</Label>
                                    <Input 
                                        id="order" 
                                        type="number" 
                                        placeholder="0"
                                        value={newTarget.orderTarget || ''}
                                        onChange={(e) => setNewTarget({...newTarget, orderTarget: Number(e.target.value)})}
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="days">Hari Kerja Efektif</Label>
                                <Input 
                                    id="days" 
                                    type="number" 
                                    value={newTarget.workingDays}
                                    onChange={(e) => setNewTarget({...newTarget, workingDays: Number(e.target.value)})}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Batal</Button>
                            <Button onClick={handleAddTarget} className="bg-blue-600 text-white hover:bg-blue-700">Simpan Target</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <div className="flex gap-2">
                    <Button variant="ghost" onClick={onClose} className="text-slate-500 dark:text-slate-400 dark:text-slate-500">Tutup</Button>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px] shadow-lg shadow-blue-200">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Simpan Database
                    </Button>
                </div>
            </div>
        </div>
    );
}

function formatDaily(total: number, days: number) {
    if (!total || !days) return '0';
    return Math.ceil(total / days).toLocaleString('id-ID');
}
