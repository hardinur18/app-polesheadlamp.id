import React, { useState, useMemo } from 'react';
import { useMasterData } from '@/app/pages/master-data/context';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, isWeekend } from 'date-fns';
import { id } from 'date-fns/locale';
import { Card, CardContent } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Ban, CheckCircle2, User as UserIcon } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { TechnicianSchedule } from '@/app/pages/master-data/context/MasterDataCtx';

import { Textarea } from '../../components/ui/textarea';
import { usePermissions } from '@/app/hooks/usePermissions';
import { Lock } from 'lucide-react';
import { isTechnicianRole } from '@/app/data/roleHelpers';

export default function TechnicianSchedulePage() {
  const { users, branches, activeBranches, technicianSchedules, addSchedule, deleteSchedule } = useMasterData();
  const { hasPermission } = usePermissions();
  const canViewSchedule = hasPermission('technician_schedule.view');
  const canManageSchedule = hasPermission('technician_schedule.manage');
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ userId: string, date: Date, schedule?: TechnicianSchedule } | null>(null);
  const [reason, setReason] = useState('');
  const [leaveType, setLeaveType] = useState<'Libur' | 'Sakit' | 'Cuti' | 'Izin'>('Libur');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derived Data
  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate)
    });
  }, [currentDate]);

  const technicians = useMemo(() => {
    // Only Active Technicians
    let filtered = users.filter(u => isTechnicianRole(u.role) && u.status === 'active');
    
    if (selectedBranch !== 'all') {
      filtered = filtered.filter(u => u.branchId === selectedBranch);
    }
    return filtered;
  }, [users, selectedBranch]);

  const getSchedule = (userId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return technicianSchedules.find(s => s.userId === userId && s.date === dateStr);
  };

  const handleCellClick = (userId: string, date: Date) => {
    if (!canManageSchedule) return;

    const schedule = getSchedule(userId, date);
    setSelectedCell({ userId, date, schedule });
    setReason(schedule?.reason || '');
    setLeaveType(schedule?.type || 'Libur');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!canManageSchedule) return;
    if (!selectedCell) return;
    
    setIsSubmitting(true);
    const dateStr = format(selectedCell.date, 'yyyy-MM-dd');

    if (selectedCell.schedule) {
        // Delete existing (Toggle Off -> On)
        await deleteSchedule(selectedCell.userId, dateStr);
    } else {
        // Add new (Toggle On -> Off)
        await addSchedule({
            id: crypto.randomUUID(),
            userId: selectedCell.userId,
            date: dateStr,
            type: leaveType,
            reason: reason || leaveType, // Default to type if no reason
            createdAt: new Date().toISOString()
        });
    }
    
    setIsSubmitting(false);
    setIsDialogOpen(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  if (!canViewSchedule) {
    return (
      <div className="flex h-[80vh] items-center justify-center flex-col gap-4 text-center p-8">
        <div className="bg-red-50 p-4 rounded-full text-red-600"><Lock className="w-12 h-12" /></div>
        <h1 className="text-2xl font-bold">Akses Dibatasi</h1>
        <p className="text-slate-500">Anda tidak memiliki izin untuk membuka ketersediaan teknisi.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 w-full max-w-[1600px] mx-auto min-h-screen bg-slate-50/50 dark:bg-slate-950">
      <div className="flex flex-col space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CalendarIcon className="w-6 h-6 text-blue-600" />
              Jadwal Ketersediaan Teknisi
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
              Kelola hari libur dan ketersediaan teknisi per cabang.
            </p>
            {!canManageSchedule && (
              <p className="text-xs text-amber-600 mt-2">Mode lihat saja. Perubahan jadwal dikunci.</p>
            )}
          </div>
          
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
             <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                <ChevronLeft className="w-4 h-4" />
             </Button>
             <span className="font-semibold w-32 text-center text-sm">
                {format(currentDate, 'MMMM yyyy', { locale: id })}
             </span>
             <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                <ChevronRight className="w-4 h-4" />
             </Button>
          </div>
        </div>

        {/* Toolbar & Legend */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 items-center bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-4 w-full sm:w-auto">
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Pilih Cabang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Cabang</SelectItem>
                    {activeBranches.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
            
            <div className="flex items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-white border border-slate-200"></div>
                    <span>Masuk</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-red-100 border border-red-200"></div>
                    <span>Libur (Off)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-slate-100 border border-slate-200"></div>
                    <span>Akhir Pekan</span>
                </div>
            </div>
        </div>

        {/* Scheduler Grid */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-700 p-4 min-w-[200px] text-left text-xs font-semibold uppercase text-slate-500 tracking-wider">
                                Teknisi
                            </th>
                            {daysInMonth.map(day => (
                                <th key={day.toString()} className={`min-w-[40px] border-b border-r border-slate-100 dark:border-slate-700 p-2 text-center text-xs ${isSameDay(day, new Date()) ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 font-bold' : ''}`}>
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="opacity-50 text-[10px]">{format(day, 'EEE', { locale: id })}</span>
                                        <span>{format(day, 'd')}</span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {technicians.length === 0 ? (
                            <tr>
                                <td colSpan={daysInMonth.length + 1} className="p-8 text-center text-slate-500 text-sm">
                                    Tidak ada teknisi ditemukan untuk cabang ini.
                                </td>
                            </tr>
                        ) : (
                            technicians.map(tech => (
                                <tr key={tech.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="sticky left-0 z-10 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 p-3">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8 border border-slate-200">
                                                <AvatarImage src={tech.avatar || ''} />
                                                <AvatarFallback className="bg-slate-100 text-xs">{getInitials(tech.name)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate w-32">{tech.name}</span>
                                                <span className="text-[10px] text-slate-500 truncate w-32">
                                                    {branches.find(b => b.id === tech.branchId)?.name || 'Pusat'}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    {daysInMonth.map(day => {
                                        const schedule = getSchedule(tech.id, day);
                                        const isOff = !!schedule;
                                        const isWknd = isWeekend(day);
                                        
                                        return (
                                            <td 
                                                key={day.toString()} 
                                                className={`border-b border-r border-slate-100 dark:border-slate-700 p-1 h-16 relative transition-all ${canManageSchedule ? 'cursor-pointer' : 'cursor-default'}
                                                    ${isOff ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30' : 'hover:bg-blue-50 dark:hover:bg-blue-900/10'}
                                                    ${!isOff && isWknd ? 'bg-slate-50/50 dark:bg-slate-900/30' : ''}
                                                `}
                                                onClick={() => handleCellClick(tech.id, day)}
                                            >
                                                {isOff && (
                                                    <div className="w-full h-full flex flex-col items-center justify-center p-1 animate-in fade-in zoom-in duration-200">
                                                        <div className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800 w-full text-center truncate">
                                                            {schedule.type || 'OFF'}
                                                        </div>
                                                        {schedule.reason && (
                                                            <span className="text-[8px] text-red-500 mt-0.5 max-w-full truncate px-1">
                                                                {schedule.reason}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>

      {/* Action Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>
                    {selectedCell?.schedule ? 'Batalkan Hari Libur?' : 'Set Jadwal Libur'}
                </DialogTitle>
                <DialogDescription>
                    {selectedCell && (
                        <span>
                            Teknisi: <b>{users.find(u => u.id === selectedCell.userId)?.name}</b><br/>
                            Tanggal: {format(selectedCell.date, 'EEEE, d MMMM yyyy', { locale: id })}
                        </span>
                    )}
                </DialogDescription>
            </DialogHeader>
            
            {!selectedCell?.schedule && (
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Tipe Absen</Label>
                        <Select value={leaveType} onValueChange={(val: any) => setLeaveType(val)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih Tipe" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Libur">Libur</SelectItem>
                                <SelectItem value="Sakit">Sakit</SelectItem>
                                <SelectItem value="Cuti">Cuti</SelectItem>
                                <SelectItem value="Izin">Izin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    
                    <div className="space-y-2">
                        <Label>Alasan / Keterangan</Label>
                        <Textarea 
                            placeholder="Contoh: Acara keluarga, sakit demam, dll..." 
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                        />
                    </div>
                </div>
            )}

            {selectedCell?.schedule && (
                 <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-md border text-sm text-slate-600 dark:text-slate-300">
                    Status saat ini: <span className="font-semibold text-red-600">{selectedCell.schedule.type.toUpperCase()}</span>
                    <br/>
                    Keterangan: {selectedCell.schedule.reason || '-'}
                 </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                <Button 
                    variant={selectedCell?.schedule ? "destructive" : "default"}
                    onClick={handleSave}
                    disabled={isSubmitting || !canManageSchedule}
                >
                    {isSubmitting ? 'Menyimpan...' : (selectedCell?.schedule ? 'Hapus Status Libur' : 'Simpan Jadwal Libur')}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
