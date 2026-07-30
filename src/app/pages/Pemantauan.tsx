import React, { useState, useMemo } from 'react';
import { 
  MapPin, Clock, User, CheckCircle2,
  ChevronDown, ChevronUp, Calendar, Filter, Truck, ArrowRight,
  Search, Banknote, Layers, Shield
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { MapCard } from '../components/ui/MapCard';
import { Input } from '../components/ui/input';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "../components/ui/select";
import { DatePickerWithRange } from '../components/ui/date-range-picker';
import { useMasterData } from '@/app/pages/master-data/context';
import { usePermissions } from '@/app/hooks/usePermissions';
import { startOfDay, endOfDay, isSameDay, isWithinInterval, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger, SheetClose } from '../components/ui/sheet';
import { DateRange } from 'react-day-picker';
import { Order } from './master-data/data';
import { Label } from '../components/ui/label';
import { isAdvertiserRole, isCsRole, isTechnicianRole } from '@/app/data/roleHelpers';

export function Pemantauan() {
  const { 
    orders = [], 
    users = [], 
    branches: allBranches = [], 
    activeBranches: branches = [], // Use active branches
    services = [], 
    platforms = [], 
    areas = [], 
    vehicles = [], 
    payments = [] 
  } = useMasterData();
  const { hasPermission } = usePermissions();
  
  // --- STATES ---
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'routes' | 'capacity'>('routes');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showRadius, setShowRadius] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'history'>('calendar');
  
  // Date default to Today
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(), 
    to: new Date()
  });

  // Dropdown Filters (Toolbar)
  const [groupingMode, setGroupingMode] = useState<'technician' | 'cs'>('cs');
  const [technicianFilter, setTechnicianFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [advertiserFilter, setAdvertiserFilter] = useState<string>('all');
  
  // Advanced Filters (Sheet)
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [paymentValidationFilter, setPaymentValidationFilter] = useState<string>('all');
  const [affiliateFilter, setAffiliateFilter] = useState<string>('all');
  
  // Mobile Detection
  const [isMobile, setIsMobile] = useState(false);
  
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Lists for Filters
  const csUsers = users.filter(u => isCsRole(u.role) && u.status === 'active');
  const technicians = users.filter(u => isTechnicianRole(u.role) && u.status === 'active');
  const advertisers = users.filter(u => isAdvertiserRole(u.role) && u.status === 'active');
  const activeServices = services.filter(s => s.status === 'active');
  const statusFilterLabels: Record<string, string> = {
    all: 'Semua',
    pending: 'Terjadwal',
    otw: 'OTW',
    working: 'Kerja',
    qc: 'QC',
    done: 'Selesai',
  };

  const resolveNameById = (
    items: Array<{ id: string; name?: string }>,
    value: string,
    fallback: string,
  ) => items.find((item) => item.id === value)?.name || fallback;

  const truncateFilterValue = (value: string, maxLength = 28) =>
    value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;

  const resetSheetFilters = () => {
    setServiceCategoryFilter('all');
    setVehicleFilter('all');
    setPlatformFilter('all');
    setAreaFilter('all');
    setPaymentTypeFilter('all');
    setPaymentMethodFilter('all');
    setPaymentStatusFilter('all');
    setPaymentValidationFilter('all');
    setAffiliateFilter('all');
  };

  // Check Permission
  if (!hasPermission('monitoring.view')) {
      return (
          <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 w-full">
             <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 max-w-md">
                 <Shield className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                 <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Akses Dibatasi</h2>
                 <p className="text-slate-500 dark:text-slate-400 mt-2">Anda tidak memiliki izin untuk mengakses halaman Pemantauan Lapangan.</p>
                 <p className="text-xs text-slate-400 mt-4">Hubungi Administrator untuk meminta akses.</p>
             </div>
          </div>
      );
  }

  // 1. Base Filter (ignores status)
  const filteredOrdersBase = useMemo(() => {
    return orders.filter(order => {
       const matchesSearch = 
         order.customerName.toLowerCase().includes(search.toLowerCase()) ||
         order.id.toLowerCase().includes(search.toLowerCase()) ||
         order.customerPhone.toLowerCase().includes(search.toLowerCase()) ||
         order.address.toLowerCase().includes(search.toLowerCase());

       const matchesTechnician = technicianFilter === 'all' || order.technicianId === technicianFilter; 
       const matchesService = serviceFilter === 'all' || order.serviceId === serviceFilter;
       const matchesAdvertiser = advertiserFilter === 'all' || order.advertiserId === advertiserFilter;
       const matchesBranch = branchFilter === 'all' || order.branchId === branchFilter;
       
       const matchesPlatform = platformFilter === 'all' || order.platformId === platformFilter;
       const matchesVehicle = vehicleFilter === 'all' || order.vehicleId === vehicleFilter;
       const matchesServiceCategory = serviceCategoryFilter === 'all' || order.serviceCategory === serviceCategoryFilter;
       
       const matchesArea = areaFilter === 'all' || order.areaId === areaFilter;
       const matchesPaymentType = paymentTypeFilter === 'all' || order.paymentType === paymentTypeFilter;
       const matchesPaymentMethod = paymentMethodFilter === 'all' || order.paymentMethodId === paymentMethodFilter;
       const matchesPaymentStatus = paymentStatusFilter === 'all' || order.paymentStatus === paymentStatusFilter;
       const matchesPaymentValidation = paymentValidationFilter === 'all' || order.paymentValidation === paymentValidationFilter;
       const matchesAffiliate = affiliateFilter === 'all' || order.affiliateName === affiliateFilter;

       // Date Filter
       let matchesDate = true;
       if (dateRange?.from) {
          const orderDate = new Date(`${order.serviceDate}T${order.serviceTime}`);
          const start = startOfDay(dateRange.from);
          const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
          matchesDate = isWithinInterval(orderDate, { start, end });
       }

       return matchesSearch && matchesTechnician && matchesService && matchesAdvertiser && matchesBranch && matchesDate && matchesPlatform && matchesVehicle && matchesServiceCategory && matchesArea && matchesPaymentType && matchesPaymentMethod && matchesPaymentStatus && matchesPaymentValidation && matchesAffiliate;
    });
  }, [orders, search, technicianFilter, serviceFilter, advertiserFilter, branchFilter, dateRange, platformFilter, vehicleFilter, serviceCategoryFilter, areaFilter, paymentTypeFilter, paymentMethodFilter, paymentStatusFilter, paymentValidationFilter, affiliateFilter]);

  // 2. Status Counts (based on filtered base)
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredOrdersBase.forEach(o => {
       let status = o.status || 'pending';
       if (status === 'teknisi_completed') status = 'qc';
       counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [filteredOrdersBase]);

  // 3. Final Filtered Orders (Base + Status)
  const filteredOrders = useMemo(() => {
    return filteredOrdersBase.filter(order => 
      statusFilter === 'all' || 
      order.status === statusFilter || 
      (statusFilter === 'qc' && order.status === 'teknisi_completed')
    );
  }, [filteredOrdersBase, statusFilter]);

  // --- COMPONENT: CAPACITY DASHBOARD (Sesuai Gambar Referensi) ---
  const CapacityDashboard = () => (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* 1. Okupansi Card */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
              <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">OKUPANSI BULAN INI</p>
                  <div className="flex items-baseline gap-2">
                      <h3 className="text-4xl font-bold text-slate-900 dark:text-slate-100">1%</h3>
                      <span className="text-sm font-medium text-slate-500">Terisi</span>
                  </div>
              </div>
              <div className="relative w-16 h-16 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-100 dark:text-slate-700" />
                      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={175} strokeDashoffset={175 - (175 * 1) / 100} className="text-blue-500 transition-all duration-1000 ease-out" strokeLinecap="round" />
                  </svg>
              </div>
          </div>

          {/* 2. Daily Capacity Cards */}
          <div className="space-y-3 pb-20">
               {/* Kamis (Contoh Data) */}
               <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                   <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                       <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-sm">1</div>
                           <span className="font-bold text-slate-700 dark:text-slate-200">Kamis</span>
                       </div>
                       <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">0/10</Badge>
                   </div>
                   <div className="p-4 space-y-4">
                        {branches.slice(0, 2).map(branch => (
                            <div key={`kamis-${branch.id}`} className="space-y-1.5">
                                <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                                    <span>{branch.code || branch.name.substring(0, 6)}</span>
                                    <span>0%</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-slate-300 w-0"></div>
                                </div>
                                <div className="flex justify-end text-[10px] text-slate-400 font-medium">0/5</div>
                            </div>
                        ))}
                   </div>
               </div>

               {/* Jumat (Contoh Data) */}
               <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                   <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                       <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-sm">2</div>
                           <span className="font-bold text-slate-700 dark:text-slate-200">Jumat</span>
                       </div>
                       <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">0/10</Badge>
                   </div>
                   <div className="p-4 space-y-4">
                        {branches.slice(0, 3).map(branch => (
                            <div key={`jumat-${branch.id}`} className="space-y-1.5">
                                <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                                    <span>{branch.code || branch.name.substring(0, 6)}</span>
                                    <span>0%</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-slate-300 w-0"></div>
                                </div>
                                <div className="flex justify-end text-[10px] text-slate-400 font-medium">0/5</div>
                            </div>
                        ))}
                   </div>
               </div>

               {/* Legend */}
               <div className="pt-4 flex justify-center gap-4 border-t border-dashed border-slate-200 dark:border-slate-700 mt-4">
                     <div className="flex items-center gap-1.5">
                         <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                         <span className="text-[11px] text-slate-500 font-medium">Kosong</span>
                     </div>
                     <div className="flex items-center gap-1.5">
                         <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                         <span className="text-[11px] text-slate-500 font-medium">Hampir Penuh</span>
                     </div>
                     <div className="flex items-center gap-1.5">
                         <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                         <span className="text-[11px] text-slate-500 font-medium">Penuh</span>
                     </div>
               </div>
          </div>
      </div>
  );

  // --- COMPONENT: SCHEDULE CARD LIST (Reused) ---
  const ScheduleList = ({ isMobile = false }) => (
    <div className={`space-y-6 ${isMobile ? 'pb-20' : ''}`}>
        {routeGroups.map((group) => (
            <div key={group.id} className="relative">
                <div className={`flex items-center gap-2 mb-4 sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 z-10 py-3 border-b border-dashed border-slate-200 dark:border-slate-800 backdrop-blur-sm ${isMobile ? 'px-1' : ''}`}>
                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: group.color }}></div>
                    <span className="font-bold text-sm uppercase text-slate-800 dark:text-slate-200 tracking-wide">{group.technicianName}</span>
                    <span className="text-xs text-slate-400 font-medium">({group.points.length} titik)</span>
                </div>

                <div>
                    {group.points.map((point, idx) => (
                        <div key={point.id} className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-700 last:border-0 pb-4 last:pb-0">
                            {/* Timeline Dot */}
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 z-10"></div>

                            {/* Minimalist Card */}
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-all active:scale-[0.99] w-full">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h4 className="font-bold text-base text-slate-900 dark:text-slate-100 leading-tight mb-1">{point.name}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-1">{point.address}</p>
                                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                                {groupingMode === 'technician' 
                                                    ? `CS: ${users.find(u => u.id === point.orderData.csId)?.name?.split(' ')[0] || '-'}`
                                                    : `Tech: ${users.find(u => u.id === point.orderData.technicianId)?.name?.split(' ')[0] || '-'}`
                                                }
                                            </span>
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                                Ads: {users.find(u => u.id === point.orderData.advertiserId)?.name?.split(' ')[0] || '-'}
                                            </span>
                                        </div>
                                    </div>
                                    <Badge className={`text-[10px] px-2 h-6 flex items-center justify-center font-bold tracking-wide rounded-md ml-2 shrink-0 ${getStatusBadgeVariant(point.status)}`}>
                                        {point.status === 'pending' ? 'WAIT' : point.status.toUpperCase()}
                                    </Badge>
                                </div>
                                
                                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-50 dark:border-slate-700/50">
                                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded-md">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span className="text-xs font-semibold">{point.time}</span>
                                    </div>
                                    
                                    {idx > 0 && point.distance !== '0 km' && (
                                        <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                                            <ArrowRight className="w-3 h-3 text-slate-300" />
                                            <span>{point.distance}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        ))}
        {routeGroups.length === 0 && (
            <div className="text-center py-12 flex flex-col items-center justify-center text-slate-400">
                <Calendar className="w-12 h-12 text-slate-200 mb-3" />
                <p>Tidak ada jadwal hari ini.</p>
            </div>
        )}
    </div>
  );
  const branchPoints = useMemo(() => {
    const getCoordinatesFromUrl = (url?: string) => {
        if (!url) return null;
        try {
            const patterns = [
                /@(-?\d+\.\d+),(-?\d+\.\d+)/,
                /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
                /search\/.*\/(-?\d+\.\d+),(-?\d+\.\d+)/
            ];
            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match) {
                    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
                }
            }
        } catch (e) { console.error(e); }
        return null;
    };

    return branches.map(branch => {
        let lat = branch.lat;
        let lng = branch.lng;
        let radius = branch.radius;

        // Priority 1: Try parsing mapsUrl from Master Data (Dynamic updates from user input)
        if (branch.mapsUrl) {
            const coords = getCoordinatesFromUrl(branch.mapsUrl);
            if (coords) {
                return {
                    id: branch.id,
                    name: branch.name,
                    code: branch.code,
                    lat: coords.lat,
                    lng: coords.lng,
                    address: branch.address,
                    radius: radius || 0
                };
            }
        }

        // Priority 2: Use explicit lat/lng from Master Data (Fallback)
        if (lat && lng) {
            return {
                id: branch.id,
                name: branch.name,
                code: branch.code,
                lat,
                lng,
                address: branch.address,
                radius: radius || 0 
            };
        }
        
        return null;
    }).filter((b): b is NonNullable<typeof b> => b !== null);
  }, [branches]);

  // --- ROUTE GROUPS ---
  const routeGroups = useMemo(() => {
    const getCoordinatesFromUrl = (url?: string) => {
        if (!url) return null;
        try {
            const patterns = [
                /@(-?\d+\.\d+),(-?\d+\.\d+)/,
                /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
                /search\/.*\/(-?\d+\.\d+),(-?\d+\.\d+)/
            ];
            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match) {
                    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
                }
            }
        } catch (e) { console.error(e); }
        return null;
    };

    const getDistance = (lat1?: number, lon1?: number, lat2?: number, lon2?: number) => {
        if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
        const R = 6371; 
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const TECH_COLORS = [
      '#0E7490', '#E11D48', '#D97706', '#4F46E5', '#059669', '#7C3AED', '#DB2777',
    ];

    // Group filtered orders based on mode
    const groupedOrders: { [key: string]: Order[] } = {};
    filteredOrders.forEach(order => {
        const key = groupingMode === 'technician' 
            ? (order.technicianId || 'unassigned')
            : (order.csId || 'unassigned');
            
        if (!groupedOrders[key]) groupedOrders[key] = [];
        groupedOrders[key].push(order);
    });

    // Process each group
    return Object.entries(groupedOrders).map(([groupId, groupOrders], groupIndex) => {
        const user = users.find(u => u.id === groupId);
        
        const getGroupName = () => {
             if (groupId === 'unassigned') return 'Belum Ditugaskan';
             return user ? user.name : 'Unknown';
        };
        const groupName = getGroupName();
        const color = TECH_COLORS[groupIndex % TECH_COLORS.length];

        // Sort by Date and Time
        const sorted = [...groupOrders].sort((a, b) => {
             const dateA = new Date(`${a.serviceDate}T${a.serviceTime || '00:00'}`);
             const dateB = new Date(`${b.serviceDate}T${b.serviceTime || '00:00'}`);
             return dateA.getTime() - dateB.getTime();
        });

        // Calculate points and distances
        const points = sorted.map((order, index) => {
            let lat = order.lat;
            let lng = order.lng;
            
            if ((!lat || !lng) && order.mapsUrl) {
                const coords = getCoordinatesFromUrl(order.mapsUrl);
                if (coords) { lat = coords.lat; lng = coords.lng; }
            }

            let distance = '0 km';
            let travelTimeEstimate = '';

            if (index > 0) {
                const prev = sorted[index - 1];
                let prevLat = prev.lat;
                let prevLng = prev.lng;
                
                if ((!prevLat || !prevLng) && prev.mapsUrl) {
                   const c = getCoordinatesFromUrl(prev.mapsUrl);
                   if(c) { prevLat = c.lat; prevLng = c.lng; }
                }

                if (lat && lng && prevLat && prevLng) {
                    const d = getDistance(prevLat, prevLng, lat, lng);
                    distance = `${d.toFixed(1)} km`;
                    const minutes = Math.round(d * 2); 
                    const finalMinutes = minutes + (d > 0.5 ? 5 : 0); // +5 min buffer
                    travelTimeEstimate = `± ${finalMinutes} mnt`;
                }
            }
            
            return {
                id: order.id,
                name: order.customerName,
                address: order.address,
                lat: lat || 0,
                lng: lng || 0,
                status: order.status,
                time: order.serviceTime,
                distance: distance,
                travelTimeEstimate,
                technicianName: groupName, // Rename to groupName conceptually but keep key for compat
                orderData: order,
                orderIndex: index + 1 // Add index for pin numbering
            };
        });

        return {
            id: groupId,
            name: groupName, // New standard
            technicianName: groupName, // Backward compatibility
            color,
            points,
            ordersCount: sorted.length
        };
    }).filter(group => group.points.length > 0);
  }, [filteredOrders, users, groupingMode]);

  // --- STATS ---
  const stats = useMemo(() => {
    // Determine active techs from route groups (filtered)
    const activeTechs = routeGroups.length;
    
    // Determine waiting (pending) orders
    const waiting = filteredOrders.filter(o => o.status === 'pending').length;
    
    // Done today
    const doneToday = filteredOrders.filter(o => o.status === 'done').length;
    
    return { activeTechs, waiting, doneToday };
  }, [routeGroups, filteredOrders]);

  const activeFilterEntries = useMemo(() => {
    const entries: Array<{ key: string; label: string; value: string }> = [];
    const trimmedSearch = search.trim();

    if (statusFilter !== 'all') {
      entries.push({
        key: 'status',
        label: 'Status',
        value: statusFilterLabels[statusFilter] || statusFilter,
      });
    }

    if (trimmedSearch) {
      entries.push({
        key: 'search',
        label: 'Cari',
        value: truncateFilterValue(trimmedSearch, 24),
      });
    }

    if (technicianFilter !== 'all') {
      entries.push({
        key: 'technician',
        label: 'Teknisi',
        value: resolveNameById(technicians, technicianFilter, 'Teknisi dipilih'),
      });
    }

    if (branchFilter !== 'all') {
      entries.push({
        key: 'branch',
        label: 'Cabang',
        value: resolveNameById(branches, branchFilter, 'Cabang dipilih'),
      });
    }

    if (serviceFilter !== 'all') {
      entries.push({
        key: 'service',
        label: 'Layanan',
        value: resolveNameById(activeServices, serviceFilter, 'Layanan dipilih'),
      });
    }

    if (advertiserFilter !== 'all') {
      entries.push({
        key: 'advertiser',
        label: 'Ads',
        value: resolveNameById(advertisers, advertiserFilter, 'Advertiser dipilih'),
      });
    }

    if (serviceCategoryFilter !== 'all') {
      entries.push({
        key: 'service-category',
        label: 'Jenis',
        value: serviceCategoryFilter,
      });
    }

    if (vehicleFilter !== 'all') {
      entries.push({
        key: 'vehicle',
        label: 'Tipe',
        value: resolveNameById(vehicles, vehicleFilter, 'Tipe dipilih'),
      });
    }

    if (platformFilter !== 'all') {
      entries.push({
        key: 'platform',
        label: 'Platform',
        value: resolveNameById(platforms, platformFilter, 'Platform dipilih'),
      });
    }

    if (areaFilter !== 'all') {
      entries.push({
        key: 'area',
        label: 'Daerah',
        value: resolveNameById(areas, areaFilter, 'Daerah dipilih'),
      });
    }

    if (affiliateFilter !== 'all') {
      entries.push({
        key: 'affiliate',
        label: 'Affiliate',
        value: truncateFilterValue(affiliateFilter),
      });
    }

    if (paymentTypeFilter !== 'all') {
      entries.push({
        key: 'payment-type',
        label: 'Metode',
        value: paymentTypeFilter,
      });
    }

    if (paymentMethodFilter !== 'all') {
      const selectedPayment = payments.find((payment) => payment.id === paymentMethodFilter);
      entries.push({
        key: 'payment-method',
        label: 'Bank',
        value: selectedPayment
          ? truncateFilterValue(`${selectedPayment.bankName} - ${selectedPayment.accountNumber}`)
          : 'Bank dipilih',
      });
    }

    if (paymentStatusFilter !== 'all') {
      entries.push({
        key: 'payment-status',
        label: 'Status Bayar',
        value: paymentStatusFilter,
      });
    }

    if (paymentValidationFilter !== 'all') {
      entries.push({
        key: 'payment-validation',
        label: 'Validasi',
        value: paymentValidationFilter,
      });
    }

    return entries;
  }, [
    activeServices,
    advertiserFilter,
    advertisers,
    affiliateFilter,
    areaFilter,
    areas,
    branchFilter,
    branches,
    paymentMethodFilter,
    paymentStatusFilter,
    paymentTypeFilter,
    paymentValidationFilter,
    payments,
    platformFilter,
    platforms,
    search,
    serviceCategoryFilter,
    serviceFilter,
    statusFilter,
    technicianFilter,
    technicians,
    vehicleFilter,
    vehicles,
  ]);

  const activeFilterCount = activeFilterEntries.length;
  const visibleActiveFilters = activeFilterEntries.slice(0, 4);
  const hiddenActiveFilterCount = Math.max(activeFilterCount - visibleActiveFilters.length, 0);

  const getStatusBadgeVariant = (status: string) => {
     switch (status) {
       case 'pending': return "bg-yellow-100 text-yellow-700 border-yellow-200";
       case 'processing': return "bg-blue-100 text-blue-700 border-blue-200 animate-pulse";
       case 'done': return "bg-emerald-100 text-emerald-700 border-emerald-200";
       case 'cancelled': return "bg-red-100 text-red-700 border-red-200";
       case 'waiting': return "bg-orange-100 text-orange-700 border-orange-200";
       default: return "bg-slate-100 text-slate-700";
     }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-900 overflow-hidden">
        
        {/* --- 1. TOP FILTER CONTAINER (Static Layout) --- */}
        {isFiltersOpen && (
            <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm z-30 animate-in slide-in-from-top-5 duration-300 relative">
                 <div className="w-full px-4 py-3 space-y-3">
                    
                    {/* Desktop Header Layout */}
                    <div className="hidden md:flex flex-row justify-between items-center gap-3">
                        <div className="flex items-center gap-3">
                            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">Pemantauan</h1>
                            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                            
                            {/* Compact Stats */}
                            <div className="flex gap-2">
                                <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-md border border-blue-100 dark:border-blue-900">
                                    <User className="w-3.5 h-3.5 text-blue-600" />
                                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300">{stats.activeTechs} <span className="hidden sm:inline">{groupingMode === 'technician' ? 'Teknisi' : 'CS'}</span></span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-md border border-emerald-100 dark:border-emerald-900">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{stats.doneToday} <span className="hidden sm:inline">Selesai</span></span>
                                </div>
                            </div>
                        </div>

                        {/* Status Filter Tabs (Horizontal Scroll) */}
                        <div className="flex-1 w-auto overflow-x-auto no-scrollbar mx-4">
                            <div className="flex items-center gap-1.5 justify-center">
                                <Button 
                                    variant={statusFilter === 'all' ? 'default' : 'ghost'} 
                                    size="sm" 
                                    onClick={() => setStatusFilter('all')}
                                    className={statusFilter === 'all' ? "bg-slate-900 dark:bg-blue-600 h-7 text-[10px] px-3 rounded-full" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 h-7 text-[10px] px-3 hover:bg-slate-100 rounded-full"}
                                >
                                    Semua ({orders.length})
                                </Button>
                                {[
                                    { id: 'pending', label: 'Terjadwal' },
                                    { id: 'otw', label: 'OTW' },
                                    { id: 'working', label: 'Kerja' },
                                    { id: 'qc', label: 'QC' },
                                    { id: 'done', label: 'Selesai' },
                                ].map(option => (
                                    <Button 
                                        key={option.id}
                                        variant={statusFilter === option.id ? 'default' : 'ghost'} 
                                        size="sm" 
                                        onClick={() => setStatusFilter(option.id)}
                                        className={statusFilter === option.id ? "bg-slate-900 dark:bg-blue-600 h-7 text-[10px] px-3 rounded-full" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 h-7 text-[10px] px-3 hover:bg-slate-100 rounded-full"}
                                    >
                                        {option.label} ({statusCounts[option.id] || 0})
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Collapse Button */}
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setIsFiltersOpen(false)}
                            className="h-8 w-8 p-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 shrink-0"
                            title="Tutup Filter"
                        >
                            <ChevronUp className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Mobile Header Layout (Minimalist PWA Mode) */}
                    <div className="md:hidden space-y-3">
                         <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">Pemantauan</h1>
                                <div className="flex gap-2">
                                    <div className="flex items-center justify-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md border border-blue-100 dark:border-blue-900 min-w-[36px]">
                                        <User className="w-3.5 h-3.5 text-blue-600" />
                                        <span className="text-xs font-bold text-blue-700 dark:text-blue-300">{stats.activeTechs}</span>
                                    </div>
                                    <div className="flex items-center justify-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-md border border-emerald-100 dark:border-emerald-900 min-w-[36px]">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{stats.doneToday}</span>
                                    </div>
                                </div>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setIsFiltersOpen(false)}
                                className="h-8 w-8 p-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 shrink-0"
                            >
                                <ChevronUp className="w-5 h-5" />
                            </Button>
                        </div>
                        
                        {/* Status Pills Mobile */}
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
                                <Button 
                                    variant={statusFilter === 'all' ? 'default' : 'outline'} 
                                    size="sm" 
                                    onClick={() => setStatusFilter('all')}
                                    className={statusFilter === 'all' ? "bg-slate-900 dark:bg-blue-600 h-8 text-xs px-4 rounded-full border-0 shadow-sm" : "text-slate-600 border-0 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 h-8 text-xs px-4 rounded-full"}
                                >
                                    Semua ({orders.length})
                                </Button>
                                {[
                                    { id: 'pending', label: 'Terjadwal' },
                                    { id: 'otw', label: 'OTW' },
                                    { id: 'working', label: 'Kerja' },
                                    { id: 'qc', label: 'QC' },
                                    { id: 'done', label: 'Selesai' },
                                ].map(option => (
                                    <Button 
                                        key={option.id}
                                        variant={statusFilter === option.id ? 'default' : 'outline'} 
                                        size="sm" 
                                        onClick={() => setStatusFilter(option.id)}
                                        className={statusFilter === option.id ? "bg-slate-900 dark:bg-blue-600 h-8 text-xs px-4 rounded-full border-0 shadow-sm" : "text-slate-600 border-0 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 h-8 text-xs px-4 rounded-full"}
                                    >
                                        {option.label} ({statusCounts[option.id] || 0})
                                    </Button>
                                ))}
                        </div>
                    </div>

                    {/* Controls Row (Shared/Responsive) */}
                    <div className="flex flex-col xl:flex-row gap-3 items-start xl:items-center pt-1 md:pt-0">
                        
                        {/* Group 1: Date & View Mode */}
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <DatePickerWithRange date={dateRange} setDate={setDateRange} className="flex-1 sm:w-[240px] shadow-sm" />
                            
                            {/* Desktop Toggle */}
                            <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 h-10 shrink-0">
                                <button 
                                    onClick={() => setGroupingMode('technician')}
                                    className={`px-4 h-full flex items-center justify-center text-xs font-bold rounded-md transition-all ${groupingMode === 'technician' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                                >
                                    Teknisi
                                </button>
                                <button 
                                    onClick={() => setGroupingMode('cs')}
                                    className={`px-4 h-full flex items-center justify-center text-xs font-bold rounded-md transition-all ${groupingMode === 'cs' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                                >
                                    CS
                                </button>
                            </div>

                            {/* Mobile Filter Trigger (Contains Hidden Controls) */}
                            <div className="md:hidden">
                                <Sheet>
                                    <SheetTrigger asChild>
                                        <Button
                                          variant={activeFilterCount > 0 ? "default" : "outline"}
                                          size="icon"
                                          className={`relative h-10 w-10 shadow-sm shrink-0 rounded-lg ${
                                            activeFilterCount > 0
                                              ? 'bg-blue-600 hover:bg-blue-700 text-white border-transparent'
                                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                          }`}
                                        >
                                            <Filter className={`w-4 h-4 ${activeFilterCount > 0 ? 'text-white' : 'text-slate-500'}`} />
                                            {activeFilterCount > 0 && (
                                              <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-blue-600 shadow-sm">
                                                {activeFilterCount}
                                              </span>
                                            )}
                                        </Button>
                                    </SheetTrigger>
                                    <SheetContent side="bottom" className="h-[90vh] w-full rounded-t-2xl p-0 flex flex-col bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-[150]">
                                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-2xl">
                                            <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto mb-4" />
                                            <SheetHeader className="text-left">
                                                <SheetTitle>Filter Pesanan</SheetTitle>
                                                <SheetDescription className="text-xs text-slate-500">
                                                    Sesuaikan filter pencarian
                                                </SheetDescription>
                                            </SheetHeader>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                                            {/* Mobile Specific Controls */}
                                            <div className="space-y-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                                    <Input placeholder="Cari pesanan..." className="pl-9 bg-white h-10" value={search} onChange={(e) => setSearch(e.target.value)} />
                                                </div>
                                                <div className="grid grid-cols-2 bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
                                                    <button onClick={() => setGroupingMode('technician')} className={`py-2 text-xs font-bold rounded-md ${groupingMode === 'technician' ? 'bg-white shadow-sm' : ''}`}>Teknisi</button>
                                                    <button onClick={() => setGroupingMode('cs')} className={`py-2 text-xs font-bold rounded-md ${groupingMode === 'cs' ? 'bg-white shadow-sm' : ''}`}>CS</button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
                                                        <SelectTrigger className="bg-white h-10 text-xs"><SelectValue placeholder="Teknisi" /></SelectTrigger>
                                                        <SelectContent className="z-[200]"><SelectItem value="all">Semua Teknisi</SelectItem>{technicians.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                    <Select value={branchFilter} onValueChange={setBranchFilter}>
                                                        <SelectTrigger className="bg-white h-10 text-xs"><SelectValue placeholder="Cabang" /></SelectTrigger>
                                                        <SelectContent className="z-[200]"><SelectItem value="all">Semua Cabang</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                    <Select value={serviceFilter} onValueChange={setServiceFilter}>
                                                        <SelectTrigger className="bg-white h-10 text-xs"><SelectValue placeholder="Layanan" /></SelectTrigger>
                                                        <SelectContent className="z-[200]"><SelectItem value="all">Semua Layanan</SelectItem>{activeServices.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            {/* Advanced Filters (Full Structure) */}
                                            <div className="space-y-8 pt-2">
                                                {/* Section 1: Layanan & Kendaraan */}
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                                                        <div className="p-1.5 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                                                            <Truck className="w-4 h-4" />
                                                        </div>
                                                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Layanan & Kendaraan</h4>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-4">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Jenis Layanan</Label>
                                                            <Select value={serviceCategoryFilter} onValueChange={setServiceCategoryFilter}>
                                                                <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Jenis" /></SelectTrigger>
                                                                <SelectContent className="z-[200] border-slate-200 dark:border-slate-700">
                                                                    <SelectItem value="all">Semua Jenis</SelectItem>
                                                                    <SelectItem value="Visit">Visit</SelectItem>
                                                                    <SelectItem value="Home Service">Home Service</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Tipe Mobil</Label>
                                                            <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                                                                <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Tipe" /></SelectTrigger>
                                                                <SelectContent className="z-[200] border-slate-200 dark:border-slate-700">
                                                                    <SelectItem value="all">Semua Tipe</SelectItem>
                                                                    {vehicles.map(v => (
                                                                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Section 2: Asal & Lokasi */}
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                                                        <div className="p-1.5 rounded-md bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
                                                            <MapPin className="w-4 h-4" />
                                                        </div>
                                                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Asal & Lokasi</h4>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-4">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Platform</Label>
                                                            <Select value={platformFilter} onValueChange={setPlatformFilter}>
                                                                <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Platform" /></SelectTrigger>
                                                                <SelectContent className="z-[200] border-slate-200 dark:border-slate-700">
                                                                    <SelectItem value="all">Semua Platform</SelectItem>
                                                                    {platforms.map(p => (
                                                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Daerah</Label>
                                                            <Select value={areaFilter} onValueChange={setAreaFilter}>
                                                                <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Daerah" /></SelectTrigger>
                                                                <SelectContent className="z-[200] border-slate-200 dark:border-slate-700">
                                                                    <SelectItem value="all">Semua Daerah</SelectItem>
                                                                    {areas.map(a => (
                                                                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Affiliate</Label>
                                                            <Select value={affiliateFilter} onValueChange={setAffiliateFilter}>
                                                                <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Affiliate" /></SelectTrigger>
                                                                <SelectContent className="z-[200] border-slate-200 dark:border-slate-700">
                                                                    <SelectItem value="all">Semua Affiliate</SelectItem>
                                                                    {Array.from(new Set(orders.map(o => o.affiliateName).filter(Boolean))).map(aff => (
                                                                        <SelectItem key={aff as string} value={aff as string}>{aff}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Section 3: Pembayaran */}
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                                                        <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                                                            <Banknote className="w-4 h-4" />
                                                        </div>
                                                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Pembayaran</h4>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-4">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Metode</Label>
                                                            <Select value={paymentTypeFilter} onValueChange={setPaymentTypeFilter}>
                                                                <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Metode" /></SelectTrigger>
                                                                <SelectContent className="z-[200] border-slate-200 dark:border-slate-700">
                                                                    <SelectItem value="all">Semua Metode</SelectItem>
                                                                    <SelectItem value="Transfer">Transfer</SelectItem>
                                                                    <SelectItem value="Cash">Cash</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Status</Label>
                                                            <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                                                                <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Status" /></SelectTrigger>
                                                                <SelectContent className="z-[200] border-slate-200 dark:border-slate-700">
                                                                    <SelectItem value="all">Semua Status</SelectItem>
                                                                    <SelectItem value="Paid">Lunas (Paid)</SelectItem>
                                                                    <SelectItem value="Unpaid">Belum Bayar (Unpaid)</SelectItem>
                                                                    <SelectItem value="Down Payment">DP (Down Payment)</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-4 border-t border-slate-200 bg-white flex gap-3">
                                            <Button variant="outline" onClick={resetSheetFilters} className="flex-1">Reset</Button>
                                            <SheetClose asChild><Button type="submit" className="flex-1 bg-blue-600 text-white">Terapkan</Button></SheetClose>
                                        </div>
                                    </SheetContent>
                                </Sheet>
                            </div>
                        </div>

                        <div className="hidden xl:block w-px h-8 bg-slate-200 dark:bg-slate-700 mx-2"></div>

                        {/* Group 2: Dropdowns (Desktop) */}
                        <div className="hidden md:flex items-center gap-3 w-full overflow-x-auto pb-1 no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
                             <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
                                <SelectTrigger className="min-w-[140px] bg-white dark:bg-slate-800 h-10 text-xs border-slate-200 dark:border-slate-700 shadow-sm"><SelectValue placeholder="Teknisi" /></SelectTrigger>
                                <SelectContent>{technicians.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}<SelectItem value="all">Semua Teknisi</SelectItem></SelectContent>
                             </Select>

                             <Select value={branchFilter} onValueChange={setBranchFilter}>
                                <SelectTrigger className="min-w-[140px] bg-white dark:bg-slate-800 h-10 text-xs border-slate-200 dark:border-slate-700 shadow-sm"><SelectValue placeholder="Cabang" /></SelectTrigger>
                                <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}<SelectItem value="all">Semua Cabang</SelectItem></SelectContent>
                             </Select>

                             <Select value={serviceFilter} onValueChange={setServiceFilter}>
                                <SelectTrigger className="min-w-[140px] bg-white dark:bg-slate-800 h-10 text-xs border-slate-200 dark:border-slate-700 shadow-sm"><SelectValue placeholder="Layanan" /></SelectTrigger>
                                <SelectContent>{activeServices.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}<SelectItem value="all">Semua Layanan</SelectItem></SelectContent>
                             </Select>
                             
                             <div className="ml-auto hidden md:flex items-center gap-3 pl-2 border-l border-slate-200 dark:border-slate-700">
                                <div className="relative w-40 sm:w-64">
                                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <Input placeholder="Cari nama, ID, no hp..." className="pl-9 h-10 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm rounded-lg" value={search} onChange={(e) => setSearch(e.target.value)} />
                                </div>
                                
                                <Sheet>
                                    <SheetTrigger asChild>
                                        <Button
                                          variant={activeFilterCount > 0 ? "default" : "outline"}
                                          className={`h-10 shrink-0 rounded-lg px-3 shadow-sm ${
                                            activeFilterCount > 0
                                              ? 'bg-blue-600 hover:bg-blue-700 text-white border-transparent'
                                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                          }`}
                                        >
                                        <Filter className={`mr-2 h-4 w-4 ${activeFilterCount > 0 ? 'text-white' : 'text-slate-500'}`} />
                                        Filter
                                        {activeFilterCount > 0 && (
                                          <span className="ml-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/20 px-1 text-[10px] font-bold text-white">
                                            {activeFilterCount}
                                          </span>
                                        )}
                                        </Button>
                                    </SheetTrigger>
                                    <SheetContent className="w-[400px] sm:w-[540px] z-[150] flex flex-col h-full p-0 gap-0 bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
                                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                                            <SheetHeader className="text-left">
                                                <SheetTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">Filter Pesanan Lengkap</SheetTitle>
                                                <SheetDescription className="text-slate-500 dark:text-slate-400 mt-1">
                                                    Sesuaikan filter di bawah ini untuk menemukan data pesanan yang spesifik.
                                                </SheetDescription>
                                            </SheetHeader>
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                            {/* Section 1: Layanan & Kendaraan */}
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                                                    <div className="p-1.5 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                                                        <Truck className="w-4 h-4" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Layanan & Kendaraan</h4>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Jenis Layanan</Label>
                                                        <Select value={serviceCategoryFilter} onValueChange={setServiceCategoryFilter}>
                                                            <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Jenis" /></SelectTrigger>
                                                            <SelectContent className="z-[200] border-slate-200 dark:border-slate-700">
                                                                <SelectItem value="all">Semua Jenis</SelectItem>
                                                                <SelectItem value="Visit">Visit</SelectItem>
                                                                <SelectItem value="Home Service">Home Service</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Tipe Mobil</Label>
                                                        <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                                                            <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Tipe" /></SelectTrigger>
                                                            <SelectContent className="z-[200] border-slate-200 dark:border-slate-700">
                                                                <SelectItem value="all">Semua Tipe</SelectItem>
                                                                {vehicles.map(v => (
                                                                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Section 2: Asal & Lokasi */}
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                                                    <div className="p-1.5 rounded-md bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
                                                        <MapPin className="w-4 h-4" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Asal & Lokasi</h4>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Platform</Label>
                                                        <Select value={platformFilter} onValueChange={setPlatformFilter}>
                                                            <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Platform" /></SelectTrigger>
                                                            <SelectContent className="z-[200] border-slate-200 dark:border-slate-700">
                                                                <SelectItem value="all">Semua Platform</SelectItem>
                                                                {platforms.map(p => (
                                                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Daerah</Label>
                                                        <Select value={areaFilter} onValueChange={setAreaFilter}>
                                                            <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Daerah" /></SelectTrigger>
                                                            <SelectContent className="z-[200] border-slate-200 dark:border-slate-700">
                                                                <SelectItem value="all">Semua Daerah</SelectItem>
                                                                {areas.map(a => (
                                                                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2 sm:col-span-2">
                                                        <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Affiliate</Label>
                                                        <Select value={affiliateFilter} onValueChange={setAffiliateFilter}>
                                                            <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Affiliate" /></SelectTrigger>
                                                            <SelectContent className="z-[200] border-slate-200 dark:border-slate-700">
                                                                <SelectItem value="all">Semua Affiliate</SelectItem>
                                                                {Array.from(new Set(orders.map(o => o.affiliateName).filter(Boolean))).map(aff => (
                                                                    <SelectItem key={aff as string} value={aff as string}>{aff}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Section 3: Pembayaran */}
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                                                    <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                                                        <Banknote className="w-4 h-4" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Pembayaran</h4>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Metode</Label>
                                                        <Select value={paymentTypeFilter} onValueChange={setPaymentTypeFilter}>
                                                            <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Metode" /></SelectTrigger>
                                                            <SelectContent className="z-[200] border-slate-200 dark:border-slate-700">
                                                                <SelectItem value="all">Semua Metode</SelectItem>
                                                                <SelectItem value="Transfer">Transfer</SelectItem>
                                                                <SelectItem value="Cash">Cash</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Akun Bank</Label>
                                                        <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                                                            <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Bank" /></SelectTrigger>
                                                            <SelectContent className="z-[200] border-slate-200 dark:border-slate-700">
                                                                <SelectItem value="all">Semua Bank</SelectItem>
                                                                {payments.map(p => (
                                                                    <SelectItem key={p.id} value={p.id}>{p.bankName} - {p.accountNumber}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Status</Label>
                                                        <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                                                            <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Status" /></SelectTrigger>
                                                            <SelectContent className="z-[200] border-slate-200 dark:border-slate-700">
                                                                <SelectItem value="all">Semua Status</SelectItem>
                                                                <SelectItem value="Paid">Lunas (Paid)</SelectItem>
                                                                <SelectItem value="Unpaid">Belum Bayar (Unpaid)</SelectItem>
                                                                <SelectItem value="Down Payment">DP (Down Payment)</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Validasi</Label>
                                                        <Select value={paymentValidationFilter} onValueChange={setPaymentValidationFilter}>
                                                            <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua" /></SelectTrigger>
                                                            <SelectContent className="z-[200] border-slate-200 dark:border-slate-700">
                                                                <SelectItem value="all">Semua</SelectItem>
                                                                <SelectItem value="Valid">Valid</SelectItem>
                                                                <SelectItem value="Invalid">Invalid</SelectItem>
                                                                <SelectItem value="Pending">Pending</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row gap-3">
                                            <Button 
                                                variant="outline" 
                                                onClick={resetSheetFilters}
                                                className="flex-1 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                                            >
                                                Reset Filter
                                            </Button>
                                            <SheetClose asChild>
                                                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 shadow-sm text-white">Terapkan Filter</Button>
                                            </SheetClose>
                                        </div>
                                    </SheetContent>
                                </Sheet>
                             </div>
                        </div>

                        {activeFilterCount > 0 && (
                          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/80">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Filter Aktif
                              </span>
                              {visibleActiveFilters.map((filter) => (
                                <Badge
                                  key={filter.key}
                                  variant="secondary"
                                  className="border border-slate-200 bg-white text-[11px] font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                >
                                  {filter.label}: {filter.value}
                                </Badge>
                              ))}
                              {hiddenActiveFilterCount > 0 && (
                                <Badge
                                  variant="secondary"
                                  className="border border-slate-200 bg-white text-[11px] font-medium text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                >
                                  +{hiddenActiveFilterCount} lainnya
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                 </div>
            </div>
        )}

        {/* --- 2. MAIN MAP AREA (Flex Item) --- */}
        <div className="flex-1 relative w-full overflow-hidden">
             
             {/* BACKGROUND MAP */}
             <div className="absolute inset-0 z-0">
                  <MapCard 
                       groups={routeGroups} 
                       branches={branchPoints}
                       height="100%" 
                       width="100%" 
                       className="h-full w-full rounded-none border-0" 
                       showLegend={true} 
                       showRadius={showRadius}
                       hideControls={true}
                  />
             </div>

             {/* FLOATING CONTROLS (Top Right - Inside Map) */}
             <div className="absolute top-4 right-4 z-[60] flex flex-col gap-3 pointer-events-none">
                  {/* Toggle Filter (Only show if filter is CLOSED) */}
                  {!isFiltersOpen && (
                      <Button
                        variant="outline"
                        onClick={() => setIsFiltersOpen(true)}
                        className="pointer-events-auto h-auto min-h-10 justify-start gap-2 rounded-xl border-slate-200 bg-white/95 px-3 py-2 text-left text-slate-700 shadow-md backdrop-blur-sm hover:bg-slate-50 dark:bg-slate-800/95 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700 animate-in zoom-in duration-200"
                        title="Tampilkan Filter"
                      >
                        <ChevronDown className="h-4 w-4 shrink-0" />
                        <div className="hidden md:block">
                          <div className="text-xs font-bold">Tampilkan Filter</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {activeFilterCount > 0 ? `${activeFilterCount} filter aktif tetap tersimpan` : 'Buka lagi panel filter utama'}
                          </div>
                        </div>
                        {activeFilterCount > 0 && (
                          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-100 px-1 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            {activeFilterCount}
                          </span>
                        )}
                      </Button>
                  )}

                  {/* Layers Button */}
                  <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowRadius(!showRadius)}
                        className={`pointer-events-auto h-10 w-10 shadow-md rounded-xl transition-all duration-200 ${
                            showRadius 
                            ? 'bg-white dark:bg-slate-800 border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-400 ring-2 ring-blue-100 dark:ring-blue-900/30' 
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                        title={showRadius ? "Sembunyikan Radius Area" : "Tampilkan Radius Area"}
                    >
                        <Layers className="w-5 h-5" />
                    </Button>

                    {/* Schedule Button */}
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className={`pointer-events-auto h-10 w-10 shadow-md rounded-xl transition-all duration-200 ${
                            isSidebarOpen 
                            ? 'bg-white dark:bg-slate-800 border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-400 ring-2 ring-blue-100 dark:ring-blue-900/30' 
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                        title={isSidebarOpen ? "Sembunyikan Jadwal" : "Tampilkan Jadwal"}
                    >
                        <Calendar className="w-5 h-5" />
                    </Button>
             </div>

             {/* SIDEBAR SHEET (Floating) */}
             <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen} modal={isMobile}>
                <SheetContent 
                    side={isMobile ? "bottom" : "right"}
                    showOverlay={isMobile}
                    className={`
                        p-0 bg-slate-50 dark:bg-slate-900/95 backdrop-blur-sm shadow-2xl flex flex-col overflow-hidden transition-all duration-300
                        ${isMobile 
                            ? 'h-[85vh] w-full rounded-t-2xl border-t border-slate-200 dark:border-slate-800' 
                            : 'top-[20px] bottom-4 right-4 h-auto w-[400px] xl:w-[450px] rounded-xl border-l border-slate-200 dark:border-slate-800'
                        }
                    `}
                >
                     {/* Drag Handle for Mobile */}
                     {isMobile && (
                         <div className="w-full flex justify-center pt-3 pb-1 bg-white dark:bg-slate-900 shrink-0 cursor-grab active:cursor-grabbing">
                             <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                         </div>
                     )}

                     {/* Header */}
                     <div className={`bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 shadow-sm shrink-0 ${isMobile ? 'px-6 pb-6 pt-2' : 'p-6'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <SheetHeader className="text-left space-y-0">
                                <SheetTitle className="font-bold text-slate-900 dark:text-slate-100 text-xl tracking-tight">
                                    Jadwal Harian
                                </SheetTitle>
                                <SheetDescription className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
                                    {routeGroups.length} {groupingMode === 'technician' ? 'Teknisi' : 'CS'} aktif menangani {filteredOrders.length} pesanan hari ini.
                                </SheetDescription>
                            </SheetHeader>
                            
                            {/* Mobile Close Button */}
                            {isMobile && (
                                <SheetClose className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                                    <ChevronDown className="w-5 h-5" />
                                </SheetClose>
                            )}
                        </div>
                        
                        {/* Tabs */}
                        <div className="grid grid-cols-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl">
                            <button 
                                onClick={() => setActiveTab('routes')}
                                className={`text-xs font-bold py-2.5 px-3 rounded-lg transition-all duration-200 ${activeTab === 'routes' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-700 dark:text-blue-400 ring-1 ring-black/5 dark:ring-white/10' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
                            >
                                Rute Teknisi
                            </button>
                            <button 
                                onClick={() => setActiveTab('capacity')}
                                className={`text-xs font-bold py-2.5 px-3 rounded-lg transition-all duration-200 ${activeTab === 'capacity' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-700 dark:text-blue-400 ring-1 ring-black/5 dark:ring-white/10' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
                            >
                                Kapasitas & Statistik
                            </button>
                        </div>
                     </div>

                     {/* Content */}
                     <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin bg-slate-50 dark:bg-slate-900/50">
                         {activeTab === 'routes' ? <ScheduleList isMobile={isMobile} /> : <CapacityDashboard />}
                     </div>
                </SheetContent>
             </Sheet>
        </div>
    </div>
  );
}
