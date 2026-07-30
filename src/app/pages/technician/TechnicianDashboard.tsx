import React, { useMemo, useState } from 'react';
import { useMasterData } from '../master-data/context';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Star,
  Wrench,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DateRange } from 'react-day-picker';
import {
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import { id } from 'date-fns/locale';
import { DatePickerWithRange } from '../../components/ui/date-range-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { usePermissions } from '@/app/hooks/usePermissions';
import { isTechnicianRole } from '@/app/data/roleHelpers';
import {
  OperationalEmptyState,
  OperationalKpiCard,
  OperationalKpiGrid,
  OperationalPageHeader,
  OperationalPageShell,
  OperationalTableCard,
} from '@/app/components/ui/operational-page';

export function TechnicianDashboard({ userId }: { userId?: string }) {
  const { currentUser, orders, users } = useMasterData();
  const { hasPermission } = usePermissions();

  // Internal selection state for Owner viewing this dashboard.
  const isOwner = hasPermission('dashboard.view_owner');
  const [selectedTechId, setSelectedTechId] = useState<string>(userId || 'all');

  React.useEffect(() => {
    if (userId) setSelectedTechId(userId);
  }, [userId]);

  const targetId = useMemo(() => {
    if (isOwner) {
      return selectedTechId === 'all' ? undefined : selectedTechId;
    }
    return userId || currentUser?.id;
  }, [isOwner, selectedTechId, userId, currentUser]);

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Reset pagination when date range changes
  useMemo(() => {
    setCurrentPage(1);
  }, [dateRange]);

  // Filter Orders for Current Technician & Date Range
  const myOrders = useMemo(() => {
    if (!isOwner && !targetId) return [];

    return orders.filter(o => {
      if (targetId && o.technicianId !== targetId) return false;

      if (!dateRange?.from) return true;
      const orderDate = parseISO(o.serviceDate);
      const start = startOfDay(dateRange.from);
      const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);

      return isWithinInterval(orderDate, { start, end });
    });
  }, [orders, currentUser, dateRange, targetId, isOwner]);

  // Stats Calculation
  const stats = useMemo(() => {
    const completed = myOrders.filter(o => ['done', 'completed', 'teknisi_completed'].includes(o.status));
    const cancelled = myOrders.filter(o => ['cancelled', 'batal'].includes(o.status));
    const issues = myOrders.filter(o => o.notes?.toLowerCase().includes('kendala'));

    const scheduled = myOrders.filter(o =>
      ['pending', 'waiting', 'reschedule', 'processing', 'working', 'otw', 'qc'].includes(o.status)
    );

    const completedUnits = completed.reduce((acc, o) => acc + (o.units || 1), 0);
    const scheduledUnits = scheduled.reduce((acc, o) => acc + (o.units || 1), 0);

    const ratings = completed.map(o => o.rating || 5).filter(r => r > 0);
    const avgRating = ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : '5.0';

    return {
      completedCount: completed.length,
      completedUnits,
      scheduledCount: scheduled.length,
      scheduledUnits,
      cancelledCount: cancelled.length,
      issueCount: issues.length,
      rating: avgRating,
    };
  }, [myOrders]);

  // Chart Data: Status Trend
  const trendData = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];

    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayOrders = myOrders.filter(o => o.serviceDate === dayStr);

      const selesai = dayOrders.filter(o => ['done', 'completed', 'teknisi_completed'].includes(o.status)).length;
      const terjadwal = dayOrders.filter(o => ['pending', 'waiting', 'reschedule'].includes(o.status)).length;
      const proses = dayOrders.filter(o => ['processing', 'working', 'otw', 'qc'].includes(o.status)).length;
      const batal = dayOrders.filter(o => ['cancelled', 'batal'].includes(o.status)).length;

      return {
        date: format(day, 'd MMM'),
        fullDate: dayStr,
        Selesai: selesai,
        Terjadwal: terjadwal,
        Proses: proses,
        Batal: batal,
      };
    });
  }, [myOrders, dateRange]);

  // Chart Data: Status Distribution
  const statusDistData = useMemo(() => {
    const counts: Record<string, number> = {};
    myOrders.forEach(o => {
      let s: string = o.status;
      if (['done', 'completed', 'teknisi_completed'].includes(s)) s = 'Selesai';
      else if (['pending', 'waiting'].includes(s)) s = 'Terjadwal';
      else if (['processing', 'working', 'otw'].includes(s)) s = 'Proses';
      else if (['cancelled', 'batal'].includes(s)) s = 'Batal';
      else s = 'Lainnya';

      counts[s] = (counts[s] || 0) + 1;
    });

    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [myOrders]);

  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#6B7280'];

  // Table Data: Daily Detail
  const dailyReport = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];

    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayOrders = myOrders.filter(o => o.serviceDate === dayStr);

      return {
        date: format(day, 'd MMM yyyy', { locale: id }),
        total: dayOrders.length,
        scheduled: dayOrders.filter(o => ['pending', 'waiting'].includes(o.status)).length,
        otw: dayOrders.filter(o => ['otw'].includes(o.effectiveStatus || o.status)).length,
        working: dayOrders.filter(o => ['working', 'processing'].includes(o.effectiveStatus || o.status)).length,
        qc: dayOrders.filter(o => ['qc'].includes(o.effectiveStatus || o.status)).length,
        done: dayOrders.filter(o => ['done', 'completed'].includes(o.status)).length,
        cancelled: dayOrders.filter(o => ['cancelled'].includes(o.status)).length,
      };
    });
  }, [myOrders, dateRange]);

  // Pagination Logic
  const totalPages = Math.ceil(dailyReport.length / itemsPerPage);
  const paginatedData = dailyReport.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <OperationalPageShell>
      <OperationalPageHeader
        eyebrow="Dashboard"
        icon={Wrench}
        title="Teknisi View"
        subtitle={`Halo, ${currentUser?.name || 'Teknisi'}. Berikut ringkasan aktivitas teknisi.`}
        actions={(
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {isOwner && (
              <Select value={selectedTechId} onValueChange={setSelectedTechId}>
                <SelectTrigger className="h-9 w-full bg-white text-sm dark:bg-slate-900 sm:w-[220px]">
                  <SelectValue placeholder="Pilih Teknisi" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-800">
                  <SelectItem value="all">Semua Teknisi</SelectItem>
                  {users
                    .filter(u => isTechnicianRole(u.role) && u.status === 'active')
                    .map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
            <DatePickerWithRange date={dateRange} setDate={setDateRange} />
          </div>
        )}
      />

      <OperationalKpiGrid>
        <OperationalKpiCard
          label="Pekerjaan Selesai"
          value={(
            <div className="leading-tight">
              <span>{stats.completedCount} Order</span>
              <span className="mt-1 block text-sm font-medium text-slate-500">({stats.completedUnits} Unit)</span>
            </div>
          )}
          icon={CheckCircle2}
          tone="blue"
        />
        <OperationalKpiCard
          label="Pekerjaan Terjadwal"
          value={(
            <div className="leading-tight">
              <span>{stats.scheduledCount} Order</span>
              <span className="mt-1 block text-sm font-medium text-slate-500">({stats.scheduledUnits} Unit)</span>
            </div>
          )}
          icon={Clock}
          tone="emerald"
        />
        <OperationalKpiCard
          label="Kendala / Batal"
          value={`${stats.cancelledCount + stats.issueCount} Kasus`}
          icon={AlertTriangle}
          tone="amber"
        />
        <OperationalKpiCard
          label="Rating Kinerja"
          value={`${stats.rating} / 5.0`}
          icon={Star}
          tone="violet"
        />
      </OperationalKpiGrid>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <OperationalTableCard className="lg:col-span-2">
          <div className="border-b border-slate-100 p-4">
            <h2 className="text-base font-semibold text-slate-900">Grafik Status Harian</h2>
            <p className="mt-1 text-xs text-slate-500">Aktivitas pekerjaan berdasarkan status.</p>
          </div>
          <div className="p-4 pl-0">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs key="defs">
                    <linearGradient key="selesai" id="colorSelesai" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient key="proses" id="colorProses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient key="terjadwal" id="colorTerjadwal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient key="batal" id="colorBatal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#64748B' }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 4px 12px -4px rgb(15 23 42 / 0.18)',
                    }}
                    labelStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#1E293B' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="Batal" stackId="1" stroke="#EF4444" fill="url(#colorBatal)" />
                  <Area type="monotone" dataKey="Terjadwal" stackId="1" stroke="#F59E0B" fill="url(#colorTerjadwal)" />
                  <Area type="monotone" dataKey="Proses" stackId="1" stroke="#3B82F6" fill="url(#colorProses)" />
                  <Area type="monotone" dataKey="Selesai" stackId="1" stroke="#10B981" fill="url(#colorSelesai)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </OperationalTableCard>

        <OperationalTableCard>
          <div className="border-b border-slate-100 p-4">
            <h2 className="text-base font-semibold text-slate-900">Distribusi Status</h2>
            <p className="mt-1 text-xs text-slate-500">Komposisi status pesanan.</p>
          </div>
          <div className="p-4">
            <div className="relative h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusDistData.map((entry, index) => (
                      <Cell key={`cell-${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-8">
                <div className="text-center">
                  <span className="block text-2xl font-semibold text-slate-900">{myOrders.length}</span>
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">Total</span>
                </div>
              </div>
            </div>
          </div>
        </OperationalTableCard>
      </div>

      <OperationalTableCard>
        <div className="border-b border-slate-100 p-4">
          <h2 className="text-base font-semibold text-slate-900">Laporan Harian Detail</h2>
          <p className="mt-1 text-xs text-slate-500">Ringkasan status pekerjaan per tanggal.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="sticky left-0 z-20 whitespace-nowrap border-r border-slate-100 bg-slate-50 px-4 py-3">Tanggal</th>
                <th className="whitespace-nowrap px-4 py-3 text-center">Total Job</th>
                <th className="whitespace-nowrap px-4 py-3 text-center text-slate-600">Terjadwal</th>
                <th className="whitespace-nowrap px-4 py-3 text-center text-blue-600">OTW</th>
                <th className="whitespace-nowrap px-4 py-3 text-center text-blue-600">Kerja</th>
                <th className="whitespace-nowrap px-4 py-3 text-center text-yellow-600">QC</th>
                <th className="whitespace-nowrap px-4 py-3 text-center text-emerald-600">Selesai</th>
                <th className="whitespace-nowrap px-4 py-3 text-center text-red-600">Batal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.map((row) => (
                <tr key={row.date} className="text-slate-700 transition-colors hover:bg-slate-50">
                  <td className="sticky left-0 z-10 whitespace-nowrap border-r border-slate-100 bg-white px-4 py-3 font-medium">
                    {(() => {
                      const parts = row.date.split(' ');
                      if (parts.length === 3) {
                        return (
                          <div className="flex flex-col">
                            <span>{parts[0]} {parts[1]}</span>
                            <span className="text-[10px] text-slate-400">{parts[2]}</span>
                          </div>
                        );
                      }
                      return row.date;
                    })()}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold">{row.total === 0 ? '-' : row.total}</td>
                  <td className="px-4 py-3 text-center text-slate-400">{row.scheduled === 0 ? '-' : row.scheduled}</td>
                  <td className="px-4 py-3 text-center text-blue-500">{row.otw === 0 ? '-' : row.otw}</td>
                  <td className="px-4 py-3 text-center text-blue-600">{row.working === 0 ? '-' : row.working}</td>
                  <td className="px-4 py-3 text-center text-yellow-500">{row.qc === 0 ? '-' : row.qc}</td>
                  <td className="px-4 py-3 text-center font-semibold text-emerald-600">{row.done === 0 ? '-' : row.done}</td>
                  <td className="px-4 py-3 text-center text-red-500">{row.cancelled === 0 ? '-' : row.cancelled}</td>
                </tr>
              ))}
              {dailyReport.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <OperationalEmptyState
                      icon={CalendarIcon}
                      title="Belum ada data aktivitas"
                      description="Tidak ada data pada rentang tanggal ini."
                      className="py-12"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 bg-white p-4 sm:flex-row">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Tampilkan</span>
            <Select
              value={String(itemsPerPage)}
              onValueChange={(value) => {
                setItemsPerPage(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[76px] bg-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="31">31</SelectItem>
              </SelectContent>
            </Select>
            <span>baris</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="mr-2 text-xs text-slate-500">
              Hal {currentPage} dari {totalPages || 1}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4 text-slate-600" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4 text-slate-600" />
              </button>
            </div>
          </div>
        </div>
      </OperationalTableCard>
    </OperationalPageShell>
  );
}
