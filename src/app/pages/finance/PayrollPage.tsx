import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, Users, Briefcase, Plus, Save, Trash2, Edit, 
  Search, Calculator, ArrowRight, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/app/components/ui/table';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter
} from "@/app/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/app/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { Label } from '@/app/components/ui/label';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { useMasterData } from '@/app/pages/master-data/context';
import { cn } from '@/app/components/ui/utils';
import { usePermissions } from '@/app/hooks/usePermissions';
import { logActivity } from '@/app/services/auditService';
import { getSessionBackedEdgeHeaders } from '@/app/services/internal/sessionClientHeaders';
import { buildMakeServerUrl } from '@/app/services/internal/functionsBaseUrl';
import { isAnyRole, normalizeRole } from '@/app/data/roleHelpers';

// --- Types ---
export interface SalaryProfile {
  id?: string;
  user_id: string;
  basic_salary: number;
  allowance_fixed: number; // Tunjangan (General)
  tool_allowance: number; // Tunjangan Alat Pribadi
  quota: number; // Kuota
  deductions: number; // Potongan (Kasbon/Lainnya)
  created_at?: string;
}

const createEmptySalaryProfile = (userId: string): SalaryProfile => ({
  user_id: userId,
  basic_salary: 0,
  allowance_fixed: 0,
  tool_allowance: 0,
  quota: 0,
  deductions: 0,
});

export interface KPI {
  id: string;
  name: string;
  type: 'fixed' | 'per_order' | 'percentage_omzet' | 'per_action';
  amount: number;
  target_field?: string;
  description?: string;
  created_at?: string;
}

export interface KPIConfig {
  periodType: 'calendar' | 'cutoff';
  dateReference: 'service_date' | 'lead_date' | 'closing_date';
  platforms: string;
  targetRoles: string;
  specificUserId?: string; // Target specific user ID (e.g. specific Advertiser)
  units: string;
  
  // Tiered calculation
  isTiered?: boolean;
  threshold?: number;
  aboveThresholdAmount?: number;
}

export interface EmployeeKPI {
  id?: string;
  user_id: string;
  kpi_id: string;
}

interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  due_date: number;
  status: 'active' | 'inactive';
  last_payment_date?: string | null;
}

interface TechnicianDailyReport {
  id: string;
  technician_role: string;
  saving_amount: number;
  service_date: string;
}

const ROLE_PRIORITY: Record<string, number> = {
  'Owner': 1,
  'Super Admin': 2,
  'Admin PIC': 3,
  'Finance': 4,
  'Advertiser': 5,
  'CS': 6,
  'Teknisi': 7,
};

const ROLE_STYLES: Record<string, string> = {
  'Owner': 'bg-purple-50 text-purple-700 border-purple-200',
  'Super Admin': 'bg-blue-50 text-blue-700 border-blue-200',
  'Admin PIC': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Finance': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Advertiser': 'bg-orange-50 text-orange-700 border-orange-200',
  'CS': 'bg-pink-50 text-pink-700 border-pink-200',
  'Teknisi': 'bg-slate-50 text-slate-700 border-slate-200',
};

// --- Helper Component ---
const CurrencyInput = ({ 
    value, 
    onChange, 
    placeholder = "0", 
    disabled = false, 
    className 
}: { 
    value: number; 
    onChange: (val: number) => void; 
    placeholder?: string; 
    disabled?: boolean; 
    className?: string; 
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Remove non-digits
        const rawValue = e.target.value.replace(/\D/g, '');
        const numericValue = rawValue ? parseInt(rawValue, 10) : 0;
        onChange(numericValue);
    };

    return (
        <Input
            type="text"
            value={value ? value.toLocaleString('id-ID') : ''}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={disabled}
            className={className}
        />
    );
};

// --- Component ---
export const PayrollPage = () => {
  const { users, refreshTrigger, platforms, roles, activeBranches, orders, currentUser } = useMasterData();
  const { hasPermission } = usePermissions();
  const canViewPayroll = hasPermission('payroll.view');
  const [activeTab, setActiveTab] = useState('salary');
  const [loading, setLoading] = useState(false);
  
  // Data States
  const [salaryProfiles, setSalaryProfiles] = useState<SalaryProfile[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [assignments, setAssignments] = useState<EmployeeKPI[]>([]);
  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  const [technicianReports, setTechnicianReports] = useState<TechnicianDailyReport[]>([]);
  const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);

  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [isKpiModalOpen, setIsKpiModalOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<KPI | null>(null);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [selectedUserForSalary, setSelectedUserForSalary] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<any | null>(null);
  
  // Bulk Edit States
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // --- Initial Fetch ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = await getSessionBackedEdgeHeaders();
      const response = await fetch(buildMakeServerUrl('/payroll/data'), {
          headers
      });
      
      if (!response.ok) throw new Error('Failed to fetch payroll data');
      
      const resData = await response.json();
      
      setSalaryProfiles(resData.salaryData || []);
      
      // Keep KPIs sorted newest first
      const sortedKpis = (resData.kpiData || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setKpis(sortedKpis);
      
      setAssignments(resData.assignData || []);
      
      // Filter active expenses
      const activeExpenses = (resData.expenseData || []).filter((e: any) => e.status === 'active');
      setExpenses(activeExpenses);
      
      setTechnicianReports(resData.reportData || []);
      setAllowedUserIds(resData.allowedUserIds || []);

    } catch (err: any) {
      console.error("Error fetching payroll data:", err);
      // Fallback if needed or let UI handle empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canViewPayroll) {
      fetchData();
    }
  }, [refreshTrigger, canViewPayroll]);

  // --- Handlers: Bulk Edit ---
  const toggleSelectUser = (id: string) => {
    const newSet = new Set(selectedUserIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedUserIds(newSet);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
        // Select all visible users
        const newSet = new Set(combinedUserData.map(u => u.id));
        setSelectedUserIds(newSet);
    } else {
        setSelectedUserIds(new Set());
    }
  };

  const handleBulkSave = async (updates: any) => {
    try {
        setLoading(true);
        const usersToUpdate = Array.from(selectedUserIds);
        
        // 1. Prepare salary profile updates if any fields are active
        if (updates.updateSalary) {
            const { basic, allowance, tool, quota, deduction, fieldsToUpdate } = updates.salary;
            
            // Fetch current profiles to merge updates properly
            // We can reuse `salaryProfiles` state since it's up to date
            const profilesToUpsert = usersToUpdate.map(userId => {
                const current = salaryProfiles.find(p => p.user_id === userId) || createEmptySalaryProfile(userId);

                return {
                    id: current.id || undefined, // undefined will let upsert generate ID if needed (or handle based on conflict on user_id)
                    user_id: userId,
                    basic_salary: fieldsToUpdate.basic ? basic : current.basic_salary,
                    allowance_fixed: fieldsToUpdate.allowance ? allowance : current.allowance_fixed,
                    tool_allowance: fieldsToUpdate.tool ? tool : current.tool_allowance,
                    quota: fieldsToUpdate.quota ? quota : current.quota,
                    deductions: fieldsToUpdate.deduction ? deduction : current.deductions,
                    updated_at: new Date().toISOString()
                };
            });

            // Upsert in batches or loop
            const { error } = await supabase.from('salary_profiles').upsert(profilesToUpsert, { onConflict: 'user_id' });
            if (error) throw error;
        }

        // 2. Update KPI assignments if active
        if (updates.updateKpi) {
            const { selectedKpis, mode } = updates.kpi; // mode: 'replace' | 'append'
            
            if (mode === 'replace') {
                // Delete existing assignments for selected users
                const { error: delError } = await supabase
                    .from('employee_kpi_assignments')
                    .delete()
                    .in('user_id', usersToUpdate);
                if (delError) throw delError;

                // Insert new ones
                if (selectedKpis.length > 0) {
                    const newAssignments = usersToUpdate.flatMap(uid => 
                        selectedKpis.map((kid: string) => ({ user_id: uid, kpi_id: kid }))
                    );
                    const { error: insError } = await supabase.from('employee_kpi_assignments').insert(newAssignments);
                    if (insError) throw insError;
                }
            } else if (mode === 'append') {
                // Append only new ones (avoid duplicates handled by unique constraint or just insert ignore)
                // Supabase insert with ignoreDuplicates: true
                 if (selectedKpis.length > 0) {
                    const newAssignments = usersToUpdate.flatMap(uid => 
                        selectedKpis.map((kid: string) => ({ user_id: uid, kpi_id: kid }))
                    );
                    const { error: insError } = await supabase.from('employee_kpi_assignments').insert(newAssignments).select();
                    // Note: unique constraint violation might throw error unless we handle it. 
                    // Better to just delete and re-insert for simplicity or rely on UI warning.
                    // For now, let's just try insert and catch error if duplicate? 
                    // Or actually, 'upsert' on assignments table with ignore duplicates isn't straightforward without ID.
                    // Let's stick to 'replace' mode for simplicity in UI for now, or use 'upsert' with onConflict.
                    // But kpi assignment has (user_id, kpi_id) unique constraint.
                    const { error: upsertError } = await supabase.from('employee_kpi_assignments').upsert(newAssignments, { onConflict: 'user_id, kpi_id', ignoreDuplicates: true });
                    if (upsertError) throw upsertError;
                }
            }
        }

        toast.success(`Berhasil memperbarui ${usersToUpdate.length} karyawan`);
        setSelectedUserIds(new Set()); // Reset selection
        setIsBulkModalOpen(false);
        fetchData();

    } catch (err: any) {
        toast.error("Gagal update massal: " + err.message);
    } finally {
        setLoading(false);
    }
  };

  // --- Handlers: Salary Profile ---
  const handleSaveSalary = async (userId: string, basic: number, allowance: number, toolAllowance: number, quota: number, deductions: number, selectedKpis: string[]) => {
    try {
      setLoading(true);
      
      // 1. Upsert Salary Profile
      const existingProfile = salaryProfiles.find(p => p.user_id === userId);
      const payload = {
        user_id: userId,
        basic_salary: basic,
        allowance_fixed: allowance,
        tool_allowance: toolAllowance,
        quota: quota,
        deductions: deductions
      };

      const { data: profileData, error: profileError } = await supabase
        .from('salary_profiles')
        .upsert(
            existingProfile ? { ...payload, id: existingProfile.id } : payload,
            { onConflict: 'user_id' }
        )
        .select()
        .single();

      if (profileError) throw profileError;

      // 2. Update KPI Assignments (Delete all for user -> Insert new)
      const { error: deleteError } = await supabase
        .from('employee_kpi_assignments')
        .delete()
        .eq('user_id', userId);
        
      if (deleteError) throw deleteError;

      if (selectedKpis.length > 0) {
        const kpiPayloads = selectedKpis.map(kpiId => ({
          user_id: userId,
          kpi_id: kpiId
        }));
        
        const { error: insertError } = await supabase
          .from('employee_kpi_assignments')
          .insert(kpiPayloads);
          
        if (insertError) throw insertError;
      }

      toast.success("Data gaji berhasil disimpan");
      if (currentUser) {
        const targetUser = users.find(u => u.id === userId);
        logActivity(
          { id: currentUser.id, name: currentUser.name, role: currentUser.role },
          'UPDATE',
          'Payroll',
          `Memperbarui data gaji: ${targetUser?.name || userId}`,
          userId,
          { basic, allowance }
        );
      }
      fetchData(); // Refresh all
      setIsSalaryModalOpen(false);

    } catch (err: any) {
      toast.error("Gagal menyimpan gaji: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers: KPI ---
  const handleSaveKpi = async (kpi: Partial<KPI>) => {
    try {
      const { error } = await supabase
        .from('kpi_library')
        .upsert(kpi)
        .select();

      if (error) throw error;
      
      toast.success("KPI berhasil disimpan");
      if (currentUser) {
        logActivity(
          { id: currentUser.id, name: currentUser.name, role: currentUser.role },
          kpi.id ? 'UPDATE' : 'CREATE',
          'KPI',
          `${kpi.id ? 'Memperbarui' : 'Menambahkan'} KPI: ${kpi.name || ''}`,
          kpi.id || ''
        );
      }
      fetchData();
      setIsKpiModalOpen(false);
    } catch (err: any) {
      toast.error("Gagal menyimpan KPI: " + err.message);
    }
  };

  const handleDeleteKpi = async (id: string) => {
    try {
        const kpiToDelete = kpis.find(k => k.id === id);
        const { error } = await supabase.from('kpi_library').delete().eq('id', id);
        if (error) throw error;
        toast.success("KPI dihapus");
        if (currentUser && kpiToDelete) {
          logActivity(
            { id: currentUser.id, name: currentUser.name, role: currentUser.role },
            'DELETE',
            'KPI',
            `Menghapus KPI: ${kpiToDelete.name}`,
            id
          );
        }
        setKpis(prev => prev.filter(k => k.id !== id));
    } catch (err: any) {
        toast.error("Gagal hapus: " + err.message);
    }
  }

  // --- Derived Data for UI ---
  const combinedUserData = useMemo(() => {
    return users
        .filter(u => u.status === 'active' && allowedUserIds.includes(u.id)) // Hanya user aktif dan yang diizinkan
        .map(user => {
            const profile = salaryProfiles.find(p => p.user_id === user.id);
            const userAssignments = assignments.filter(a => a.user_id === user.id);
            const activeKpis = userAssignments.map(a => kpis.find(k => k.id === a.kpi_id)).filter(Boolean) as KPI[];
            
            return {
                ...user,
                salaryProfile: profile,
                activeKpis
            };
        })
        .filter(u => 
            u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            u.role.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
            // Sort by Role Priority
            const priorityA = ROLE_PRIORITY[normalizeRole(a.role) || a.role] || 99;
            const priorityB = ROLE_PRIORITY[normalizeRole(b.role) || b.role] || 99;
            return priorityA - priorityB;
        });
  }, [users, salaryProfiles, assignments, kpis, searchQuery, allowedUserIds]);

    // State for Calculator
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
    
    // --- Period Calculation (Global for this component) ---
    const dateObj = new Date(selectedMonth + "-01");
    const y = dateObj.getFullYear();
    const m = dateObj.getMonth(); // 0-based
    
    const cutoffStartCalc = new Date(y, m - 1, 28);
    const cutoffEndCalc = new Date(y, m, 27, 23, 59, 59);
    
    const calendarStart = new Date(y, m, 1);
    const calendarEnd = new Date(y, m + 1, 0, 23, 59, 59);

    const periodString = useMemo(() => {
        try {
            const startMonth = new Date(y, m-1, 1).toLocaleString('id-ID', { month: 'short' });
            const endMonth = new Date(y, m, 1).toLocaleString('id-ID', { month: 'short' });
            return `28 ${startMonth} - 27 ${endMonth} ${y}`;
        } catch (e) {
            return `${y}-${m}`;
        }
    }, [y, m]);

    // --- Additional Stats Calculation ---
    const totalFreelanceSavings = useMemo(() => {
        return technicianReports
            .filter(r => {
                // Role check (Freelance only)
                if (r.technician_role !== 'Freelance') return false;
                
                // Date check (Cutoff Period)
                const sDate = new Date(r.service_date);
                return sDate >= cutoffStartCalc && sDate <= cutoffEndCalc;
            })
            .reduce((sum, r) => sum + (r.saving_amount || 0), 0);
    }, [technicianReports, cutoffStartCalc, cutoffEndCalc]);

    const totalUnpaidExpenses = useMemo(() => {
        // Current selected month context
        const targetYear = dateObj.getFullYear();
        const targetMonth = dateObj.getMonth(); // 0-11
        
        return expenses
            .filter(e => {
                // 1. Must be active
                if (e.status !== 'active') return false;

                // 2. Check if paid in the TARGET month
                // If last_payment_date is in target month/year, it's paid.
                if (e.last_payment_date) {
                    const lastPay = new Date(e.last_payment_date);
                    if (lastPay.getFullYear() === targetYear && lastPay.getMonth() === targetMonth) {
                        return false; // Already paid
                    }
                }
                
                // 3. Check due date (Only count those due by 28th)
                return e.due_date <= 28;
            })
            .reduce((sum, e) => sum + (e.amount || 0), 0);
    }, [expenses, dateObj]);

    if (!canViewPayroll) {
      return (
        <div className="flex h-[80vh] items-center justify-center flex-col gap-4 text-center p-8">
          <div className="bg-red-50 p-4 rounded-full text-red-600"><AlertCircle className="w-12 h-12" /></div>
          <h1 className="text-2xl font-bold">Akses Dibatasi</h1>
          <p className="text-slate-500">Anda tidak memiliki izin untuk membuka halaman payroll.</p>
        </div>
      );
    }

    // --- Helper: Bonus Calculation ---
    const calculateBonus = (user: any) => {
        let totalBonus = 0;
        const uniqueOrderIds = new Set<string>();
        const relevantOrderList: any[] = [];
        let totalUnits = 0;
        
        if (!user.activeKpis || user.activeKpis.length === 0) return { bonus: 0, orders: 0, units: 0, relevantOrders: [] };

        user.activeKpis.forEach((kpi: KPI) => {
            let kpiBonus = 0;
            let config: KPIConfig = {
                periodType: 'cutoff',
                dateReference: 'service_date',
                platforms: '',
                targetRoles: '',
                units: '',
                isTiered: false,
                threshold: 0,
                aboveThresholdAmount: 0
            };

            try {
                if (kpi.target_field && kpi.target_field.startsWith('{')) {
                    config = { ...config, ...JSON.parse(kpi.target_field) };
                }
            } catch (e) {}

            // 1. Filter Orders
            const currentKpiOrders = orders.filter(o => {
                // User check
                const isAssigned = (o.csId === user.id) || (o.technicianId === user.id) || (o.advertiserId === user.id);
                
                // Management roles have global scope (count all orders subject to branch/platform filters)
                // Operational roles (Teknisi, CS, Advertiser) only count assigned orders
                const isManagement = isAnyRole(user.role, ['Owner', 'Super Admin', 'Admin PIC', 'Finance']);

                if (!isAssigned && !isManagement) return false;

                // Status Check: must be 'done' (Selesai) or 'teknisi_completed'
                const status = (o.status || '').toLowerCase();
                const allowedStatuses = ['done', 'selesai', 'teknisi_completed', 'waiting qc']; // Include waiting qc to match operational report
                if (!allowedStatuses.includes(status)) return false;

                // Date Check
                let refDateStr = '';
                if (config.dateReference === 'service_date') refDateStr = o.serviceDate;
                else if (config.dateReference === 'lead_date') refDateStr = o.leadDate || '';
                else if (config.dateReference === 'closing_date') refDateStr = o.finishedAt || o.serviceDate || ''; // Fallback
                
                if (!refDateStr) return false;
                const refDate = new Date(refDateStr);

                // Period Check
                if (config.periodType === 'calendar') {
                    if (refDate < calendarStart || refDate > calendarEnd) return false;
                } else {
                    if (refDate < cutoffStartCalc || refDate > cutoffEndCalc) return false;
                }

                // Platform Filter
                if (config.platforms && config.platforms !== 'all') {
                    const pName = platforms.find(p => p.id === o.platformId)?.name;
                    if (pName !== config.platforms) return false;
                }

                // Unit Filter
                if (config.units && config.units !== 'all') {
                    const bName = activeBranches.find(b => b.id === o.branchId)?.name;
                    if (bName !== config.units) return false;
                }
                
                // Role Filter (Source Filter - Check if order was handled by specific role/user)
                if (config.targetRoles && config.targetRoles !== 'all') {
                    const roleName = normalizeRole(config.targetRoles);
                    let relevantUserId = '';
                    
                    if (roleName === 'Advertiser') relevantUserId = o.advertiserId;
                    else if (roleName === 'CS') relevantUserId = o.csId;
                    else if (roleName === 'Teknisi') relevantUserId = o.technicianId;
                    
                    // If filtering by Operational Role (Adv, CS, Tech), check order fields
                    if (relevantUserId !== '') {
                        // 1. Must have a user in that role slot
                        if (!relevantUserId) return false; 
                        
                        // 2. If specific user selected, must match
                        if (config.specificUserId && relevantUserId !== config.specificUserId) return false;
                    } 
                }

                return true;
            });

            // Add relevant orders to unique set for counting
            currentKpiOrders.forEach(o => {
                if (!uniqueOrderIds.has(o.id)) {
                    uniqueOrderIds.add(o.id);
                    totalUnits += (o.units || 1);
                    relevantOrderList.push(o);
                }
            });

            // 2. Calculate
            if (kpi.type === 'fixed') {
                kpiBonus = kpi.amount;
            } else if (kpi.type === 'per_order') {
                // Count UNITS, not orders
                const totalUnitsForKpi = currentKpiOrders.reduce((sum, ord) => sum + (ord.units || 1), 0);
                
                if (config.isTiered && config.threshold) {
                    if (totalUnitsForKpi <= config.threshold) {
                        kpiBonus = totalUnitsForKpi * kpi.amount;
                    } else {
                        const baseBonus = config.threshold * kpi.amount;
                        const extraUnits = totalUnitsForKpi - config.threshold;
                        const extraBonus = extraUnits * (config.aboveThresholdAmount || 0);
                        kpiBonus = baseBonus + extraBonus;
                    }
                } else {
                    kpiBonus = totalUnitsForKpi * kpi.amount;
                }
            } else if (kpi.type === 'percentage_omzet') {
                const totalOmzet = currentKpiOrders.reduce((sum, ord) => sum + (ord.price || 0), 0);
                kpiBonus = totalOmzet * (kpi.amount / 100);
            }

            totalBonus += kpiBonus;
        });

        // Sort orders by date descending
        relevantOrderList.sort((a, b) => new Date(b.serviceDate || '').getTime() - new Date(a.serviceDate || '').getTime());

        return { bonus: totalBonus, orders: uniqueOrderIds.size, units: totalUnits, relevantOrders: relevantOrderList };
    };

  // --- Components ---

    // --- Components ---

    const OrderDetailModal = () => {
        if (!detailUser) return null;
        
        // calculateBonus returns relevantOrders, but we need to call it
        const { bonus, relevantOrders } = calculateBonus(detailUser);
        
        // Deduplicate orders
        // Use Map to ensure uniqueness by ID
        const uniqueOrders = Array.from(new Map(relevantOrders.map((o: any) => [o.id, o])).values());

        return (
            <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
                <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-slate-900 border-slate-700 text-slate-100">
                    <DialogHeader className="p-6 pb-2 border-b border-slate-800 bg-slate-900 z-10">
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <div className="p-2 bg-orange-900/30 text-orange-400 rounded-lg">
                                <Briefcase className="w-5 h-5" />
                            </div>
                            <div>
                                <div>Detail Order: {detailUser.name}</div>
                                <div className="text-xs font-normal text-slate-400 mt-1">Periode: {periodString}</div>
                            </div>
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-y-auto p-0">
                        <Table>
                            <TableHeader className="bg-slate-900/90 backdrop-blur sticky top-0 z-10">
                                <TableRow className="border-slate-800 hover:bg-transparent">
                                    <TableHead className="w-[50px] text-slate-400 pl-6">No</TableHead>
                                    <TableHead className="text-slate-400">Tgl Service</TableHead>
                                    <TableHead className="text-slate-400">Customer</TableHead>
                                    <TableHead className="text-slate-400">Platform</TableHead>
                                    <TableHead className="text-center text-slate-400">Unit</TableHead>
                                    <TableHead className="text-right text-slate-400 pr-6">Omzet</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {uniqueOrders.length === 0 ? (
                                    <TableRow className="border-slate-800">
                                        <TableCell colSpan={6} className="text-center h-32 text-slate-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <AlertCircle className="w-8 h-8 opacity-20" />
                                                <span>Tidak ada order yang memenuhi kriteria KPI pada periode ini.</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    uniqueOrders.map((order: any, idx: number) => (
                                        <TableRow key={order.id} className="border-slate-800 hover:bg-slate-800/50 transition-colors">
                                            <TableCell className="text-slate-500 pl-6">{idx + 1}</TableCell>
                                            <TableCell className="font-mono text-slate-300">
                                                {order.serviceDate ? new Date(order.serviceDate).toLocaleDateString('id-ID', {
                                                    day: 'numeric', month: 'short', year: 'numeric'
                                                }) : '-'}
                                            </TableCell>
                                            <TableCell className="font-medium text-slate-200">
                                                <div className="flex flex-col">
                                                    <span>{order.customerName}</span>
                                                    <span className="text-[10px] text-slate-500">{order.customerPhone}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="bg-slate-800 border-slate-700 text-slate-400 font-normal text-xs">
                                                    {platforms.find(p => p.id === order.platformId)?.name || 'Unknown'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-slate-300 font-bold">
                                                {order.units || 1}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-emerald-400 pr-6">
                                                Rp {(order.price || 0).toLocaleString('id-ID')}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    
                    <DialogFooter className="p-4 border-t border-slate-800 bg-slate-900">
                        <div className="flex items-center justify-between w-full">
                            <div className="text-sm text-slate-400">
                                Total Bonus Est: <span className="font-bold text-orange-400 text-lg ml-2">Rp {bonus.toLocaleString('id-ID')}</span>
                            </div>
                            <Button variant="secondary" onClick={() => setIsDetailModalOpen(false)}>Tutup</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    const BulkEditModal = () => {
    // Local states for bulk form
    const [updateBasic, setUpdateBasic] = useState(false);
    const [basic, setBasic] = useState(0);

    const [updateAllowance, setUpdateAllowance] = useState(false);
    const [allowance, setAllowance] = useState(0);

    const [updateTool, setUpdateTool] = useState(false);
    const [tool, setTool] = useState(0);

    const [updateQuota, setUpdateQuota] = useState(false);
    const [quota, setQuota] = useState(0);

    const [updateDeduction, setUpdateDeduction] = useState(false);
    const [deduction, setDeduction] = useState(0);

    // KPI
    const [updateKpi, setUpdateKpi] = useState(false);
    const [kpiMode, setKpiMode] = useState<'replace' | 'append'>('replace');
    const [selectedKpis, setSelectedKpis] = useState<Set<string>>(new Set());

    const toggleKpi = (id: string) => {
        const newSet = new Set(selectedKpis);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedKpis(newSet);
    };

    const handleSave = async () => {
        const payload = {
            updateSalary: updateBasic || updateAllowance || updateTool || updateQuota || updateDeduction,
            salary: {
                fieldsToUpdate: { basic: updateBasic, allowance: updateAllowance, tool: updateTool, quota: updateQuota, deduction: updateDeduction },
                basic, allowance, tool, quota, deduction
            },
            updateKpi: updateKpi,
            kpi: {
                mode: kpiMode,
                selectedKpis: Array.from(selectedKpis)
            }
        };

        try {
            setLoading(true);
            const userIds = Array.from(selectedUserIds);
            
            // 1. Process Salary Updates
            if (payload.updateSalary) {
                const profilesToUpsert = userIds.map(userId => {
                    const current = salaryProfiles.find(p => p.user_id === userId) || createEmptySalaryProfile(userId);
                    return {
                        user_id: userId,
                        basic_salary: updateBasic ? basic : (current.basic_salary || 0),
                        allowance_fixed: updateAllowance ? allowance : (current.allowance_fixed || 0),
                        tool_allowance: updateTool ? tool : (current.tool_allowance || 0),
                        quota: updateQuota ? quota : (current.quota || 0),
                        deductions: updateDeduction ? deduction : (current.deductions || 0),
                    };
                });
                
                const { error } = await supabase.from('salary_profiles').upsert(profilesToUpsert, { onConflict: 'user_id' });
                if (error) throw error;
            }

            // 2. Process KPI Updates
            if (payload.updateKpi) {
                if (kpiMode === 'replace') {
                    // Delete existing assignments for selected users first
                    await supabase.from('employee_kpi_assignments').delete().in('user_id', userIds);
                }
                
                if (selectedKpis.size > 0) {
                    const newAssignments = userIds.flatMap(uid => 
                        Array.from(selectedKpis).map(kid => ({ user_id: uid, kpi_id: kid }))
                    );
                    
                    // Use upsert with ignoreDuplicates to handle 'append' mode correctly without errors
                    const { error } = await supabase.from('employee_kpi_assignments').upsert(newAssignments, { onConflict: 'user_id, kpi_id', ignoreDuplicates: true });
                    if (error) throw error;
                }
            }

            toast.success(`Berhasil update ${userIds.length} karyawan`);
            fetchData();
            setIsBulkModalOpen(false);
            setSelectedUserIds(new Set());
        } catch (err: any) {
            toast.error("Gagal update massal: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isBulkModalOpen} onOpenChange={setIsBulkModalOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Massal ({selectedUserIds.size} Karyawan)</DialogTitle>
                    <DialogDescription>
                        Perubahan akan diterapkan ke semua karyawan yang dipilih. Centang kolom yang ingin diubah.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6 py-4">
                    {/* Salary Section */}
                    <div className="space-y-4 border-b pb-6">
                        <h3 className="font-semibold text-sm uppercase text-slate-500">Komponen Gaji</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Basic Salary */}
                            <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                                <Checkbox checked={updateBasic} onCheckedChange={(c) => setUpdateBasic(!!c)} className="mt-1" />
                                <div className="flex-1 space-y-2">
                                    <Label className={!updateBasic ? 'text-slate-400' : ''}>Gaji Pokok</Label>
                                    <CurrencyInput 
                                        disabled={!updateBasic} 
                                        value={basic} 
                                        onChange={setBasic}
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* Allowance */}
                            <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                                <Checkbox checked={updateAllowance} onCheckedChange={(c) => setUpdateAllowance(!!c)} className="mt-1" />
                                <div className="flex-1 space-y-2">
                                    <Label className={!updateAllowance ? 'text-slate-400' : ''}>Tunjangan Tetap</Label>
                                    <CurrencyInput 
                                        disabled={!updateAllowance} 
                                        value={allowance} 
                                        onChange={setAllowance}
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* Tool Allowance */}
                            <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                                <Checkbox checked={updateTool} onCheckedChange={(c) => setUpdateTool(!!c)} className="mt-1" />
                                <div className="flex-1 space-y-2">
                                    <Label className={!updateTool ? 'text-slate-400' : ''}>Tunjangan Alat</Label>
                                    <CurrencyInput 
                                        disabled={!updateTool} 
                                        value={tool} 
                                        onChange={setTool}
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* Quota */}
                            <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                                <Checkbox checked={updateQuota} onCheckedChange={(c) => setUpdateQuota(!!c)} className="mt-1" />
                                <div className="flex-1 space-y-2">
                                    <Label className={!updateQuota ? 'text-slate-400' : ''}>Kuota Internet</Label>
                                    <CurrencyInput 
                                        disabled={!updateQuota} 
                                        value={quota} 
                                        onChange={setQuota}
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* Deductions */}
                            <div className="flex items-start gap-3 p-3 border border-red-100 bg-red-50/20 rounded-lg hover:bg-red-50/50 transition-colors">
                                <Checkbox checked={updateDeduction} onCheckedChange={(c) => setUpdateDeduction(!!c)} className="mt-1 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600" />
                                <div className="flex-1 space-y-2">
                                    <Label className={!updateDeduction ? 'text-slate-400' : 'text-red-700'}>Potongan (Kasbon)</Label>
                                    <CurrencyInput 
                                        disabled={!updateDeduction} 
                                        value={deduction} 
                                        onChange={setDeduction}
                                        placeholder="0"
                                        className="border-red-200 focus:ring-red-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* KPI Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Checkbox checked={updateKpi} onCheckedChange={(c) => setUpdateKpi(!!c)} />
                                <Label className={!updateKpi ? 'text-slate-400' : 'font-semibold'}>Update KPI Assignment</Label>
                            </div>
                            {updateKpi && (
                                <div className="flex items-center bg-slate-100 rounded-lg p-1">
                                    <button 
                                        onClick={() => setKpiMode('replace')}
                                        className={cn("text-xs px-3 py-1 rounded-md transition-all", kpiMode === 'replace' ? "bg-white shadow text-slate-800 font-medium" : "text-slate-500")}
                                    >
                                        Replace All
                                    </button>
                                    <button 
                                        onClick={() => setKpiMode('append')}
                                        className={cn("text-xs px-3 py-1 rounded-md transition-all", kpiMode === 'append' ? "bg-white shadow text-slate-800 font-medium" : "text-slate-500")}
                                    >
                                        Add Only
                                    </button>
                                </div>
                            )}
                        </div>

                        {updateKpi && (
                            <div className="border rounded-xl h-[200px] overflow-y-auto p-3 space-y-2 bg-slate-50/50 custom-scrollbar">
                                {kpis.map(kpi => (
                                    <div 
                                        key={kpi.id}
                                        onClick={() => toggleKpi(kpi.id)}
                                        className={cn(
                                            "flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-all",
                                            selectedKpis.has(kpi.id) 
                                                ? "bg-white border-orange-400 ring-1 ring-orange-400/20" 
                                                : "bg-white border-slate-200 hover:border-orange-300"
                                        )}
                                    >
                                        <Checkbox 
                                            checked={selectedKpis.has(kpi.id)}
                                            onCheckedChange={() => toggleKpi(kpi.id)}
                                        />
                                        <div className="flex-1 flex justify-between">
                                            <span className="text-sm font-medium">{kpi.name}</span>
                                            <span className="text-xs font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                {kpi.type === 'percentage_omzet' ? `${kpi.amount}%` : `Rp ${kpi.amount.toLocaleString('id-ID')}`}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsBulkModalOpen(false)}>Batal</Button>
                    <Button onClick={handleSave} className="bg-orange-600 hover:bg-orange-700 text-white">
                        Simpan Perubahan ({selectedUserIds.size} User)
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
  };

  const SalaryModal = () => {
    // State initialization with default values (will be updated via useEffect)
    const [basic, setBasic] = useState(0);
    const [allowance, setAllowance] = useState(0);
    const [toolAllowance, setToolAllowance] = useState(0);
    const [quota, setQuota] = useState(0);
    const [deductions, setDeductions] = useState(0);
    const [selectedKpis, setSelectedKpis] = useState<Set<string>>(new Set());

    // Update state when user changes
    useEffect(() => {
        if (selectedUserForSalary) {
            const profile = salaryProfiles.find(p => p.user_id === selectedUserForSalary.id);
            const userAssignments = assignments.filter(a => a.user_id === selectedUserForSalary.id);
            
            setBasic(profile?.basic_salary || 0);
            setAllowance(profile?.allowance_fixed || 0);
            setToolAllowance(profile?.tool_allowance || 0);
            setQuota(profile?.quota || 0);
            setDeductions(profile?.deductions || 0);
            setSelectedKpis(new Set(userAssignments.map(a => a.kpi_id)));
        }
    }, [selectedUserForSalary, salaryProfiles, assignments]);

    if (!selectedUserForSalary) return null;

    const toggleKpi = (id: string) => {
        const newSet = new Set(selectedKpis);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedKpis(newSet);
    };

    return (
        <Dialog open={isSalaryModalOpen} onOpenChange={setIsSalaryModalOpen}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle className="text-xl flex items-center gap-2">
                        <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                            <span>Atur Komponen Gaji</span>
                            <span className="block text-sm font-normal text-slate-500 mt-1">{selectedUserForSalary.name} • {selectedUserForSalary.role}</span>
                        </div>
                    </DialogTitle>
                    <DialogDescription className="text-slate-500">
                        Sesuaikan gaji pokok, tunjangan, dan assign KPI untuk karyawan ini.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">1</div>
                            <h4 className="font-semibold text-slate-800 dark:text-slate-200">Pendapatan Tetap</h4>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2">
                                <Label>Gaji Pokok (Rp)</Label>
                                <CurrencyInput 
                                    value={basic} 
                                    onChange={setBasic}
                                    className="font-mono bg-slate-50 border-slate-200 focus:border-orange-500 focus:ring-orange-500"
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Tunjangan (Rp)</Label>
                                <CurrencyInput 
                                    value={allowance} 
                                    onChange={setAllowance}
                                    className="font-mono bg-slate-50 border-slate-200 focus:border-orange-500 focus:ring-orange-500"
                                    placeholder="0"
                                />
                                <p className="text-[10px] text-slate-500">*Makan, Transport, dll</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Tunjangan Alat (Rp)</Label>
                                <CurrencyInput 
                                    value={toolAllowance} 
                                    onChange={setToolAllowance}
                                    className="font-mono bg-slate-50 border-slate-200 focus:border-orange-500 focus:ring-orange-500"
                                    placeholder="0"
                                />
                                <p className="text-[10px] text-slate-500">*Sewa alat pribadi</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Kuota Internet (Rp)</Label>
                                <CurrencyInput 
                                    value={quota} 
                                    onChange={setQuota}
                                    className="font-mono bg-slate-50 border-slate-200 focus:border-orange-500 focus:ring-orange-500"
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Potongan (Rp)</Label>
                                <CurrencyInput 
                                    value={deductions} 
                                    onChange={setDeductions}
                                    className="font-mono bg-red-50 border-red-200 focus:border-red-500 focus:ring-red-500 text-red-700"
                                    placeholder="0"
                                />
                                <p className="text-[10px] text-red-500">*Kasbon/Cicilan Rutin</p>
                            </div>
                        </div>
                        
                        <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/20 mt-4 space-y-2">
                            <div className="flex justify-between items-center">
                                <p className="text-xs font-semibold text-orange-800 dark:text-orange-300 uppercase tracking-wider">Total Pendapatan</p>
                                <p className="text-sm font-bold font-mono text-orange-700 dark:text-orange-400">
                                    Rp {(basic + allowance + toolAllowance + quota).toLocaleString('id-ID')}
                                </p>
                            </div>
                            <div className="flex justify-between items-center text-red-600/80">
                                <p className="text-xs font-semibold uppercase tracking-wider">Potongan</p>
                                <p className="text-sm font-bold font-mono">
                                    - Rp {deductions.toLocaleString('id-ID')}
                                </p>
                            </div>
                            <div className="border-t border-orange-200/50 pt-2 flex justify-between items-center">
                                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Net Fixed Pay</p>
                                <p className="text-xl font-bold font-mono text-slate-800">
                                    Rp {(basic + allowance + toolAllowance + quota - deductions).toLocaleString('id-ID')}
                                </p>
                            </div>
                            <p className="text-[10px] text-orange-600/70 dark:text-orange-400/70 mt-1">
                                *Nominal bersih yang diterima sebelum bonus
                            </p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">2</div>
                                <h4 className="font-semibold text-slate-800 dark:text-slate-200">KPI & Variabel Bonus</h4>
                            </div>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{kpis.length} Tersedia</Badge>
                        </div>

                        <div className="border rounded-xl h-[380px] overflow-y-auto p-3 space-y-2 bg-slate-50/50 dark:bg-slate-900/20 custom-scrollbar">
                            {kpis.length === 0 && (
                                <div className="text-center py-12 text-slate-400 text-sm flex flex-col items-center">
                                    <Briefcase className="w-8 h-8 mb-2 opacity-20" />
                                    Belum ada Master KPI.
                                </div>
                            )}
                            {kpis.map(kpi => {
                                // Parse config to check for tiered
                                let isTiered = false;
                                let tieredConfig: any = null;
                                try {
                                    if (kpi.target_field && kpi.target_field.startsWith('{')) {
                                        const parsed = JSON.parse(kpi.target_field);
                                        if (parsed.isTiered) {
                                            isTiered = true;
                                            tieredConfig = parsed;
                                        }
                                    }
                                } catch (e) {}

                                return (
                                <div 
                                    key={kpi.id}
                                    onClick={() => toggleKpi(kpi.id)}
                                    className={cn(
                                        "flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-all relative overflow-hidden group",
                                        selectedKpis.has(kpi.id) 
                                            ? "bg-white border-orange-400 shadow-sm ring-1 ring-orange-400/20" 
                                            : "bg-white border-slate-200 hover:border-orange-300 hover:bg-orange-50/30"
                                    )}
                                >
                                    <div className={cn(
                                        "absolute left-0 top-0 bottom-0 w-1 transition-colors",
                                        selectedKpis.has(kpi.id) ? "bg-orange-500" : "bg-transparent"
                                    )} />
                                    
                                    <Checkbox 
                                        checked={selectedKpis.has(kpi.id)}
                                        onCheckedChange={() => toggleKpi(kpi.id)}
                                        className="mt-1 data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
                                    />
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <p className="text-sm font-medium text-slate-800">{kpi.name}</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                            <Badge variant="secondary" className="text-[10px] h-5 bg-slate-100 text-slate-600 font-normal">
                                                {kpi.type === 'per_order' ? 'Per Unit (Qty)' : 
                                                 kpi.type === 'fixed' ? 'Fixed Bonus' : 
                                                 kpi.type === 'percentage_omzet' ? '% Omzet' : 'Action'}
                                            </Badge>
                                            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                                                {kpi.type === 'percentage_omzet' 
                                                    ? `${kpi.amount}%` 
                                                    : `Rp ${kpi.amount.toLocaleString('id-ID')}`}
                                            </span>
                                            {isTiered && (
                                                <Badge variant="outline" className="text-[10px] h-5 border-orange-200 text-orange-700 bg-orange-50 font-normal">
                                                    Tiered {'>'} {tieredConfig?.threshold} Unit
                                                </Badge>
                                            )}
                                        </div>
                                        {isTiered && (
                                            <div className="mt-2 text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100 flex gap-2">
                                                <span>Base: <strong>Rp {kpi.amount.toLocaleString('id-ID')}</strong></span>
                                                <span className="text-slate-300">|</span>
                                                <span>Next: <strong>Rp {tieredConfig?.aboveThresholdAmount?.toLocaleString('id-ID')}</strong></span>
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingKpi(kpi);
                                            setIsKpiModalOpen(true);
                                        }}
                                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2"
                                    >
                                        <Edit className="w-3.5 h-3.5 text-slate-400 hover:text-orange-500" />
                                    </Button>
                                </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t border-slate-100 dark:border-slate-800 pt-4">
                    <Button variant="ghost" onClick={() => setIsSalaryModalOpen(false)}>Batal</Button>
                    <Button 
                        onClick={() => handleSaveSalary(selectedUserForSalary.id, basic, allowance, toolAllowance, quota, deductions, Array.from(selectedKpis))}
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                    >
                        Simpan Perubahan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
  };

  const KpiModal = () => {
    const [formData, setFormData] = useState<Partial<KPI>>({ name: '', type: 'per_order', amount: 0, description: '' });
    
    // Extended Configuration State
    const [kpiConfig, setKpiConfig] = useState<KPIConfig>({
        periodType: 'cutoff',
        dateReference: 'service_date',
        platforms: '',
        targetRoles: '',
        specificUserId: undefined,
        units: '',
        isTiered: false,
        threshold: 0,
        aboveThresholdAmount: 0
    });

    useEffect(() => {
        if (isKpiModalOpen) {
            if (editingKpi) {
                setFormData(editingKpi);
                // Try parsing config from target_field
                try {
                    if (editingKpi.target_field && editingKpi.target_field.startsWith('{')) {
                        const parsed = JSON.parse(editingKpi.target_field);
                        setKpiConfig({
                            periodType: parsed.periodType || 'cutoff',
                            dateReference: parsed.dateReference || 'service_date',
                            platforms: parsed.platforms || '',
                            targetRoles: parsed.targetRoles || '',
                            specificUserId: parsed.specificUserId || undefined,
                            units: parsed.units || '',
                            isTiered: parsed.isTiered || false,
                            threshold: parsed.threshold || 0,
                            aboveThresholdAmount: parsed.aboveThresholdAmount || 0
                        });
                    } else {
                        // Default fallback
                        setKpiConfig({
                            periodType: 'cutoff',
                            dateReference: 'service_date',
                            platforms: '',
                            targetRoles: '',
                            specificUserId: undefined,
                            units: '',
                            isTiered: false,
                            threshold: 0,
                            aboveThresholdAmount: 0
                        });
                    }
                } catch (e) {
                    console.error("Failed to parse KPI config", e);
                }
            } else {
                setFormData({ name: '', type: 'per_order', amount: 0, description: '' });
                setKpiConfig({
                    periodType: 'cutoff',
                    dateReference: 'service_date',
                    platforms: '',
                    targetRoles: '',
                    specificUserId: undefined,
                    units: '',
                    isTiered: false,
                    threshold: 0,
                    aboveThresholdAmount: 0
                });
            }
        }
    }, [isKpiModalOpen, editingKpi]);

    const handleSave = () => {
        // Pack config into target_field
        const configString = JSON.stringify(kpiConfig);
        const finalData = {
            ...formData,
            target_field: configString
        };
        handleSaveKpi(finalData);
    };

    return (
        <Dialog open={isKpiModalOpen} onOpenChange={setIsKpiModalOpen}>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{editingKpi ? 'Edit KPI' : 'Buat KPI Baru'}</DialogTitle>
                    <DialogDescription>
                        Atur detail KPI untuk perhitungan bonus karyawan.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Nama KPI / Bonus</Label>
                        <Input 
                            value={formData.name} 
                            onChange={e => setFormData({...formData, name: e.target.value})}
                            placeholder="Contoh: Bonus Closing CS"
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tipe Hitungan</Label>
                            <Select 
                                value={formData.type} 
                                onValueChange={(val: any) => setFormData({...formData, type: val})}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="per_order">Per Unit (Qty)</SelectItem>
                                    <SelectItem value="fixed">Fixed (Tunjangan)</SelectItem>
                                    <SelectItem value="percentage_omzet">Persentase Omzet</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>{kpiConfig.isTiered ? 'Nominal Dasar (Per Unit)' : 'Nominal / Nilai'}</Label>
                            <Input 
                                type="number"
                                value={formData.amount}
                                onChange={e => setFormData({...formData, amount: Number(e.target.value)})}
                                placeholder="0"
                            />
                            <p className="text-[10px] text-slate-500">
                                {kpiConfig.isTiered ? '*Nilai untuk unit di bawah target' : '*Isi angka saja (Rp atau %)'}
                            </p>
                        </div>
                    </div>

                    {/* Tiered Calculation Option (Only for Per Order) */}
                    {formData.type === 'per_order' && (
                        <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 space-y-4">
                            <div className="flex items-center gap-2">
                                <Checkbox 
                                    id="isTiered" 
                                    checked={kpiConfig.isTiered}
                                    onCheckedChange={(c) => setKpiConfig({...kpiConfig, isTiered: !!c})}
                                    className="data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
                                />
                                <Label htmlFor="isTiered" className="text-orange-900 font-semibold cursor-pointer">
                                    Aktifkan Hitungan Bertingkat (Tiered)
                                </Label>
                            </div>
                            
                            {kpiConfig.isTiered && (
                                <div className="pl-6 space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <div className="text-xs text-orange-800/80 mb-2">
                                        Contoh: Jika total unit {'>'} 50, maka unit ke-51 dst dikali harga berbeda.
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs text-orange-900">Target Minimum (Unit)</Label>
                                            <Input 
                                                type="number"
                                                value={kpiConfig.threshold || ''}
                                                onChange={e => setKpiConfig({...kpiConfig, threshold: Number(e.target.value)})}
                                                placeholder="50"
                                                className="h-9 bg-white border-orange-200 focus:ring-orange-500"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs text-orange-900">Bonus Setelah Target (Per Unit)</Label>
                                            <Input 
                                                type="number"
                                                value={kpiConfig.aboveThresholdAmount || ''}
                                                onChange={e => setKpiConfig({...kpiConfig, aboveThresholdAmount: Number(e.target.value)})}
                                                placeholder="5000"
                                                className="h-9 bg-white border-orange-200 focus:ring-orange-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                             <Briefcase className="w-4 h-4 text-slate-500" />
                             <h4 className="text-sm font-semibold text-slate-700">Konfigurasi Periode & Filter</h4>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs">Periode Perhitungan</Label>
                                <Select 
                                    value={kpiConfig.periodType} 
                                    onValueChange={(val: any) => setKpiConfig({...kpiConfig, periodType: val})}
                                >
                                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cutoff">Cutoff (Tgl 28 - 27)</SelectItem>
                                        <SelectItem value="calendar">Kalender (Tgl 1 - Akhir)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">Acuan Tanggal</Label>
                                <Select 
                                    value={kpiConfig.dateReference} 
                                    onValueChange={(val: any) => setKpiConfig({...kpiConfig, dateReference: val})}
                                >
                                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="service_date">Tanggal Pengerjaan (Service)</SelectItem>
                                        <SelectItem value="lead_date">Tanggal Masuk (Leads)</SelectItem>
                                        <SelectItem value="closing_date">Tanggal Closing</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                             <div className="space-y-2">
                                <Label className="text-xs">Filter Platform (Opsional)</Label>
                                <Select 
                                    value={kpiConfig.platforms || 'all'} 
                                    onValueChange={(val: any) => setKpiConfig({...kpiConfig, platforms: val === 'all' ? '' : val})}
                                >
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="Pilih Platform" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua Platform</SelectItem>
                                        {platforms.map(p => (
                                            <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs">Filter User / Role</Label>
                                    <Select 
                                        value={kpiConfig.targetRoles || 'all'} 
                                        onValueChange={(val: any) => setKpiConfig({...kpiConfig, targetRoles: val === 'all' ? '' : val, specificUserId: undefined})}
                                    >
                                        <SelectTrigger className="h-9 text-xs">
                                            <SelectValue placeholder="Pilih Role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Semua Role</SelectItem>
                                            {roles.map(r => (
                                                <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                {(() => {
                                    const normalizedTargetRole = normalizeRole(kpiConfig.targetRoles);
                                    return normalizedTargetRole === 'Advertiser' || normalizedTargetRole === 'CS' || normalizedTargetRole === 'Teknisi';
                                })() && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                        <Label className="text-xs">Pilih Spesifik {normalizeRole(kpiConfig.targetRoles) || kpiConfig.targetRoles}</Label>
                                        <Select 
                                            value={kpiConfig.specificUserId || 'all'} 
                                            onValueChange={(val: any) => setKpiConfig({...kpiConfig, specificUserId: val === 'all' ? undefined : val})}
                                        >
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue placeholder={`Semua ${normalizeRole(kpiConfig.targetRoles) || kpiConfig.targetRoles}`} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Semua {normalizeRole(kpiConfig.targetRoles) || kpiConfig.targetRoles}</SelectItem>
                                                {users
                                                    .filter(u => normalizeRole(u.role) === normalizeRole(kpiConfig.targetRoles))
                                                    .map(u => (
                                                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                                    ))
                                                }
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label className="text-xs">Filter Unit</Label>
                                    <Select 
                                        value={kpiConfig.units || 'all'} 
                                        onValueChange={(val: any) => setKpiConfig({...kpiConfig, units: val === 'all' ? '' : val})}
                                    >
                                        <SelectTrigger className="h-9 text-xs">
                                            <SelectValue placeholder="Pilih Unit" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Semua Unit</SelectItem>
                                            {activeBranches.map(b => (
                                                <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                             </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Keterangan</Label>
                        <Textarea 
                            value={formData.description || ''} 
                            onChange={e => setFormData({...formData, description: e.target.value})}
                            placeholder="Syarat & ketentuan pencapaian bonus..."
                            className="resize-none h-20"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsKpiModalOpen(false)}>Batal</Button>
                    <Button onClick={handleSave}>Simpan</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto min-h-screen pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-orange-500" />
                Payroll & Komisi
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
                Manajemen gaji pokok, KPI, dan estimasi bonus karyawan.
            </p>
        </div>
        <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-3 py-1 bg-orange-50 text-orange-700 border-orange-200">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> System Ready
            </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1">
            <TabsTrigger value="salary" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
                <Users className="w-4 h-4 mr-2" /> Data Gaji Pegawai
            </TabsTrigger>
            <TabsTrigger value="kpi" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
                <Briefcase className="w-4 h-4 mr-2" /> Master KPI & Bonus
            </TabsTrigger>
            <TabsTrigger value="estimate" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
                <Calculator className="w-4 h-4 mr-2" /> Kalkulator Estimasi
            </TabsTrigger>
        </TabsList>

        {/* --- TAB 1: SALARY PROFILES --- */}
        <TabsContent value="salary">
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex flex-col gap-1">
                        <CardTitle className="text-xl">Daftar Gaji Karyawan</CardTitle>
                        <CardDescription>Atur Gaji Pokok, Tunjangan, dan Assign KPI untuk setiap karyawan.</CardDescription>
                        {selectedUserIds.size > 0 && (
                            <div className="flex items-center gap-3 mt-2 animate-in fade-in slide-in-from-top-2">
                                <span className="text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                                    {selectedUserIds.size} dipilih
                                </span>
                                <Button 
                                    size="sm" 
                                    onClick={() => setIsBulkModalOpen(true)}
                                    className="bg-slate-900 text-white hover:bg-slate-800 h-8 text-xs font-medium"
                                >
                                    <Edit className="w-3.5 h-3.5 mr-1.5" />
                                    Edit Massal
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => setSelectedUserIds(new Set())}
                                    className="text-slate-500 hover:text-slate-700 h-8 text-xs"
                                >
                                    Batal
                                </Button>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 w-full max-w-xs relative">
                        <Search className="w-4 h-4 text-slate-400 absolute ml-3" />
                        <Input 
                            placeholder="Cari nama atau role..." 
                            className="pl-9 bg-slate-50 border-slate-200 focus:ring-orange-500 focus:border-orange-500"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-900">
                            <TableRow className="border-slate-100 dark:border-slate-800">
                                <TableHead className="w-[50px] py-4 pl-4">
                                    <Checkbox 
                                        checked={selectedUserIds.size === combinedUserData.length && combinedUserData.length > 0}
                                        onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                                        className="translate-y-[2px]"
                                    />
                                </TableHead>
                                <TableHead className="w-[50px] py-4 font-semibold text-slate-600">No</TableHead>
                                <TableHead className="py-4 font-semibold text-slate-600">Nama Karyawan</TableHead>
                                <TableHead className="py-4 font-semibold text-slate-600">Role</TableHead>
                                <TableHead className="py-4 font-semibold text-slate-600">Gaji Pokok</TableHead>
                                <TableHead className="py-4 font-semibold text-slate-600">Tunjangan</TableHead>
                                <TableHead className="py-4 font-semibold text-slate-600">Tunjangan Alat</TableHead>
                                <TableHead className="py-4 font-semibold text-slate-600">Kuota</TableHead>
                                <TableHead className="py-4 font-semibold text-slate-600">Potongan</TableHead>
                                <TableHead className="py-4 font-semibold text-slate-600">KPI Aktif</TableHead>
                                <TableHead className="py-4 pr-6 text-right font-semibold text-slate-600">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {combinedUserData.map((user, index) => (
                                <TableRow key={user.id} className={cn(
                                    "hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-colors border-b border-slate-100 dark:border-slate-800",
                                    selectedUserIds.has(user.id) ? "bg-orange-50/40" : ""
                                )}>
                                    <TableCell className="py-3 pl-4">
                                        <Checkbox 
                                            checked={selectedUserIds.has(user.id)}
                                            onCheckedChange={() => toggleSelectUser(user.id)}
                                            className="translate-y-[2px]"
                                        />
                                    </TableCell>
                                    <TableCell className="py-3 font-medium text-slate-500 text-center">
                                        {index + 1}
                                    </TableCell>
                                    <TableCell className="py-3 font-medium">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                                {user.avatar ? (
                                                    <img 
                                                        src={user.avatar} 
                                                        alt={user.name} 
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-xs font-bold text-slate-600">
                                                        {user.name.substring(0,2).toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            {user.name}
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <Badge variant="outline" className={cn("font-normal border", ROLE_STYLES[normalizeRole(user.role) || user.role] || "bg-slate-50 text-slate-600 border-slate-200")}>
                                            {user.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="py-3 font-mono text-slate-600 dark:text-slate-300">
                                        {user.salaryProfile ? `Rp ${user.salaryProfile.basic_salary.toLocaleString('id-ID')}` : '-'}
                                    </TableCell>
                                    <TableCell className="py-3 font-mono text-slate-600 dark:text-slate-300">
                                        {user.salaryProfile ? `Rp ${user.salaryProfile.allowance_fixed.toLocaleString('id-ID')}` : '-'}
                                    </TableCell>
                                    <TableCell className="py-3 font-mono text-slate-600 dark:text-slate-300">
                                        {user.salaryProfile && user.salaryProfile.tool_allowance ? `Rp ${user.salaryProfile.tool_allowance.toLocaleString('id-ID')}` : '-'}
                                    </TableCell>
                                    <TableCell className="py-3 font-mono text-slate-600 dark:text-slate-300">
                                        {user.salaryProfile && user.salaryProfile.quota ? `Rp ${user.salaryProfile.quota.toLocaleString('id-ID')}` : '-'}
                                    </TableCell>
                                    <TableCell className="py-3 font-mono text-red-600 dark:text-red-400">
                                        {user.salaryProfile && user.salaryProfile.deductions ? `-Rp ${user.salaryProfile.deductions.toLocaleString('id-ID')}` : '-'}
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {user.activeKpis.length > 0 ? (
                                                user.activeKpis.map(kpi => (
                                                    <Badge key={kpi.id} variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">
                                                        {kpi.name}
                                                    </Badge>
                                                ))
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Belum ada KPI</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3 pr-6 text-right">
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                            onClick={() => {
                                                setSelectedUserForSalary(user);
                                                setIsSalaryModalOpen(true);
                                            }}
                                        >
                                            <Edit className="w-4 h-4 mr-2" /> Atur Gaji
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>

        {/* --- TAB 2: MASTER KPI --- */}
        <TabsContent value="kpi">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Master KPI & Bonus</CardTitle>
                        <CardDescription>Perpustakaan aturan bonus yang bisa diterapkan ke karyawan.</CardDescription>
                    </div>
                    <Button onClick={() => { setEditingKpi(null); setIsKpiModalOpen(true); }} className="bg-orange-600 hover:bg-orange-700 text-white">
                        <Plus className="w-4 h-4 mr-2" /> Buat KPI Baru
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {kpis.map(kpi => (
                            <div key={kpi.id} className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                                        <DollarSign className="w-5 h-5" />
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingKpi(kpi); setIsKpiModalOpen(true); }}>
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteKpi(kpi.id)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                                <h3 className="font-semibold text-lg mb-1">{kpi.name}</h3>
                                <p className="text-sm text-slate-500 mb-4 h-10 line-clamp-2">{kpi.description || 'Tidak ada keterangan tambahan.'}</p>
                                
                                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <Badge variant="secondary" className="capitalize">
                                        {kpi.type.replace('_', ' ')}
                                    </Badge>
                                    <span className="font-mono font-bold text-emerald-600 text-lg">
                                        {kpi.type === 'percentage_omzet' ? `${kpi.amount}%` : `Rp ${kpi.amount.toLocaleString('id-ID')}`}
                                    </span>
                                </div>
                            </div>
                        ))}
                        
                        {kpis.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                <Briefcase className="w-12 h-12 mb-3 opacity-20" />
                                <p>Belum ada KPI yang dibuat.</p>
                                <Button variant="link" onClick={() => setIsKpiModalOpen(true)}>Buat Sekarang</Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

        {/* --- TAB 3: ESTIMATION CALCULATOR --- */}
        <TabsContent value="estimate">
            <Card className="bg-slate-900 text-slate-100 border-slate-800">
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-white">
                                <Calculator className="w-5 h-5 text-emerald-400" />
                                Simulasi Payroll
                            </CardTitle>
                            <CardDescription className="text-slate-400">
                                Estimasi real-time berdasarkan Gaji Pokok + (Mock Data Kinerja). Periode Cutoff: <strong>{periodString}</strong>
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Periode:</span>
                            <input 
                                type="month" 
                                value={selectedMonth} 
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="bg-slate-800 border-slate-700 text-white rounded px-2 py-1 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Fixed Cost</p>
                                <p className="text-lg font-bold text-white">
                                    Rp {combinedUserData.reduce((acc, u) => acc + (u.salaryProfile?.basic_salary || 0) + (u.salaryProfile?.allowance_fixed || 0), 0).toLocaleString('id-ID')}
                                </p>
                            </div>
                            
                            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Est. Bonus Berjalan</p>
                                <p className="text-lg font-bold text-orange-400">
                                    Rp {combinedUserData.reduce((acc, u) => acc + calculateBonus(u).bonus, 0).toLocaleString('id-ID')}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-1">*Live dari order "Selesai"</p>
                            </div>

                            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Save Komisi Freelance</p>
                                <p className="text-lg font-bold text-teal-400">
                                    Rp {totalFreelanceSavings.toLocaleString('id-ID')}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-1">Tabungan/Hold</p>
                            </div>

                            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Tagihan Rutin</p>
                                <p className="text-lg font-bold text-red-400">
                                    Rp {totalUnpaidExpenses.toLocaleString('id-ID')}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-1">Belum Bayar (s/d Tgl 28)</p>
                            </div>

                            <div className="bg-emerald-900/30 p-4 rounded-lg border border-emerald-900/50">
                                <p className="text-xs text-emerald-400 uppercase tracking-wider mb-1">Grand Total Estimasi</p>
                                <p className="text-lg font-bold text-emerald-400">
                                    Rp {(
                                        combinedUserData.reduce((acc, u) => acc + (u.salaryProfile?.basic_salary || 0) + (u.salaryProfile?.allowance_fixed || 0) + calculateBonus(u).bonus, 0) + 
                                        totalUnpaidExpenses
                                    ).toLocaleString('id-ID')}
                                </p>
                                <p className="text-[10px] text-emerald-600/70 mt-1">Fixed + Bonus + Tagihan</p>
                            </div>
                        </div>

                        {/* Detailed Table */}
                        <div className="rounded-lg border border-slate-700 overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-800">
                                    <TableRow className="border-slate-700 hover:bg-slate-800">
                                        <TableHead className="text-slate-300">Nama</TableHead>
                                        <TableHead className="text-slate-300">Gaji Pokok</TableHead>
                                        <TableHead className="text-slate-300">Tunjangan</TableHead>
                                        <TableHead className="text-slate-300">Tool</TableHead>
                                        <TableHead className="text-slate-300">Kuota</TableHead>
                                        <TableHead className="text-slate-300">Potongan</TableHead>
                                        <TableHead className="text-slate-300">Periode</TableHead>
                                        <TableHead className="text-slate-300 text-center">Total Order</TableHead>
                                        <TableHead className="text-slate-300 text-center">Total Unit</TableHead>
                                        <TableHead className="text-slate-300">Bonus</TableHead>
                                        <TableHead className="text-right text-slate-300">Take Home Pay</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {combinedUserData.map(user => {
                                        const basic = user.salaryProfile?.basic_salary || 0;
                                        const allowance = user.salaryProfile?.allowance_fixed || 0;
                                        const tool = user.salaryProfile?.tool_allowance || 0;
                                        const quota = user.salaryProfile?.quota || 0;
                                        const deductions = user.salaryProfile?.deductions || 0;
                                        const bonusStats = calculateBonus(user);
                                        const total = basic + allowance + tool + quota + bonusStats.bonus - deductions;
                                        
                                        return (
                                            <TableRow key={user.id} className="border-slate-800 hover:bg-slate-800/50">
                                                <TableCell className="font-medium text-slate-200">
                                                    <div className="flex flex-col">
                                                        <span>{user.name}</span>
                                                        <span className="text-[10px] text-slate-500">{user.role}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-slate-400 text-xs">Rp {basic.toLocaleString('id-ID')}</TableCell>
                                                <TableCell className="font-mono text-slate-400 text-xs">Rp {allowance.toLocaleString('id-ID')}</TableCell>
                                                <TableCell className="font-mono text-slate-400 text-xs">Rp {tool.toLocaleString('id-ID')}</TableCell>
                                                <TableCell className="font-mono text-slate-400 text-xs">Rp {quota.toLocaleString('id-ID')}</TableCell>
                                                <TableCell className="font-mono text-red-400 text-xs">-Rp {deductions.toLocaleString('id-ID')}</TableCell>
                                                <TableCell className="text-xs text-slate-400">
                                                    <div className="font-medium text-slate-300 whitespace-nowrap">{periodString}</div>
                                                    <div className="text-[10px] opacity-70 text-slate-500">
                                                        By: {(() => {
                                                            try {
                                                                if (user.activeKpis && user.activeKpis.length > 0 && user.activeKpis[0].target_field) {
                                                                    const conf = JSON.parse(user.activeKpis[0].target_field);
                                                                    if (conf.dateReference === 'lead_date') return 'Tgl Leads';
                                                                    if (conf.dateReference === 'closing_date') return 'Tgl Closing';
                                                                }
                                                            } catch(e){}
                                                            return 'Tgl Service';
                                                        })()}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-slate-300 text-center">
                                                    <div 
                                                        className="cursor-pointer hover:text-orange-400 decoration-dotted underline underline-offset-4"
                                                        onClick={() => {
                                                            setDetailUser(user);
                                                            setIsDetailModalOpen(true);
                                                        }}
                                                    >
                                                        {bonusStats.orders}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-slate-300 text-center">
                                                    <div 
                                                        className="cursor-pointer hover:text-orange-400 decoration-dotted underline underline-offset-4"
                                                        onClick={() => {
                                                            setDetailUser(user);
                                                            setIsDetailModalOpen(true);
                                                        }}
                                                    >
                                                        {bonusStats.units}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-orange-400 font-bold">Rp {bonusStats.bonus.toLocaleString('id-ID')}</TableCell>
                                                <TableCell className="text-right font-bold font-mono text-emerald-400 text-lg">
                                                    Rp {total.toLocaleString('id-ID')}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <SalaryModal />
      <KpiModal />
      <BulkEditModal />
      {isDetailModalOpen && <OrderDetailModal />}
    </div>
  );
};

export default PayrollPage;
