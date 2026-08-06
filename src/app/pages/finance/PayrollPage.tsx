import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, Users, Briefcase, Plus, Trash2, Edit,
  Search, Calculator, CheckCircle2, AlertCircle, RefreshCw
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/app/components/ui/table';
import {
  Dialog
} from "@/app/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { Label } from '@/app/components/ui/label';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import {
  DataTable,
  TableActionCell,
  TableActionHeader,
  TableActionMenu,
  TableActionMenuItem,
  TableText,
} from '@/app/components/ui/data-table';
import {
  OperationalEmptyState,
  OperationalFilterPanel,
  OperationalKpiCard,
  OperationalKpiGrid,
  OperationalPageHeader,
  OperationalPageShell,
  OperationalTableCard,
} from '@/app/components/ui/operational-page';
import {
  MasterDataCurrencyInput,
  MasterDataDialogBody,
  MasterDataFieldLabel,
  MasterDataFormActions,
  MasterDataFormDialogContent,
  MasterDataFormField,
  MasterDataFormGrid,
  MasterDataFormHeader,
} from '@/app/components/ui/master-data-ui';
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
  deductions: number; // Potongan tetap yang terbawa ke simulasi setiap periode
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
    return (
        <MasterDataCurrencyInput
            value={value ? value.toLocaleString('id-ID') : ''}
            onValueChange={(digits) => onChange(digits ? parseInt(digits, 10) : 0)}
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
  const canManagePayroll = hasPermission('payroll.manage');
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

  // --- Handlers: Salary Profile ---
  const handleSaveSalary = async (userId: string, basic: number, allowance: number, toolAllowance: number, quota: number, deductions: number, selectedKpis: string[]) => {
    if (!canManagePayroll) {
      toast.error('Anda hanya memiliki akses lihat payroll.');
      return;
    }

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
    if (!canManagePayroll) {
      toast.error('Anda hanya memiliki akses lihat payroll.');
      return;
    }

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
    if (!canManagePayroll) {
        toast.error('Anda hanya memiliki akses lihat payroll.');
        return;
    }

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

    const payrollFixedCost = combinedUserData.reduce((sum, user) => {
        const profile = user.salaryProfile;
        return sum + (profile?.basic_salary || 0) + (profile?.allowance_fixed || 0) + (profile?.tool_allowance || 0) + (profile?.quota || 0);
    }, 0);

    const payrollDeductions = combinedUserData.reduce((sum, user) => sum + (user.salaryProfile?.deductions || 0), 0);
    const payrollBonusEstimate = combinedUserData.reduce((sum, user) => sum + calculateBonus(user).bonus, 0);
    const payrollTakeHomeEstimate = payrollFixedCost + payrollBonusEstimate - payrollDeductions;
    const configuredEmployees = combinedUserData.filter((user) => Boolean(user.salaryProfile)).length;

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
                <MasterDataFormDialogContent size="wide" className="payrollOrderDetailDialog">
                    <MasterDataFormHeader
                        icon={Briefcase}
                        title={`Detail Order ${detailUser.name}`}
                        description={`Periode payroll: ${periodString}`}
                    />
                    
                    <MasterDataDialogBody compact>
                    <DataTable
                        columns={['72px', '160px', 'minmax(220px,1.3fr)', 'minmax(160px,1fr)', '96px', '160px']}
                        minWidth={880}
                        rowMinHeight={72}
                        className="payrollOrderDetailTable"
                    >
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>No</TableHead>
                                    <TableHead>Tanggal</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Platform</TableHead>
                                    <TableHead className="text-center">Unit</TableHead>
                                    <TableHead className="text-right">Omzet</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {uniqueOrders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6}>
                                            <OperationalEmptyState
                                                icon={AlertCircle}
                                                title="Belum ada order"
                                                description="Tidak ada order yang memenuhi kriteria KPI pada periode ini."
                                                className="py-10"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    uniqueOrders.map((order: any, idx: number) => (
                                        <TableRow key={order.id}>
                                            <TableCell>{idx + 1}</TableCell>
                                            <TableCell>
                                                {order.serviceDate ? new Date(order.serviceDate).toLocaleDateString('id-ID', {
                                                    day: 'numeric', month: 'short', year: 'numeric'
                                                }) : '-'}
                                            </TableCell>
                                            <TableCell>
                                                <TableText primary={order.customerName || '-'} secondary={order.customerPhone || undefined} />
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="payrollSoftBadge">
                                                    {platforms.find(p => p.id === order.platformId)?.name || 'Unknown'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {order.units || 1}
                                            </TableCell>
                                            <TableCell className="text-right payrollMoneyCell isPositive">
                                                Rp {(order.price || 0).toLocaleString('id-ID')}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </DataTable>
                    </MasterDataDialogBody>
                    
                    <div className="masterDataFormActions payrollDetailActions">
                        <div className="payrollDetailTotal">
                            <span>Total Bonus Estimasi</span>
                            <strong>Rp {bonus.toLocaleString('id-ID')}</strong>
                            </div>
                        <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>Tutup</Button>
                    </div>
                </MasterDataFormDialogContent>
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
        if (!canManagePayroll) {
            toast.error('Anda hanya memiliki akses lihat payroll.');
            return;
        }

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
            <MasterDataFormDialogContent size="wide" className="payrollBulkDialog">
                <MasterDataFormHeader
                    icon={Users}
                    title={`Edit Massal (${selectedUserIds.size} Karyawan)`}
                    description="Centang komponen yang ingin diubah. Komponen yang tidak dicentang akan tetap memakai data lama."
                />
                
                <form
                  className="masterDataForm payrollBulkForm"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSave();
                  }}
                >
                <MasterDataDialogBody>
                <div className="space-y-6">
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
                                    <Label className={!updateDeduction ? 'text-slate-400' : 'text-red-700'}>Potongan Tetap</Label>
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
                                <Label className={!updateKpi ? 'text-slate-400' : 'font-semibold'}>Update KPI Karyawan</Label>
                            </div>
                            {updateKpi && (
                                <div className="flex items-center bg-slate-100 rounded-lg p-1">
                                    <button 
                                        onClick={() => setKpiMode('replace')}
                                        className={cn("text-xs px-3 py-1 rounded-md transition-all", kpiMode === 'replace' ? "bg-white shadow text-slate-800 font-medium" : "text-slate-500")}
                                    >
                                        Ganti Semua
                                    </button>
                                    <button 
                                        onClick={() => setKpiMode('append')}
                                        className={cn("text-xs px-3 py-1 rounded-md transition-all", kpiMode === 'append' ? "bg-white shadow text-slate-800 font-medium" : "text-slate-500")}
                                    >
                                        Tambah Saja
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
                </MasterDataDialogBody>

                <MasterDataFormActions
                    onCancel={() => setIsBulkModalOpen(false)}
                    saveLabel={`Simpan (${selectedUserIds.size})`}
                    submitDisabled={!canManagePayroll || selectedUserIds.size === 0}
                    isSubmitting={loading}
                />
                </form>
            </MasterDataFormDialogContent>
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
            <MasterDataFormDialogContent size="wide" className="payrollSalaryDialog">
                <MasterDataFormHeader
                    icon={DollarSign}
                    title="Atur Komponen Gaji"
                    description={`${selectedUserForSalary.name} • ${selectedUserForSalary.role}`}
                />
                <form
                  className="masterDataForm payrollSalaryForm"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSaveSalary(selectedUserForSalary.id, basic, allowance, toolAllowance, quota, deductions, Array.from(selectedKpis));
                  }}
                >
                <MasterDataDialogBody>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">1</div>
                            <h4 className="font-semibold text-slate-800 dark:text-slate-200">Pendapatan Tetap</h4>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2">
                                <MasterDataFieldLabel>Gaji Pokok</MasterDataFieldLabel>
                                <CurrencyInput 
                                    value={basic} 
                                    onChange={setBasic}
                                    className="font-mono bg-slate-50 border-slate-200 focus:border-orange-500 focus:ring-orange-500"
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <MasterDataFieldLabel optional>Tunjangan</MasterDataFieldLabel>
                                <CurrencyInput 
                                    value={allowance} 
                                    onChange={setAllowance}
                                    className="font-mono bg-slate-50 border-slate-200 focus:border-orange-500 focus:ring-orange-500"
                                    placeholder="0"
                                />
                                <p className="text-[10px] text-slate-500">*Makan, Transport, dll</p>
                            </div>
                            <div className="space-y-2">
                                <MasterDataFieldLabel optional>Tunjangan Alat</MasterDataFieldLabel>
                                <CurrencyInput 
                                    value={toolAllowance} 
                                    onChange={setToolAllowance}
                                    className="font-mono bg-slate-50 border-slate-200 focus:border-orange-500 focus:ring-orange-500"
                                    placeholder="0"
                                />
                                <p className="text-[10px] text-slate-500">*Sewa alat pribadi</p>
                            </div>
                            <div className="space-y-2">
                                <MasterDataFieldLabel optional>Kuota Internet</MasterDataFieldLabel>
                                <CurrencyInput 
                                    value={quota} 
                                    onChange={setQuota}
                                    className="font-mono bg-slate-50 border-slate-200 focus:border-orange-500 focus:ring-orange-500"
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <MasterDataFieldLabel optional>Potongan Tetap</MasterDataFieldLabel>
                                <CurrencyInput 
                                    value={deductions} 
                                    onChange={setDeductions}
                                    className="font-mono bg-red-50 border-red-200 focus:border-red-500 focus:ring-red-500 text-red-700"
                                    placeholder="0"
                                />
                                <p className="text-[10px] text-red-500">Terbawa ke setiap periode sampai diubah.</p>
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
                                <p className="text-xs font-semibold uppercase tracking-wider">Potongan Tetap</p>
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
                                    {canManagePayroll && (
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
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                </MasterDataDialogBody>
                <MasterDataFormActions
                    onCancel={() => setIsSalaryModalOpen(false)}
                    saveLabel="Simpan Gaji"
                    submitDisabled={!canManagePayroll}
                    isSubmitting={loading}
                />
                </form>
            </MasterDataFormDialogContent>
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
            <MasterDataFormDialogContent size="wide" className="payrollKpiDialog">
                <MasterDataFormHeader
                    icon={Briefcase}
                    title={editingKpi ? 'Edit KPI' : 'Buat KPI Baru'}
                    description="Atur bonus, periode hitung, dan filter order untuk payroll."
                />
                <form
                  className="masterDataForm payrollKpiForm"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSave();
                  }}
                >
                <MasterDataDialogBody>
                <MasterDataFormGrid>
                    <MasterDataFormField span="full">
                        <MasterDataFieldLabel required>Nama KPI / Bonus</MasterDataFieldLabel>
                        <Input 
                            value={formData.name} 
                            onChange={e => setFormData({...formData, name: e.target.value})}
                            placeholder="Contoh: Bonus Closing CS"
                        />
                    </MasterDataFormField>
                    
                    <MasterDataFormField span="half">
                            <MasterDataFieldLabel required>Tipe Hitungan</MasterDataFieldLabel>
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
                    </MasterDataFormField>
                    <MasterDataFormField span="half">
                            <MasterDataFieldLabel required>{kpiConfig.isTiered ? 'Nominal Dasar' : 'Nominal / Nilai'}</MasterDataFieldLabel>
                            {formData.type === 'percentage_omzet' ? (
                            <Input
                                type="number"
                                value={formData.amount}
                                onChange={e => setFormData({...formData, amount: Number(e.target.value)})}
                                placeholder="0"
                            />
                            ) : (
                            <MasterDataCurrencyInput
                                value={formData.amount || 0}
                                onValueChange={(digits) => setFormData({...formData, amount: digits ? Number(digits) : 0})}
                                placeholder="0"
                            />
                            )}
                    </MasterDataFormField>

                    {/* Tiered Calculation Option (Only for Per Order) */}
                    {formData.type === 'per_order' && (
                        <MasterDataFormField span="full" className="payrollInlinePanel">
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
                        </MasterDataFormField>
                    )}

                    <MasterDataFormField span="full" className="payrollInlinePanel isNeutral">
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
                    </MasterDataFormField>

                    <MasterDataFormField span="full">
                        <MasterDataFieldLabel optional>Keterangan</MasterDataFieldLabel>
                        <Textarea 
                            value={formData.description || ''} 
                            onChange={e => setFormData({...formData, description: e.target.value})}
                            placeholder="Syarat & ketentuan pencapaian bonus..."
                            className="resize-none h-20"
                        />
                    </MasterDataFormField>
                </MasterDataFormGrid>
                </MasterDataDialogBody>
                <MasterDataFormActions
                    onCancel={() => setIsKpiModalOpen(false)}
                    saveLabel="Simpan KPI"
                    submitDisabled={!canManagePayroll || !formData.name}
                    isSubmitting={loading}
                />
                </form>
            </MasterDataFormDialogContent>
        </Dialog>
    );
  };

  return (
    <OperationalPageShell className="payrollPage">
      <OperationalPageHeader
        eyebrow="KEUANGAN"
        icon={DollarSign}
        title="Payroll & Gaji"
        subtitle={`Manajemen gaji pokok, KPI, bonus, dan estimasi payroll periode ${periodString}.`}
        actions={
          <div className="payrollHeaderActions">
            <Badge variant="outline" className={cn('payrollAccessBadge', canManagePayroll ? 'isManage' : 'isView')}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {canManagePayroll ? 'Mode Kelola' : 'Mode Lihat'}
            </Badge>
            <Button type="button" variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        }
      />

      <OperationalKpiGrid className="payrollMetricGrid">
        <OperationalKpiCard
          icon={Users}
          label="Karyawan Aktif"
          value={`${combinedUserData.length} orang`}
          tone="blue"
        />
        <OperationalKpiCard
          icon={DollarSign}
          label="Gaji & Tunjangan"
          value={`Rp ${payrollFixedCost.toLocaleString('id-ID')}`}
          tone="emerald"
        />
        <OperationalKpiCard
          icon={Briefcase}
          label="KPI Terpasang"
          value={`${assignments.length} assignment`}
          tone="violet"
        />
        <OperationalKpiCard
          icon={Calculator}
          label="Estimasi Take Home"
          value={`Rp ${payrollTakeHomeEstimate.toLocaleString('id-ID')}`}
          tone="amber"
        />
      </OperationalKpiGrid>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="payrollTabs">
        <OperationalFilterPanel className="payrollTabsPanel">
          <TabsList className="payrollTabList">
            <TabsTrigger value="salary">
                <Users className="w-4 h-4 mr-2" /> Data Gaji Pegawai
            </TabsTrigger>
            <TabsTrigger value="kpi">
                <Briefcase className="w-4 h-4 mr-2" /> Master KPI & Bonus
            </TabsTrigger>
            <TabsTrigger value="estimate">
                <Calculator className="w-4 h-4 mr-2" /> Kalkulator Estimasi
            </TabsTrigger>
          </TabsList>
          <div className="payrollTabsMeta">
            <span>{configuredEmployees} dari {combinedUserData.length} profil gaji terisi</span>
            <span>Potongan tetap: Rp {payrollDeductions.toLocaleString('id-ID')}</span>
          </div>
        </OperationalFilterPanel>

        {/* --- TAB 1: SALARY PROFILES --- */}
        <TabsContent value="salary">
            <OperationalTableCard className="payrollTableCard">
                <div className="payrollTableToolbar">
                    <div className="flex flex-col gap-1">
                        <h2>Daftar Gaji Karyawan</h2>
                        <p>Atur gaji pokok, tunjangan, potongan tetap, dan KPI aktif per karyawan.</p>
                        {canManagePayroll && selectedUserIds.size > 0 && (
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
                </div>
                <div className="p-0">
                    <DataTable
                        columns={[
                          canManagePayroll && '56px',
                          '64px',
                          'minmax(240px,1.5fr)',
                          '150px',
                          '150px',
                          '150px',
                          '150px',
                          '130px',
                          '130px',
                          'minmax(220px,1fr)',
                          canManagePayroll && '96px',
                        ]}
                        minWidth={canManagePayroll ? 1380 : 1240}
                        rowMinHeight={76}
                        className="payrollDataTable"
                    >
                    <Table>
                        <TableHeader>
                            <TableRow className="border-slate-100 dark:border-slate-800">
                                {canManagePayroll && (
                                <TableHead className="w-[50px] py-4 pl-4">
                                    <Checkbox 
                                        checked={selectedUserIds.size === combinedUserData.length && combinedUserData.length > 0}
                                        onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                                        className="translate-y-[2px]"
                                    />
                                </TableHead>
                                )}
                                <TableHead>No</TableHead>
                                <TableHead>Nama Karyawan</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Gaji Pokok</TableHead>
                                <TableHead>Tunjangan</TableHead>
                                <TableHead>Tunjangan Alat</TableHead>
                                <TableHead>Kuota</TableHead>
                                <TableHead>Potongan Tetap</TableHead>
                                <TableHead>KPI Aktif</TableHead>
                                {canManagePayroll && <TableActionHeader>Aksi</TableActionHeader>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {combinedUserData.map((user, index) => (
                                <TableRow key={user.id} className={cn(
                                    "hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-colors border-b border-slate-100 dark:border-slate-800",
                                    selectedUserIds.has(user.id) ? "bg-orange-50/40" : ""
                                )}>
                                    {canManagePayroll && (
                                    <TableCell className="py-3 pl-4">
                                        <Checkbox 
                                            checked={selectedUserIds.has(user.id)}
                                            onCheckedChange={() => toggleSelectUser(user.id)}
                                            className="translate-y-[2px]"
                                        />
                                    </TableCell>
                                    )}
                                    <TableCell className="text-center">
                                        {index + 1}
                                    </TableCell>
                                    <TableCell>
                                        <TableText primary={user.name} secondary={user.email || user.phone || undefined} />
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn("font-normal border", ROLE_STYLES[normalizeRole(user.role) || user.role] || "bg-slate-50 text-slate-600 border-slate-200")}>
                                            {user.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="payrollMoneyCell">
                                        {user.salaryProfile ? `Rp ${user.salaryProfile.basic_salary.toLocaleString('id-ID')}` : '-'}
                                    </TableCell>
                                    <TableCell className="payrollMoneyCell">
                                        {user.salaryProfile ? `Rp ${user.salaryProfile.allowance_fixed.toLocaleString('id-ID')}` : '-'}
                                    </TableCell>
                                    <TableCell className="payrollMoneyCell">
                                        {user.salaryProfile && user.salaryProfile.tool_allowance ? `Rp ${user.salaryProfile.tool_allowance.toLocaleString('id-ID')}` : '-'}
                                    </TableCell>
                                    <TableCell className="payrollMoneyCell">
                                        {user.salaryProfile && user.salaryProfile.quota ? `Rp ${user.salaryProfile.quota.toLocaleString('id-ID')}` : '-'}
                                    </TableCell>
                                    <TableCell className="payrollMoneyCell isNegative">
                                        {user.salaryProfile && user.salaryProfile.deductions ? `-Rp ${user.salaryProfile.deductions.toLocaleString('id-ID')}` : '-'}
                                    </TableCell>
                                    <TableCell>
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
                                    {canManagePayroll && (
                                    <TableActionCell>
                                        <TableActionMenu>
                                            <TableActionMenuItem
                                                icon={Edit}
                                                onClick={() => {
                                                    setSelectedUserForSalary(user);
                                                    setIsSalaryModalOpen(true);
                                                }}
                                            >
                                                Atur Gaji
                                            </TableActionMenuItem>
                                        </TableActionMenu>
                                    </TableActionCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    </DataTable>
                </div>
            </OperationalTableCard>
        </TabsContent>

        {/* --- TAB 2: MASTER KPI --- */}
        <TabsContent value="kpi">
            <OperationalTableCard className="payrollTableCard">
                <div className="payrollTableToolbar">
                    <div className="flex flex-col gap-1">
                        <h2>Master KPI & Bonus</h2>
                        <p>Perpustakaan aturan bonus yang bisa diterapkan ke karyawan.</p>
                    </div>
                    {canManagePayroll && (
                    <Button onClick={() => { setEditingKpi(null); setIsKpiModalOpen(true); }}>
                        <Plus className="w-4 h-4 mr-2" /> Buat KPI Baru
                    </Button>
                    )}
                </div>
                <DataTable
                    columns={['72px', 'minmax(260px,1.4fr)', '180px', '180px', 'minmax(260px,1fr)', canManagePayroll && '96px']}
                    minWidth={canManagePayroll ? 1060 : 960}
                    rowMinHeight={72}
                    className="payrollDataTable"
                >
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>No</TableHead>
                                <TableHead>Nama KPI</TableHead>
                                <TableHead>Tipe Hitungan</TableHead>
                                <TableHead>Nominal</TableHead>
                                <TableHead>Keterangan</TableHead>
                                {canManagePayroll && <TableActionHeader>Aksi</TableActionHeader>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {kpis.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={canManagePayroll ? 6 : 5}>
                                        <OperationalEmptyState
                                            icon={Briefcase}
                                            title="Belum ada KPI"
                                            description="Buat KPI baru untuk menghitung bonus payroll."
                                            className="py-12"
                                        />
                                        {canManagePayroll && (
                                            <div className="payrollEmptyAction">
                                                <Button type="button" onClick={() => setIsKpiModalOpen(true)}>Buat KPI Baru</Button>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                kpis.map((kpi, index) => (
                                    <TableRow key={kpi.id}>
                                        <TableCell>{index + 1}</TableCell>
                                        <TableCell>
                                            <TableText primary={kpi.name} secondary={`Dipakai ${assignments.filter((item) => item.kpi_id === kpi.id).length} karyawan`} />
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="payrollSoftBadge">
                                                {kpi.type === 'per_order' ? 'Per Unit' : kpi.type === 'fixed' ? 'Fixed' : 'Persentase Omzet'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className={cn('payrollMoneyCell', kpi.type !== 'percentage_omzet' && 'isPositive')}>
                                            {kpi.type === 'percentage_omzet' ? `${kpi.amount}%` : `Rp ${kpi.amount.toLocaleString('id-ID')}`}
                                        </TableCell>
                                        <TableCell>
                                            <span className="payrollMutedText">{kpi.description || '-'}</span>
                                        </TableCell>
                                        {canManagePayroll && (
                                            <TableActionCell>
                                                <TableActionMenu>
                                                    <TableActionMenuItem icon={Edit} onClick={() => { setEditingKpi(kpi); setIsKpiModalOpen(true); }}>
                                                        Edit KPI
                                                    </TableActionMenuItem>
                                                    <TableActionMenuItem danger icon={Trash2} onClick={() => handleDeleteKpi(kpi.id)}>
                                                        Hapus KPI
                                                    </TableActionMenuItem>
                                                </TableActionMenu>
                                            </TableActionCell>
                                        )}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </DataTable>
            </OperationalTableCard>
        </TabsContent>

        {/* --- TAB 3: ESTIMATION CALCULATOR --- */}
        <TabsContent value="estimate">
            <OperationalTableCard className="payrollTableCard payrollEstimateCard">
                <div className="payrollTableToolbar">
                    <div className="flex flex-col gap-1">
                        <h2>Simulasi Payroll</h2>
                        <p>Estimasi take home pay dari gaji tetap, bonus KPI, potongan tetap, dan tagihan rutin.</p>
                    </div>
                    <div className="payrollMonthControl">
                        <span>Periode</span>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        />
                    </div>
                </div>

                <OperationalKpiGrid className="payrollEstimateMetrics">
                    <OperationalKpiCard
                        label="Biaya Tetap"
                        value={`Rp ${payrollFixedCost.toLocaleString('id-ID')}`}
                        tone="blue"
                    />
                    <OperationalKpiCard
                        label="Bonus KPI"
                        value={`Rp ${payrollBonusEstimate.toLocaleString('id-ID')}`}
                        tone="emerald"
                    />
                    <OperationalKpiCard
                        label="Tabungan Freelance"
                        value={`Rp ${totalFreelanceSavings.toLocaleString('id-ID')}`}
                        tone="violet"
                    />
                    <OperationalKpiCard
                        label="Tagihan Rutin"
                        value={`Rp ${totalUnpaidExpenses.toLocaleString('id-ID')}`}
                        tone="rose"
                    />
                    <OperationalKpiCard
                        label="Grand Total Estimasi"
                        value={`Rp ${(payrollTakeHomeEstimate + totalUnpaidExpenses).toLocaleString('id-ID')}`}
                        tone="amber"
                    />
                </OperationalKpiGrid>

                <DataTable
                    columns={['minmax(240px,1.4fr)', '140px', '140px', '130px', '120px', '140px', 'minmax(190px,1fr)', '120px', '110px', '140px', '170px']}
                    minWidth={1480}
                    rowMinHeight={76}
                    className="payrollDataTable payrollEstimateTable"
                >
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nama</TableHead>
                                <TableHead>Gaji Pokok</TableHead>
                                <TableHead>Tunjangan</TableHead>
                                <TableHead>Alat</TableHead>
                                <TableHead>Kuota</TableHead>
                                <TableHead>Potongan Tetap</TableHead>
                                <TableHead>Periode KPI</TableHead>
                                <TableHead className="text-center">Order</TableHead>
                                <TableHead className="text-center">Unit</TableHead>
                                <TableHead>Bonus</TableHead>
                                <TableHead className="text-right">Take Home Pay</TableHead>
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
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <TableText primary={user.name} secondary={user.role} />
                                        </TableCell>
                                        <TableCell className="payrollMoneyCell">Rp {basic.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="payrollMoneyCell">Rp {allowance.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="payrollMoneyCell">Rp {tool.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="payrollMoneyCell">Rp {quota.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="payrollMoneyCell isNegative">-Rp {deductions.toLocaleString('id-ID')}</TableCell>
                                        <TableCell>
                                            <TableText
                                                primary={periodString}
                                                secondary={(() => {
                                                    try {
                                                        if (user.activeKpis && user.activeKpis.length > 0 && user.activeKpis[0].target_field) {
                                                            const conf = JSON.parse(user.activeKpis[0].target_field);
                                                            if (conf.dateReference === 'lead_date') return 'Acuan: Tgl Leads';
                                                            if (conf.dateReference === 'closing_date') return 'Acuan: Tgl Closing';
                                                        }
                                                    } catch(e){}
                                                    return 'Acuan: Tgl Service';
                                                })()}
                                            />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <button
                                                type="button"
                                                className="payrollLinkButton"
                                                onClick={() => {
                                                    setDetailUser(user);
                                                    setIsDetailModalOpen(true);
                                                }}
                                            >
                                                {bonusStats.orders}
                                            </button>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <button
                                                type="button"
                                                className="payrollLinkButton"
                                                onClick={() => {
                                                    setDetailUser(user);
                                                    setIsDetailModalOpen(true);
                                                }}
                                            >
                                                {bonusStats.units}
                                            </button>
                                        </TableCell>
                                        <TableCell className="payrollMoneyCell isPositive">Rp {bonusStats.bonus.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="text-right payrollMoneyCell isTotal">
                                            Rp {total.toLocaleString('id-ID')}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </DataTable>
            </OperationalTableCard>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <SalaryModal />
      <KpiModal />
      <BulkEditModal />
      {isDetailModalOpen && <OrderDetailModal />}
    </OperationalPageShell>
  );
};

export default PayrollPage;
