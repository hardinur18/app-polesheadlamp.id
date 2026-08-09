import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, Users, Briefcase, Plus, Trash2, Edit,
  Search, Calculator, CheckCircle2, AlertCircle, RefreshCw,
  Archive, Send, History, Eye
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
import { Switch } from '@/app/components/ui/switch';
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
  MasterDataFieldNotice,
  MasterDataFormActions,
  MasterDataFormDialogContent,
  MasterDataFormField,
  MasterDataFormGrid,
  MasterDataFormHeader,
} from '@/app/components/ui/master-data-ui';
import { toast } from 'sonner';
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

export interface PayrollDeduction {
  id?: string;
  user_id: string;
  period_key: string;
  amount: number;
  note?: string;
  status?: 'active' | 'void';
  source_type?: 'manual' | 'debt' | 'adjustment';
  source_ref?: string;
  created_at?: string;
}

type PayrollRunStatus = 'locked' | 'posted' | 'void';

interface PayrollRun {
  id: string;
  period_key: string;
  period_label: string;
  cutoff_start: string;
  cutoff_end: string;
  employee_count: number;
  fixed_cost: number;
  bonus_total: number;
  fixed_deductions_total: number;
  period_deductions_total: number;
  recurring_expense_total: number;
  take_home_total: number;
  grand_total: number;
  status: PayrollRunStatus;
  operational_expense_id?: string | null;
  locked_at?: string | null;
  locked_by_name?: string | null;
  posted_at?: string | null;
  posted_by_name?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface PayrollRunItem {
  id?: string;
  payroll_run_id: string;
  user_id: string;
  employee_name: string;
  employee_role: string;
  basic_salary: number;
  allowance_fixed: number;
  tool_allowance: number;
  quota: number;
  fixed_deductions: number;
  period_deductions: number;
  bonus: number;
  take_home_pay: number;
  order_count: number;
  unit_count: number;
  kpi_period_label: string;
  kpi_snapshot?: Array<Record<string, any>>;
}

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
  const [periodDeductions, setPeriodDeductions] = useState<PayrollDeduction[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [payrollRunItems, setPayrollRunItems] = useState<PayrollRunItem[]>([]);
  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  const [technicianReports, setTechnicianReports] = useState<TechnicianDailyReport[]>([]);
  const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);

  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [isKpiModalOpen, setIsKpiModalOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<KPI | null>(null);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [selectedUserForSalary, setSelectedUserForSalary] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<any | null>(null);
  const [isPayrollRunDetailOpen, setIsPayrollRunDetailOpen] = useState(false);
  const [selectedPayrollRun, setSelectedPayrollRun] = useState<PayrollRun | null>(null);
  
  // Bulk Edit States
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isSalarySelectionMode, setIsSalarySelectionMode] = useState(false);
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
      setPeriodDeductions(resData.periodDeductionData || []);
      
      // Filter active expenses
      const activeExpenses = (resData.expenseData || []).filter((e: any) => e.status === 'active');
      setExpenses(activeExpenses);
      
      setTechnicianReports(resData.reportData || []);
      setAllowedUserIds(resData.allowedUserIds || []);

      setPayrollRuns((resData.payrollRunData || []) as PayrollRun[]);
      setPayrollRunItems((resData.payrollRunItemData || []) as PayrollRunItem[]);

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

  const handleSalarySelectionModeChange = (checked: boolean) => {
    setIsSalarySelectionMode(checked);
    if (!checked) setSelectedUserIds(new Set());
  };

  const getActivePeriodDeductions = (userId: string, periodKey = selectedMonth) => (
    periodDeductions.filter((item) => (
      item.user_id === userId
      && item.period_key === periodKey
      && (item.status || 'active') === 'active'
    ))
  );

  const getPeriodDeductionAmount = (userId: string, periodKey = selectedMonth) => (
    getActivePeriodDeductions(userId, periodKey).reduce((sum, item) => sum + Number(item.amount || 0), 0)
  );

  // --- Handlers: Salary Profile ---
  const handleSaveSalary = async (
    userId: string,
    basic: number,
    allowance: number,
    toolAllowance: number,
    quota: number,
    deductions: number,
    periodDeductionAmount: number,
    periodDeductionNote: string,
    selectedKpis: string[]
  ) => {
    if (!canManagePayroll) {
      toast.error('Anda hanya memiliki akses lihat payroll.');
      return;
    }

    try {
      setLoading(true);

      const headers = await getSessionBackedEdgeHeaders();
      const response = await fetch(buildMakeServerUrl('/payroll/salary'), {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          period_key: selectedMonth,
          basic_salary: basic,
          allowance_fixed: allowance,
          tool_allowance: toolAllowance,
          quota,
          deductions,
          period_deduction_amount: periodDeductionAmount,
          period_deduction_note: periodDeductionNote,
          selected_kpis: selectedKpis,
        }),
      });
      const responsePayload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responsePayload.error || 'Gagal menyimpan komponen gaji');

      toast.success("Data gaji berhasil disimpan");
      if (currentUser) {
        const targetUser = users.find(u => u.id === userId);
        logActivity(
          { id: currentUser.id, name: currentUser.name, role: currentUser.role },
          'UPDATE',
          'Payroll',
          `Memperbarui data gaji: ${targetUser?.name || userId}`,
          userId,
          { basic, allowance, period: selectedMonth, periodDeductionAmount }
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
      const headers = await getSessionBackedEdgeHeaders();
      const response = await fetch(buildMakeServerUrl('/payroll/kpis'), {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(kpi),
      });
      const responsePayload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responsePayload.error || 'Gagal menyimpan KPI');
      
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
        const headers = await getSessionBackedEdgeHeaders();
        const response = await fetch(buildMakeServerUrl(`/payroll/kpis/${id}`), {
            method: 'DELETE',
            headers,
        });
        const responsePayload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(responsePayload.error || 'Gagal menghapus KPI');
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

    const payrollFixedDeductions = combinedUserData.reduce((sum, user) => sum + (user.salaryProfile?.deductions || 0), 0);
    const payrollPeriodDeductions = combinedUserData.reduce((sum, user) => sum + getPeriodDeductionAmount(user.id), 0);
    const payrollTotalDeductions = payrollFixedDeductions + payrollPeriodDeductions;
    const payrollBonusEstimate = combinedUserData.reduce((sum, user) => sum + calculateBonus(user).bonus, 0);
    const payrollTakeHomeEstimate = payrollFixedCost + payrollBonusEstimate - payrollTotalDeductions;
    const configuredEmployees = combinedUserData.filter((user) => Boolean(user.salaryProfile)).length;

    const toDateKey = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const formatShortDate = (value?: string | null) => {
        if (!value) return '-';
        return new Date(value).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    const getPayrollKpiReferenceLabel = (user: any) => {
        try {
            if (user.activeKpis && user.activeKpis.length > 0 && user.activeKpis[0].target_field) {
                const conf = JSON.parse(user.activeKpis[0].target_field);
                if (conf.dateReference === 'lead_date') return 'Acuan: Tgl Leads';
                if (conf.dateReference === 'closing_date') return 'Acuan: Tgl Closing';
            }
        } catch(e){}
        return 'Acuan: Tgl Service';
    };

    const payrollSnapshotItems = combinedUserData.map((user) => {
        const basic = user.salaryProfile?.basic_salary || 0;
        const allowance = user.salaryProfile?.allowance_fixed || 0;
        const tool = user.salaryProfile?.tool_allowance || 0;
        const quota = user.salaryProfile?.quota || 0;
        const fixedDeduction = user.salaryProfile?.deductions || 0;
        const periodDeduction = getPeriodDeductionAmount(user.id);
        const bonusStats = calculateBonus(user);
        const takeHomePay = basic + allowance + tool + quota + bonusStats.bonus - fixedDeduction - periodDeduction;

        return {
            user_id: user.id,
            employee_name: user.name || '-',
            employee_role: user.role || '-',
            basic_salary: basic,
            allowance_fixed: allowance,
            tool_allowance: tool,
            quota,
            fixed_deductions: fixedDeduction,
            period_deductions: periodDeduction,
            bonus: Math.round(bonusStats.bonus),
            take_home_pay: Math.round(takeHomePay),
            order_count: bonusStats.orders,
            unit_count: bonusStats.units,
            kpi_period_label: periodString,
            kpi_snapshot: (user.activeKpis || []).map((kpi: KPI) => ({
                id: kpi.id,
                name: kpi.name,
                type: kpi.type,
                amount: kpi.amount,
                target_field: kpi.target_field || '',
            })),
        };
    });

    const currentPayrollRun = payrollRuns.find((run) => run.period_key === selectedMonth && run.status !== 'void') || null;
    const currentPayrollRunStatus = currentPayrollRun?.status || 'draft';
    const currentPayrollRunLabel = currentPayrollRunStatus === 'posted'
        ? 'Terkirim ke Biaya Operasional'
        : currentPayrollRunStatus === 'locked'
            ? 'Snapshot terkunci'
            : 'Belum dikunci';
    const selectedPayrollRunItems = selectedPayrollRun
        ? payrollRunItems.filter((item) => item.payroll_run_id === selectedPayrollRun.id)
        : [];

    const handleLockPayrollPeriod = async () => {
        if (!canManagePayroll) {
            toast.error('Anda hanya memiliki akses lihat payroll.');
            return;
        }
        if (payrollSnapshotItems.length === 0) {
            toast.error('Tidak ada data karyawan untuk dikunci.');
            return;
        }
        if (currentPayrollRun?.status === 'posted') {
            toast.error('Periode ini sudah terkirim ke Biaya Operasional. Snapshot tidak bisa ditimpa.');
            return;
        }

        try {
            setLoading(true);
            const runPayload = {
                period_key: selectedMonth,
                period_label: periodString,
                cutoff_start: toDateKey(cutoffStartCalc),
                cutoff_end: toDateKey(cutoffEndCalc),
                employee_count: payrollSnapshotItems.length,
                fixed_cost: payrollFixedCost,
                bonus_total: Math.round(payrollBonusEstimate),
                fixed_deductions_total: payrollFixedDeductions,
                period_deductions_total: payrollPeriodDeductions,
                recurring_expense_total: totalUnpaidExpenses,
                take_home_total: Math.round(payrollTakeHomeEstimate),
                grand_total: Math.round(payrollTakeHomeEstimate + totalUnpaidExpenses),
                status: 'locked' as PayrollRunStatus,
                notes: `Snapshot payroll ${periodString}`,
            };

            const headers = await getSessionBackedEdgeHeaders();
            const response = await fetch(buildMakeServerUrl('/payroll/runs'), {
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    run: runPayload,
                    items: payrollSnapshotItems,
                }),
            });

            const responsePayload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(responsePayload.error || 'Gagal mengunci snapshot payroll');

            toast.success(`Snapshot payroll ${selectedMonth} berhasil dikunci.`);
            if (currentUser) {
                logActivity(
                    { id: currentUser.id, name: currentUser.name, role: currentUser.role },
                    'CREATE',
                    'Payroll',
                    `Mengunci snapshot payroll periode ${selectedMonth}`,
                    responsePayload.run?.id || selectedMonth,
                    { period: selectedMonth, employee_count: payrollSnapshotItems.length }
                );
            }
            await fetchData();
        } catch (err: any) {
            toast.error(`Gagal mengunci payroll: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handlePostPayrollRun = async (run: PayrollRun | null) => {
        if (!canManagePayroll) {
            toast.error('Anda hanya memiliki akses lihat payroll.');
            return;
        }
        if (!run) {
            toast.error('Kunci snapshot periode ini dulu sebelum dikirim.');
            return;
        }
        if (Number(run.take_home_total || 0) <= 0) {
            toast.error('Total payroll periode ini masih Rp 0.');
            return;
        }

        try {
            setLoading(true);
            const headers = await getSessionBackedEdgeHeaders();
            const response = await fetch(buildMakeServerUrl(`/payroll/runs/${run.id}/post`), {
                method: 'POST',
                headers,
            });

            const responsePayload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(responsePayload.error || 'Gagal kirim payroll ke Biaya Operasional');

            toast.success(`Payroll ${run.period_key} berhasil dikirim ke Biaya Operasional.`);
            if (currentUser) {
                logActivity(
                    { id: currentUser.id, name: currentUser.name, role: currentUser.role },
                    'CREATE',
                    'Biaya Operasional',
                    `Mengirim payroll ${run.period_key} ke Biaya Operasional`,
                    responsePayload.operationalExpenseId || run.id,
                    { period: run.period_key, payroll_run_id: run.id }
                );
            }
            await fetchData();
        } catch (err: any) {
            toast.error(`Gagal kirim payroll: ${err.message}`);
        } finally {
            setLoading(false);
        }
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

    const PayrollRunDetailModal = () => {
        if (!selectedPayrollRun) return null;

        return (
            <Dialog open={isPayrollRunDetailOpen} onOpenChange={setIsPayrollRunDetailOpen}>
                <MasterDataFormDialogContent size="wide" className="payrollRunDetailDialog">
                    <MasterDataFormHeader
                        icon={History}
                        title={`Detail Payroll ${selectedPayrollRun.period_key}`}
                        description={`${selectedPayrollRun.period_label} • ${selectedPayrollRun.status === 'posted' ? 'Sudah masuk Biaya Operasional' : 'Snapshot terkunci'}`}
                    />

                    <MasterDataDialogBody compact>
                        <div className="payrollRunSummaryStrip">
                            <div>
                                <span>Karyawan</span>
                                <strong>{selectedPayrollRun.employee_count}</strong>
                            </div>
                            <div>
                                <span>Gaji & Tunjangan</span>
                                <strong>Rp {Number(selectedPayrollRun.fixed_cost || 0).toLocaleString('id-ID')}</strong>
                            </div>
                            <div>
                                <span>Bonus KPI</span>
                                <strong>Rp {Number(selectedPayrollRun.bonus_total || 0).toLocaleString('id-ID')}</strong>
                            </div>
                            <div>
                                <span>Potongan</span>
                                <strong>-Rp {Number((selectedPayrollRun.fixed_deductions_total || 0) + (selectedPayrollRun.period_deductions_total || 0)).toLocaleString('id-ID')}</strong>
                            </div>
                            <div>
                                <span>Take Home</span>
                                <strong>Rp {Number(selectedPayrollRun.take_home_total || 0).toLocaleString('id-ID')}</strong>
                            </div>
                        </div>

                        <DataTable
                            columns={['56px', 'minmax(220px,1.2fr)', '130px', '120px', '120px', '120px', '120px', '120px', '96px', '140px']}
                            minWidth={1180}
                            rowMinHeight={70}
                            className="payrollDataTable payrollRunItemsTable"
                        >
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="payrollTableIndexCell">No</TableHead>
                                        <TableHead>Karyawan</TableHead>
                                        <TableHead className="payrollNumericHeader">Gaji Pokok</TableHead>
                                        <TableHead className="payrollNumericHeader">Tunjangan</TableHead>
                                        <TableHead className="payrollNumericHeader">Potongan</TableHead>
                                        <TableHead className="payrollNumericHeader">Kasbon</TableHead>
                                        <TableHead className="payrollNumericHeader">Bonus</TableHead>
                                        <TableHead className="text-center">Order</TableHead>
                                        <TableHead className="text-center">Unit</TableHead>
                                        <TableHead className="payrollNumericHeader">Take Home</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedPayrollRunItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={10}>
                                                <OperationalEmptyState
                                                    icon={AlertCircle}
                                                    title="Snapshot kosong"
                                                    description="Item payroll periode ini belum tersimpan."
                                                    className="py-10"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        selectedPayrollRunItems.map((item, index) => (
                                            <TableRow key={item.id || item.user_id}>
                                                <TableCell className="payrollTableIndexCell">{index + 1}</TableCell>
                                                <TableCell>
                                                    <TableText primary={item.employee_name} secondary={item.employee_role} />
                                                </TableCell>
                                                <TableCell className="payrollMoneyCell">Rp {Number(item.basic_salary || 0).toLocaleString('id-ID')}</TableCell>
                                                <TableCell className="payrollMoneyCell">Rp {Number((item.allowance_fixed || 0) + (item.tool_allowance || 0) + (item.quota || 0)).toLocaleString('id-ID')}</TableCell>
                                                <TableCell className="payrollMoneyCell isNegative">{item.fixed_deductions ? `-Rp ${Number(item.fixed_deductions).toLocaleString('id-ID')}` : '-'}</TableCell>
                                                <TableCell className="payrollMoneyCell isNegative">{item.period_deductions ? `-Rp ${Number(item.period_deductions).toLocaleString('id-ID')}` : '-'}</TableCell>
                                                <TableCell className="payrollMoneyCell isPositive">Rp {Number(item.bonus || 0).toLocaleString('id-ID')}</TableCell>
                                                <TableCell className="text-center">{item.order_count || 0}</TableCell>
                                                <TableCell className="text-center">{item.unit_count || 0}</TableCell>
                                                <TableCell className="payrollMoneyCell isTotal">Rp {Number(item.take_home_pay || 0).toLocaleString('id-ID')}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </DataTable>
                    </MasterDataDialogBody>

                    <div className="masterDataFormActions payrollDetailActions">
                        <div className="payrollDetailTotal">
                            <span>Status</span>
                            <Badge variant="outline" className={cn('payrollRunStatusBadge', selectedPayrollRun.status)}>
                                {selectedPayrollRun.status === 'posted' ? 'Posted' : 'Locked'}
                            </Badge>
                        </div>
                        <div className="payrollRunDetailActions">
                            <Button variant="outline" onClick={() => setIsPayrollRunDetailOpen(false)}>Tutup</Button>
                            {canManagePayroll && (
                                <Button
                                    type="button"
                                    onClick={() => handlePostPayrollRun(selectedPayrollRun)}
                                    disabled={loading}
                                >
                                    <Send className="h-4 w-4" />
                                    {selectedPayrollRun.status === 'posted' ? 'Sinkron Ulang' : 'Kirim ke Biaya Operasional'}
                                </Button>
                            )}
                        </div>
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

    const [updatePeriodDeduction, setUpdatePeriodDeduction] = useState(false);
    const [periodDeduction, setPeriodDeduction] = useState(0);
    const [periodDeductionNote, setPeriodDeductionNote] = useState('');

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
            updatePeriodDeduction,
            periodDeduction: {
                amount: periodDeduction,
                note: periodDeductionNote,
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

            const headers = await getSessionBackedEdgeHeaders();
            const response = await fetch(buildMakeServerUrl('/payroll/salary/bulk'), {
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_ids: userIds,
                    period_key: selectedMonth,
                    update_salary: payload.updateSalary,
                    salary: payload.salary,
                    update_period_deduction: payload.updatePeriodDeduction,
                    period_deduction: payload.periodDeduction,
                    update_kpi: payload.updateKpi,
                    kpi: payload.kpi,
                }),
            });
            const responsePayload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(responsePayload.error || 'Gagal update massal payroll');

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
                            <div className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
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
                            <div className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
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
                            <div className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
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
                            <div className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
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
                                    <Label className={!updateDeduction ? 'text-slate-400' : 'text-red-700'}>Potongan Tetap Semua Periode</Label>
                                    <CurrencyInput 
                                        disabled={!updateDeduction} 
                                        value={deduction} 
                                        onChange={setDeduction}
                                        placeholder="0"
                                        className="border-red-200 focus:ring-red-500"
                                    />
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 border border-amber-100 bg-amber-50/30 rounded-lg hover:bg-amber-50/60 transition-colors">
                                <Checkbox checked={updatePeriodDeduction} onCheckedChange={(c) => setUpdatePeriodDeduction(!!c)} className="mt-1 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600" />
                                <div className="flex-1 space-y-2">
                                    <Label className={!updatePeriodDeduction ? 'text-slate-400' : 'text-amber-800'}>Kasbon Khusus Periode {selectedMonth}</Label>
                                    <CurrencyInput
                                        disabled={!updatePeriodDeduction}
                                        value={periodDeduction}
                                        onChange={setPeriodDeduction}
                                        placeholder="0"
                                        className="border-amber-200 focus:ring-amber-500"
                                    />
                                    <Input
                                        disabled={!updatePeriodDeduction}
                                        value={periodDeductionNote}
                                        onChange={(event) => setPeriodDeductionNote(event.target.value)}
                                        placeholder="Catatan kasbon periode ini"
                                        className="text-sm"
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
                            <div className="border border-slate-200 rounded-xl h-[200px] overflow-y-auto p-3 space-y-2 bg-slate-50/50 custom-scrollbar">
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
    const [periodDeduction, setPeriodDeduction] = useState(0);
    const [periodDeductionNote, setPeriodDeductionNote] = useState('');
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
            const manualPeriodDeduction = periodDeductions.find((item) => (
                item.user_id === selectedUserForSalary.id
                && item.period_key === selectedMonth
                && (item.status || 'active') === 'active'
                && item.source_type === 'manual'
            ));
            setPeriodDeduction(Number(manualPeriodDeduction?.amount || 0));
            setPeriodDeductionNote(manualPeriodDeduction?.note || '');
            setSelectedKpis(new Set(userAssignments.map(a => a.kpi_id)));
        }
    }, [selectedUserForSalary, salaryProfiles, assignments, periodDeductions, selectedMonth]);

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
                    handleSaveSalary(
                      selectedUserForSalary.id,
                      basic,
                      allowance,
                      toolAllowance,
                      quota,
                      deductions,
                      periodDeduction,
                      periodDeductionNote,
                      Array.from(selectedKpis)
                    );
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
                                <MasterDataFieldLabel
                                    optional
                                    info={{
                                        title: 'Tunjangan',
                                        description: 'Tambahan tetap seperti makan, transport, atau komponen allowance rutin.',
                                    }}
                                >
                                    Tunjangan
                                </MasterDataFieldLabel>
                                <CurrencyInput 
                                    value={allowance} 
                                    onChange={setAllowance}
                                    className="font-mono bg-slate-50 border-slate-200 focus:border-orange-500 focus:ring-orange-500"
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <MasterDataFieldLabel
                                    optional
                                    info={{
                                        title: 'Tunjangan Alat',
                                        description: 'Kompensasi rutin untuk pemakaian atau sewa alat pribadi.',
                                    }}
                                >
                                    Tunjangan Alat
                                </MasterDataFieldLabel>
                                <CurrencyInput 
                                    value={toolAllowance} 
                                    onChange={setToolAllowance}
                                    className="font-mono bg-slate-50 border-slate-200 focus:border-orange-500 focus:ring-orange-500"
                                    placeholder="0"
                                />
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
                                <MasterDataFieldLabel optional>
                                    <span className="inline-flex items-center gap-1.5">
                                        Potongan Tetap
                                        <MasterDataFieldNotice
                                            title="Potongan tetap"
                                            description="Nominal ini berlaku permanen untuk semua periode payroll sampai diubah lagi."
                                        />
                                    </span>
                                </MasterDataFieldLabel>
                                <CurrencyInput 
                                    value={deductions} 
                                    onChange={setDeductions}
                                    className="font-mono bg-red-50 border-red-200 focus:border-red-500 focus:ring-red-500 text-red-700"
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2 col-span-2">
                                <MasterDataFieldLabel optional>
                                    <span className="inline-flex items-center gap-1.5">
                                        Kasbon Periode {selectedMonth}
                                        <MasterDataFieldNotice
                                            title="Kasbon periode"
                                            description={`Hanya dihitung untuk periode ${selectedMonth}. Tidak terbawa otomatis ke bulan lain.`}
                                        />
                                    </span>
                                </MasterDataFieldLabel>
                                <CurrencyInput
                                    value={periodDeduction}
                                    onChange={setPeriodDeduction}
                                    className="font-mono bg-amber-50 border-amber-200 focus:border-amber-500 focus:ring-amber-500 text-amber-800"
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2 col-span-2">
                                <MasterDataFieldLabel optional>Catatan Kasbon</MasterDataFieldLabel>
                                <Input
                                    value={periodDeductionNote}
                                    onChange={(event) => setPeriodDeductionNote(event.target.value)}
                                    placeholder="Contoh: kasbon 10 Agustus, cicilan alat, atau penyesuaian"
                                    className="bg-slate-50 border-slate-200"
                                />
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
                            <div className="flex justify-between items-center text-amber-700/90">
                                <p className="text-xs font-semibold uppercase tracking-wider">Kasbon Periode</p>
                                <p className="text-sm font-bold font-mono">
                                    - Rp {periodDeduction.toLocaleString('id-ID')}
                                </p>
                            </div>
                            <div className="border-t border-orange-200/50 pt-2 flex justify-between items-center">
                                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Net Fixed Pay</p>
                                <p className="text-xl font-bold font-mono text-slate-800">
                                    Rp {(basic + allowance + toolAllowance + quota - deductions - periodDeduction).toLocaleString('id-ID')}
                                </p>
                            </div>
                            <p className="text-[10px] text-orange-600/70 dark:text-orange-400/70 mt-1">
                                *Nominal bersih sebelum bonus KPI periode berjalan
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

                        <div className="border border-slate-200 rounded-xl h-[380px] overflow-y-auto p-3 space-y-2 bg-slate-50/50 dark:bg-slate-900/20 custom-scrollbar">
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
          description={`${configuredEmployees} profil gaji terisi`}
          tone="blue"
        />
        <OperationalKpiCard
          icon={DollarSign}
          label="Gaji & Tunjangan"
          value={`Rp ${payrollFixedCost.toLocaleString('id-ID')}`}
          valueTitle={`Rp ${payrollFixedCost.toLocaleString('id-ID')}`}
          description="Fixed cost payroll"
          tone="emerald"
        />
        <OperationalKpiCard
          icon={Briefcase}
          label="KPI Terpasang"
          value={`${assignments.length} penugasan`}
          description={`${kpis.length} KPI aktif`}
          tone="violet"
        />
        <OperationalKpiCard
          icon={Calculator}
          label="Estimasi Take Home"
          value={`Rp ${payrollTakeHomeEstimate.toLocaleString('id-ID')}`}
          valueTitle={`Rp ${payrollTakeHomeEstimate.toLocaleString('id-ID')}`}
          description="Setelah potongan dan kasbon"
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
            <TabsTrigger value="history">
                <History className="w-4 h-4 mr-2" /> History Payroll
            </TabsTrigger>
          </TabsList>
          <div className="payrollTabsMeta">
            <span>{configuredEmployees} dari {combinedUserData.length} profil gaji terisi</span>
            <span>Potongan tetap: Rp {payrollFixedDeductions.toLocaleString('id-ID')}</span>
            <span>Kasbon periode: Rp {payrollPeriodDeductions.toLocaleString('id-ID')}</span>
          </div>
        </OperationalFilterPanel>

        {/* --- TAB 1: SALARY PROFILES --- */}
        <TabsContent value="salary">
            <OperationalTableCard className="payrollTableCard">
                <div className="payrollTableToolbar">
                    <div className="flex flex-col gap-1">
                        <h2>Daftar Gaji Karyawan</h2>
                        <p>Atur gaji pokok, tunjangan, potongan tetap, dan KPI aktif per karyawan.</p>
                    </div>
                    <div className="payrollTableToolbarActions">
                        {canManagePayroll && (
                            <label className="payrollSelectionSwitch">
                                <Switch
                                    checked={isSalarySelectionMode}
                                    onCheckedChange={handleSalarySelectionModeChange}
                                />
                                <span>Pilih baris</span>
                            </label>
                        )}
                        <div className="payrollSearchField">
                            <Search className="w-4 h-4 text-slate-400 absolute ml-3" />
                            <Input
                                placeholder="Cari nama atau role..."
                                className="pl-9 bg-slate-50 border-slate-200 focus:ring-orange-500 focus:border-orange-500"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                {canManagePayroll && isSalarySelectionMode && (
                    <div className="payrollSelectionBar animate-in fade-in slide-in-from-top-2">
                        <div>
                            <strong>{selectedUserIds.size} dipilih</strong>
                            <span>{combinedUserData.length} data aktif di halaman ini</span>
                        </div>
                        <div className="payrollSelectionActions">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleSelectAll(selectedUserIds.size !== combinedUserData.length)}
                            >
                                {selectedUserIds.size === combinedUserData.length ? 'Batalkan semua' : 'Pilih semua'}
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => setIsBulkModalOpen(true)}
                                disabled={selectedUserIds.size === 0}
                                className="bg-slate-900 text-white hover:bg-slate-800"
                            >
                                <Edit className="w-3.5 h-3.5 mr-1.5" />
                                Edit Massal
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedUserIds(new Set())}
                                disabled={selectedUserIds.size === 0}
                            >
                                Bersihkan
                            </Button>
                        </div>
                    </div>
                )}
                <div className="p-0">
                    <DataTable
                        columns={[
                          canManagePayroll && isSalarySelectionMode && '44px',
                          '56px',
                          '220px',
                          '112px',
                          '128px',
                          '122px',
                          '136px',
                          '100px',
                          '142px',
                          '146px',
                          '210px',
                          canManagePayroll && '84px',
                        ]}
                        minWidth={canManagePayroll ? 1500 : 1360}
                        rowMinHeight={76}
                        className="payrollDataTable"
                    >
                    <Table>
                        <TableHeader>
                            <TableRow className="border-slate-100 dark:border-slate-800">
                                {canManagePayroll && isSalarySelectionMode && (
                                <TableHead className="payrollSelectCell">
                                    <Checkbox 
                                        checked={selectedUserIds.size === combinedUserData.length && combinedUserData.length > 0}
                                        onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                                    />
                                </TableHead>
                                )}
                                <TableHead className="payrollTableIndexCell">No</TableHead>
                                <TableHead>Nama Karyawan</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead className="payrollNumericHeader">Gaji Pokok</TableHead>
                                <TableHead className="payrollNumericHeader">Tunjangan</TableHead>
                                <TableHead className="payrollNumericHeader">Tunjangan Alat</TableHead>
                                <TableHead className="payrollNumericHeader">Kuota</TableHead>
                                <TableHead className="payrollNumericHeader">Potongan Tetap</TableHead>
                                <TableHead className="payrollNumericHeader">Kasbon Periode</TableHead>
                                <TableHead>KPI Aktif</TableHead>
                                {canManagePayroll && <TableActionHeader>Aksi</TableActionHeader>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {combinedUserData.map((user, index) => {
                              const periodDeductionAmount = getPeriodDeductionAmount(user.id);

                              return (
                                <TableRow key={user.id} className={cn(
                                    "hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-colors border-b border-slate-100 dark:border-slate-800",
                                    isSalarySelectionMode && selectedUserIds.has(user.id) ? "bg-orange-50/40" : ""
                                )}>
                                    {canManagePayroll && isSalarySelectionMode && (
                                    <TableCell className="payrollSelectCell">
                                        <Checkbox 
                                            checked={selectedUserIds.has(user.id)}
                                            onCheckedChange={() => toggleSelectUser(user.id)}
                                        />
                                    </TableCell>
                                    )}
                                    <TableCell className="payrollTableIndexCell">
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
                                    <TableCell className="payrollMoneyCell isNegative">
                                        {periodDeductionAmount ? `-Rp ${periodDeductionAmount.toLocaleString('id-ID')}` : '-'}
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
                              );
                            })}
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
                    columns={['56px', '320px', '178px', '150px', '280px', canManagePayroll && '84px']}
                    minWidth={canManagePayroll ? 1060 : 960}
                    rowMinHeight={72}
                    className="payrollDataTable"
                >
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="payrollTableIndexCell">No</TableHead>
                                <TableHead>Nama KPI</TableHead>
                                <TableHead>Tipe Hitungan</TableHead>
                                <TableHead className="payrollNumericHeader">Nominal</TableHead>
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
                                        <TableCell className="payrollTableIndexCell">{index + 1}</TableCell>
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
                        <p>Estimasi take home pay dari gaji tetap, bonus KPI, potongan, kasbon periode, dan tagihan rutin.</p>
                    </div>
                    <div className="payrollEstimateToolbarActions">
                        <Badge variant="outline" className={cn('payrollRunStatusBadge', currentPayrollRunStatus)}>
                            {currentPayrollRunLabel}
                        </Badge>
                        <div className="payrollMonthControl">
                            <span>Periode</span>
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                            />
                        </div>
                        {canManagePayroll && (
                            <div className="payrollEstimateActions">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleLockPayrollPeriod}
                                    disabled={loading || currentPayrollRun?.status === 'posted'}
                                >
                                    <Archive className="h-4 w-4" />
                                    {currentPayrollRun?.status === 'locked' ? 'Update Snapshot' : 'Kunci Periode'}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => handlePostPayrollRun(currentPayrollRun)}
                                    disabled={loading || !currentPayrollRun || payrollTakeHomeEstimate <= 0}
                                >
                                    <Send className="h-4 w-4" />
                                    Kirim ke Biaya Operasional
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <OperationalKpiGrid className="payrollEstimateMetrics">
                    <OperationalKpiCard
                        label="Biaya Tetap"
                        value={`Rp ${payrollFixedCost.toLocaleString('id-ID')}`}
                        valueTitle={`Rp ${payrollFixedCost.toLocaleString('id-ID')}`}
                        description="Gaji, tunjangan, kuota"
                        icon={DollarSign}
                        tone="blue"
                    />
                    <OperationalKpiCard
                        label="Bonus KPI"
                        value={`Rp ${payrollBonusEstimate.toLocaleString('id-ID')}`}
                        valueTitle={`Rp ${payrollBonusEstimate.toLocaleString('id-ID')}`}
                        description="Dari order periode ini"
                        icon={Calculator}
                        tone="emerald"
                    />
                    <OperationalKpiCard
                        label="Tabungan Freelance"
                        value={`Rp ${totalFreelanceSavings.toLocaleString('id-ID')}`}
                        valueTitle={`Rp ${totalFreelanceSavings.toLocaleString('id-ID')}`}
                        description="Hold komisi teknisi"
                        icon={Briefcase}
                        tone="violet"
                    />
                    <OperationalKpiCard
                        label="Tagihan Rutin"
                        value={`Rp ${totalUnpaidExpenses.toLocaleString('id-ID')}`}
                        valueTitle={`Rp ${totalUnpaidExpenses.toLocaleString('id-ID')}`}
                        description="Belum dibayar"
                        icon={AlertCircle}
                        tone="rose"
                    />
                    <OperationalKpiCard
                        label="Grand Total Estimasi"
                        value={`Rp ${(payrollTakeHomeEstimate + totalUnpaidExpenses).toLocaleString('id-ID')}`}
                        valueTitle={`Rp ${(payrollTakeHomeEstimate + totalUnpaidExpenses).toLocaleString('id-ID')}`}
                        description="Payroll + tagihan"
                        icon={CheckCircle2}
                        tone="amber"
                    />
                </OperationalKpiGrid>

                <DataTable
                    columns={['56px', '210px', '126px', '122px', '108px', '100px', '138px', '138px', '184px', '88px', '82px', '126px', '164px']}
                    minWidth={1642}
                    rowMinHeight={76}
                    className="payrollDataTable payrollEstimateTable"
                >
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="payrollTableIndexCell">No</TableHead>
                                <TableHead>Nama</TableHead>
                                <TableHead className="payrollNumericHeader">Gaji Pokok</TableHead>
                                <TableHead className="payrollNumericHeader">Tunjangan</TableHead>
                                <TableHead className="payrollNumericHeader">Alat</TableHead>
                                <TableHead className="payrollNumericHeader">Kuota</TableHead>
                                <TableHead className="payrollNumericHeader">Potongan Tetap</TableHead>
                                <TableHead className="payrollNumericHeader">Kasbon</TableHead>
                                <TableHead>Periode KPI</TableHead>
                                <TableHead className="text-center">Order</TableHead>
                                <TableHead className="text-center">Unit</TableHead>
                                <TableHead className="payrollNumericHeader">Bonus</TableHead>
                                <TableHead className="payrollNumericHeader">Take Home Pay</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {combinedUserData.map((user, index) => {
                                const basic = user.salaryProfile?.basic_salary || 0;
                                const allowance = user.salaryProfile?.allowance_fixed || 0;
                                const tool = user.salaryProfile?.tool_allowance || 0;
                                const quota = user.salaryProfile?.quota || 0;
                                const deductions = user.salaryProfile?.deductions || 0;
                                const periodDeduction = getPeriodDeductionAmount(user.id);
                                const bonusStats = calculateBonus(user);
                                const total = basic + allowance + tool + quota + bonusStats.bonus - deductions - periodDeduction;

                                return (
                                    <TableRow key={user.id}>
                                        <TableCell className="payrollTableIndexCell">{index + 1}</TableCell>
                                        <TableCell>
                                            <TableText primary={user.name} secondary={user.role} />
                                        </TableCell>
                                        <TableCell className="payrollMoneyCell">Rp {basic.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="payrollMoneyCell">Rp {allowance.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="payrollMoneyCell">Rp {tool.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="payrollMoneyCell">Rp {quota.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="payrollMoneyCell isNegative">{deductions ? `-Rp ${deductions.toLocaleString('id-ID')}` : '-'}</TableCell>
                                        <TableCell className="payrollMoneyCell isNegative">{periodDeduction ? `-Rp ${periodDeduction.toLocaleString('id-ID')}` : '-'}</TableCell>
                                        <TableCell>
                                            <TableText
                                                primary={periodString}
                                                secondary={getPayrollKpiReferenceLabel(user)}
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

        {/* --- TAB 4: PAYROLL HISTORY --- */}
        <TabsContent value="history">
            <OperationalTableCard className="payrollTableCard">
                <div className="payrollTableToolbar">
                    <div className="flex flex-col gap-1">
                        <h2>History Payroll</h2>
                        <p>Arsip snapshot payroll per periode dan status pengiriman ke Biaya Operasional.</p>
                    </div>
                    {canManagePayroll && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleLockPayrollPeriod}
                            disabled={loading || currentPayrollRun?.status === 'posted'}
                        >
                            <Archive className="h-4 w-4" />
                            Kunci Periode Ini
                        </Button>
                    )}
                </div>

                <DataTable
                    columns={['56px', '180px', '140px', '116px', '146px', '146px', '146px', '146px', '150px', '96px']}
                    minWidth={1320}
                    rowMinHeight={76}
                    className="payrollDataTable payrollHistoryTable"
                >
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="payrollTableIndexCell">No</TableHead>
                                <TableHead>Periode</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-center">Karyawan</TableHead>
                                <TableHead className="payrollNumericHeader">Gaji</TableHead>
                                <TableHead className="payrollNumericHeader">Bonus</TableHead>
                                <TableHead className="payrollNumericHeader">Potongan</TableHead>
                                <TableHead className="payrollNumericHeader">Take Home</TableHead>
                                <TableHead>Diproses</TableHead>
                                <TableActionHeader>Aksi</TableActionHeader>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payrollRuns.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={10}>
                                        <OperationalEmptyState
                                            icon={History}
                                            title="Belum ada history payroll"
                                            description="Kunci snapshot dari tab Kalkulator Estimasi untuk membuat arsip periode."
                                            className="py-12"
                                        />
                                    </TableCell>
                                </TableRow>
                            ) : (
                                payrollRuns.map((run, index) => {
                                    const totalDeduction = Number(run.fixed_deductions_total || 0) + Number(run.period_deductions_total || 0);

                                    return (
                                        <TableRow key={run.id}>
                                            <TableCell className="payrollTableIndexCell">{index + 1}</TableCell>
                                            <TableCell>
                                                <TableText
                                                    primary={run.period_key}
                                                    secondary={run.period_label || `${formatShortDate(run.cutoff_start)} - ${formatShortDate(run.cutoff_end)}`}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn('payrollRunStatusBadge', run.status)}>
                                                    {run.status === 'posted' ? 'Posted' : 'Locked'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">{run.employee_count}</TableCell>
                                            <TableCell className="payrollMoneyCell">Rp {Number(run.fixed_cost || 0).toLocaleString('id-ID')}</TableCell>
                                            <TableCell className="payrollMoneyCell isPositive">Rp {Number(run.bonus_total || 0).toLocaleString('id-ID')}</TableCell>
                                            <TableCell className="payrollMoneyCell isNegative">{totalDeduction ? `-Rp ${totalDeduction.toLocaleString('id-ID')}` : '-'}</TableCell>
                                            <TableCell className="payrollMoneyCell isTotal">Rp {Number(run.take_home_total || 0).toLocaleString('id-ID')}</TableCell>
                                            <TableCell>
                                                <TableText
                                                    primary={run.status === 'posted' ? formatShortDate(run.posted_at) : formatShortDate(run.locked_at)}
                                                    secondary={run.status === 'posted' ? (run.posted_by_name || '-') : (run.locked_by_name || '-')}
                                                />
                                            </TableCell>
                                            <TableActionCell>
                                                <TableActionMenu>
                                                    <TableActionMenuItem
                                                        icon={Eye}
                                                        onClick={() => {
                                                            setSelectedPayrollRun(run);
                                                            setIsPayrollRunDetailOpen(true);
                                                        }}
                                                    >
                                                        Lihat Detail
                                                    </TableActionMenuItem>
                                                    {canManagePayroll && (
                                                        <TableActionMenuItem
                                                            icon={Send}
                                                            onClick={() => handlePostPayrollRun(run)}
                                                        >
                                                            {run.status === 'posted' ? 'Sinkron Ulang' : 'Kirim ke Biaya Operasional'}
                                                        </TableActionMenuItem>
                                                    )}
                                                </TableActionMenu>
                                            </TableActionCell>
                                        </TableRow>
                                    );
                                })
                            )}
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
      {isPayrollRunDetailOpen && <PayrollRunDetailModal />}
    </OperationalPageShell>
  );
};

export default PayrollPage;
