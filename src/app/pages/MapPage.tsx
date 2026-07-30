import React, { useMemo, useState, useRef, useCallback } from 'react';
import { MapCard } from '../components/ui/MapCard';
import { useMasterData } from '@/app/pages/master-data/context';
import { MapPin, UserCog, User, Loader2, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { getCoordinatesFromUrl } from '../../utils/mapUtils';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import L from 'leaflet';
import { Order } from './master-data/data';

const TECH_COLORS = [
  '#2563EB', // Blue 600
  '#DC2626', // Red 600
  '#059669', // Green 600
  '#D97706', // Amber 600
  '#7C3AED', // Violet 600
  '#DB2777', // Pink 600
  '#0891B2', // Cyan 600
  '#4F46E5', // Indigo 600
];

const CS_COLORS = [
  '#DB2777', // Pink 600
  '#7C3AED', // Violet 600
  '#059669', // Green 600
  '#D97706', // Amber 600
  '#2563EB', // Blue 600
  '#DC2626', // Red 600
  '#0891B2', // Cyan 600
  '#4F46E5', // Indigo 600
];

type ViewMode = 'technician' | 'cs';

export const MapPage = () => {
  const { branches, users } = useMasterData(); // Don't pull 'orders' from global context to save memory
  const [filterBranch, setFilterBranch] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('technician');
  const [isLegendOpen, setIsLegendOpen] = useState(true);

  // Lazy Loading States
  const [lazyOrders, setLazyOrders] = useState<Order[]>([]);
  const [loadingMap, setLoadingMap] = useState(false);
  const [autoFit, setAutoFit] = useState(true); // Only auto-fit on first load
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Fetch orders based on map bounds
  const fetchOrdersInBounds = useCallback(async (bounds: L.LatLngBounds) => {
    setLoadingMap(true);
    try {
        const minLat = bounds.getSouth();
        const maxLat = bounds.getNorth();
        const minLng = bounds.getWest();
        const maxLng = bounds.getEast();

        // Query Supabase directly
        // Limit to 500 points to prevent browser crash if area is too large
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .neq('status', 'cancelled')
            .gte('lat', minLat)
            .lte('lat', maxLat)
            .gte('lng', minLng)
            .lte('lng', maxLng)
            .limit(500);

        if (error) throw error;

        if (data) {
            // Transform and merge if necessary, or just replace
            // Replacing is better for memory management in Lazy Loading
            // @ts-ignore
            setLazyOrders(data);
            
            if (data.length === 500) {
                toast.warning("Area terlalu luas. Hanya menampilkan 500 pesanan teratas.", {
                    id: 'map-limit-warning', // Prevent duplicate toasts
                    duration: 3000
                });
            }
        }
    } catch (err) {
        console.error("Error fetching map points:", err);
    } finally {
        setLoadingMap(false);
    }
  }, []);

  const handleBoundsChange = useCallback((bounds: L.LatLngBounds) => {
      // Disable auto-fit after user interaction starts
      setAutoFit(false);

      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      debounceTimer.current = setTimeout(() => {
          fetchOrdersInBounds(bounds);
      }, 800); // 800ms debounce
  }, [fetchOrdersInBounds]);

  // Prepare points for the map
  const mapPoints = useMemo(() => {
    // 1. Process Branches first (needed for start points in tech view)
    const branchPoints = branches
      .filter(b => b.lat && b.lng)
      .map(b => ({
        id: b.id,
        name: b.name,
        lat: b.lat!,
        lng: b.lng!,
        address: b.address,
        type: 'branch',
        radius: b.radius || 0,
        status: b.status, // Pass status for visual differentiation
        openingDate: b.openingDate // Pass opening date for popup
      }));

    // 2. Process Orders (Use LazyOrders)
    const orderPoints = lazyOrders
      .map(o => {
        let lat = o.lat;
        let lng = o.lng;
        
        // Skip fallback parsing for Lazy Loading to save client CPU
        // We assume DB has correct lat/lng from the query
        if (!lat || !lng) return null;

        // Filter by branch (Client side filter is fine for small subset)
        if (filterBranch !== 'all' && o.branchId !== filterBranch) return null;

        // Find related users (from context is fine, users list is small)
        const tech = users.find(u => u.id === o.technicianId);
        const cs = users.find(u => u.id === o.csId);
        
        const isHomeService = o.serviceCategory === 'Home Service';

        return {
          id: o.id,
          name: `Order #${o.id.slice(0, 8)}`, // Anonymized
          lat,
          lng,
          address: o.address,
          type: 'customer',
          status: o.status,
          technicianId: o.technicianId,
          technicianName: tech ? tech.name : 'Unassigned',
          csId: o.csId,
          csName: cs ? cs.name : 'Unassigned CS',
          orderId: o.id,
          iconType: isHomeService ? 'home' : 'building',
          serviceCategory: o.serviceCategory
        };
      })
      .filter(Boolean) as any[];

    // 3. Grouping Logic
    const groups: any[] = [];
    
    if (viewMode === 'technician') {
        // --- TECHNICIAN VIEW ---
        const technicianGroups: Record<string, typeof orderPoints> = {};
        const noTechGroup: typeof orderPoints = [];

        orderPoints.forEach(point => {
            if (point.technicianId) {
                if (!technicianGroups[point.technicianId]) {
                    technicianGroups[point.technicianId] = [];
                }
                technicianGroups[point.technicianId].push(point);
            } else {
                noTechGroup.push(point);
            }
        });

        let colorIndex = 0;
        Object.keys(technicianGroups).forEach(techId => {
            const tech = users.find(u => u.id === techId);
            const techName = tech?.name || 'Unknown Tech';
            const techBranchId = tech?.branchId;
            
            const branchPoint = techBranchId ? branchPoints.find(b => b.id === techBranchId) : null;
            
            const points = technicianGroups[techId];
            const routingPoints = [...points];
            
            if (branchPoint) {
                routingPoints.unshift({
                    id: `start-${techId}`,
                    name: `Mulai: ${branchPoint.name}`,
                    lat: branchPoint.lat,
                    lng: branchPoint.lng,
                    address: branchPoint.address || '',
                    status: 'branch_start',
                    technicianName: techName
                });
            }

            const color = TECH_COLORS[colorIndex % TECH_COLORS.length];
            colorIndex++;

            groups.push({
                id: techId,
                technicianName: techName,
                color: color,
                points: routingPoints,
                hidePolyline: true
            });
        });

        if (noTechGroup.length > 0) {
            groups.push({
                id: 'unassigned',
                technicianName: 'Belum Ditugaskan',
                color: '#94A3B8',
                points: noTechGroup,
                hidePolyline: true
            });
        }

    } else {
        // --- CS VIEW ---
        const csGroups: Record<string, typeof orderPoints> = {};
        const noCsGroup: typeof orderPoints = [];

        orderPoints.forEach(point => {
            if (point.csId) {
                if (!csGroups[point.csId]) {
                    csGroups[point.csId] = [];
                }
                csGroups[point.csId].push(point);
            } else {
                noCsGroup.push(point);
            }
        });

        let colorIndex = 0;
        Object.keys(csGroups).forEach(csId => {
            const cs = users.find(u => u.id === csId);
            const csName = cs?.name || 'Unknown CS';
            
            const color = CS_COLORS[colorIndex % CS_COLORS.length];
            colorIndex++;

            const coloredPoints = csGroups[csId].map(p => ({
                ...p,
                markerColor: color 
            }));

            groups.push({
                id: csId,
                technicianName: csName,
                color: color,
                points: coloredPoints,
                hidePolyline: true
            });
        });

        if (noCsGroup.length > 0) {
            groups.push({
                id: 'unassigned-cs',
                technicianName: 'No CS',
                color: '#94A3B8',
                points: noCsGroup,
                hidePolyline: true
            });
        }
    }

    return {
        branches: branchPoints,
        groups
    };
  }, [lazyOrders, branches, users, filterBranch, viewMode]);

  const stats = useMemo(() => {
      const totalCustomers = mapPoints.groups.reduce((acc, group) => {
          return acc + group.points.filter((p: any) => !p.id.startsWith('start-')).length;
      }, 0);

      const serviceCounts = {
          pending: 0, reschedule: 0, processing: 0, waiting: 0, done: 0, cancelled: 0
      };

      mapPoints.groups.forEach(group => {
          group.points.forEach((p: any) => {
              if (p.id.startsWith('start-')) return;
              const status = p.status as keyof typeof serviceCounts;
              if (serviceCounts[status] !== undefined) {
                  serviceCounts[status]++;
              }
          });
      });

      const branchCounts = { active: 0, coming_soon: 0, ready: 0 };

      mapPoints.branches.forEach(b => {
          const status = b.status as keyof typeof branchCounts;
          if (branchCounts[status] !== undefined) {
              branchCounts[status]++;
          }
      });

      return { totalCustomers, serviceCounts, branchCounts };
  }, [mapPoints]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50 dark:bg-slate-900">
      {/* Header Controls */}
      <div className="flex-none p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10 shadow-sm flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
        <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                Peta Sebaran
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                {viewMode === 'technician' ? 'Visualisasi rute teknisi.' : 'Visualisasi sebaran CS.'}
                {loadingMap && <span className="text-blue-600 flex items-center gap-1 text-xs"><Loader2 className="w-3 h-3 animate-spin" /> Memuat area...</span>}
            </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
            {/* View Mode Toggle */}
            <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg flex items-center border border-slate-200 dark:border-slate-700">
                <button
                    onClick={() => setViewMode('technician')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2 ${
                        viewMode === 'technician' 
                        ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    <UserCog className="w-3.5 h-3.5" />
                    Teknisi
                </button>
                <button
                    onClick={() => setViewMode('cs')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2 ${
                        viewMode === 'cs' 
                        ? 'bg-white dark:bg-slate-700 text-pink-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    <User className="w-3.5 h-3.5" />
                    CS View
                </button>
            </div>

            <Select value={filterBranch} onValueChange={setFilterBranch}>
                <SelectTrigger className="w-[160px] bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="Filter Cabang" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Semua Cabang</SelectItem>
                    {branches.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
      </div>

      {/* Map Content */}
      <div className="flex-1 relative bg-slate-100 dark:bg-slate-950">
         <MapCard 
            branches={mapPoints.branches}
            groups={mapPoints.groups}
            height="100%"
            width="100%"
            className="h-full w-full rounded-none border-0"
            showLegend={false}
            onLegendClick={() => setIsLegendOpen(true)}
            onBoundsChange={handleBoundsChange}
            autoFit={autoFit}
         />
         
         {/* Custom Legend */}
         {isLegendOpen && (
            <div className="absolute top-6 left-4 right-4 md:left-6 md:w-auto md:max-w-xs bg-white/90 dark:bg-slate-900/90 backdrop-blur p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg z-[400] flex flex-col gap-3">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span>Keterangan</span>
                        <span className="text-[10px] font-normal text-slate-500 uppercase px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                            {viewMode === 'technician' ? 'Teknisi' : 'CS'}
                        </span>
                    </div>
                    <button 
                        onClick={() => setIsLegendOpen(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </h3>
                
                {viewMode === 'technician' ? (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-3 custom-scrollbar">
                        <div>
                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 flex justify-between">
                                <span>Status Service</span>
                                <span className="text-slate-400 font-normal normal-case">{stats.totalCustomers} Order (Area Ini)</span>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div><span className="text-[10px] text-slate-600">Pending</span></div>
                                    <span className="text-[10px] font-medium text-slate-400">{stats.serviceCounts.pending}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div><span className="text-[10px] text-slate-600">Proses</span></div>
                                    <span className="text-[10px] font-medium text-slate-400">{stats.serviceCounts.processing}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-500"></div><span className="text-[10px] text-slate-600">Selesai</span></div>
                                    <span className="text-[10px] font-medium text-slate-400">{stats.serviceCounts.done}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-3 custom-scrollbar">
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Warna Pin per CS</div>
                        <div className="space-y-1.5">
                            {mapPoints.groups.map(g => (
                                <div key={g.id} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: g.color }}></div>
                                    <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">
                                        {g.technicianName} ({g.points.length})
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
         )}
      </div>
    </div>
  );
};
