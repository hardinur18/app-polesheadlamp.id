import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, LayerGroup, Tooltip, Circle, ScaleControl, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
// import 'leaflet/dist/leaflet.css'; // Disabled to prevent bundler errors with assets
import { IndicatorBadge as Badge, BadgeStatus } from './IndicatorBadge';
import { Clock, Ruler, User as UserIcon, Navigation, Building2, Layers, Timer, AlertTriangle, Info, Type, Calendar, X } from 'lucide-react';

export interface RoutePoint {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  status: BadgeStatus;
  time?: string;
  distance?: string;
  travelTimeEstimate?: string;
  technicianName?: string;
  isFallback?: boolean;
  orderIndex?: number;
  markerColor?: string; // Optional override for marker color
  iconType?: 'home' | 'building'; // 'home' for Home Service, 'building' for Visit
}

export interface BranchPoint {
  id: string;
  name: string;
  code?: string;
  address?: string;
  lat: number;
  lng: number;
  radius?: number; // Radius in km
  status?: 'active' | 'inactive' | 'coming_soon';
  openingDate?: string;
}

export interface RouteGroup {
  id: string; 
  technicianName: string;
  color: string;
  points: RoutePoint[];
  hidePolyline?: boolean; // Option to hide route line
}

interface MapCardProps {
  routes?: RoutePoint[]; 
  groups?: RouteGroup[];
  branches?: BranchPoint[];
  showLegend?: boolean;
  showRadius?: boolean; // External control for radius
  hideControls?: boolean; // Hide internal map controls
  showLocationControl?: boolean; // Compatibility prop for callers that control location UI externally
  disableRouting?: boolean; // Disable OSRM routing fetches
  onLegendClick?: () => void; // Callback for legend button
  onBoundsChange?: (bounds: L.LatLngBounds) => void;
  autoFit?: boolean;
  height?: string;
  width?: string;
  className?: string; 
}

// Custom Pin Icon
const createPinIcon = (status: string, index?: number, overrideColor?: string, iconType?: 'home' | 'building') => {
    let color = overrideColor || '#64748B'; 
    
    if (!overrideColor) {
        switch (status) {
            case 'pending': color = '#EAB308'; break; 
            case 'processing': color = '#3B82F6'; break; 
            case 'done': color = '#22C55E'; break; 
            case 'cancelled': color = '#EF4444'; break; 
            case 'waiting': color = '#F97316'; break; 
            case 'reschedule': color = '#F59E0B'; break; 
        }
    }
    
    // Inner content based on iconType
    let innerContent = `<circle cx="12" cy="10" r="3" fill="white"></circle>`;
    
    if (iconType === 'building') {
        // Wrench/Building symbol (simplified as a square for clarity)
        innerContent = `<rect x="9" y="7" width="6" height="6" rx="1" fill="white"></rect>`;
    } else if (iconType === 'home') {
        // Home/Car symbol (simplified as a triangle/house shape)
        innerContent = `<path d="M12 6L7 11H17L12 6Z M8 11V14H16V11" fill="white"></path>`;
    }

    // If index exists, we use text instead
    const content = index ? `
      <svg viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="7" fill="white" opacity="0.95"></circle>
        <text x="12" y="10" dy=".35em" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle" fill="${color}" stroke="none">${index}</text>
      </svg>
    ` : `
      <svg viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        ${innerContent}
      </svg>
    `;

    return L.divIcon({
        className: 'custom-pin-icon',
        html: `<div style="width: 24px; height: 24px; filter: drop-shadow(0 2px 2px rgb(0 0 0 / 0.15)); transition: transform 0.2s;">${content}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 24], 
        popupAnchor: [0, -24]
    });
};

const createBranchIcon = (status: string = 'active') => {
    // Defines styles for different statuses
    const styles = {
        active: {
            color1: '#3B82F6', // Blue 500
            color2: '#1E40AF', // Blue 800
            icon: `<path d="M3 21h18M5 21V7l8-4 8 4v14M8 11h2M14 11h2M8 15h2M14 15h2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`, // Building
            glow: 'rgba(59, 130, 246, 0.4)'
        },
        coming_soon: {
            color1: '#F59E0B', // Amber 500
            color2: '#B45309', // Amber 700
            icon: `<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" fill="white"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`, // Rocket
            glow: 'rgba(245, 158, 11, 0.4)'
        },
        ready: {
            color1: '#10B981', // Emerald 500
            color2: '#047857', // Emerald 700
            icon: `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 4L12 14.01l-3-3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`, // Check Circle / Ready
            glow: 'rgba(16, 185, 129, 0.4)'
        }
    };

    const style = styles[status as keyof typeof styles] || styles.active;

    // Modern Pin Shape SVG with Gradient
    const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 56" width="26" height="32" fill="none">
        <defs>
            <linearGradient id="grad-${status}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${style.color1};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${style.color2};stop-opacity:1" />
            </linearGradient>
            <filter id="shadow-${status}" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="rgba(0,0,0,0.3)" />
            </filter>
        </defs>
        <g filter="url(#shadow-${status})">
            <path d="M24 0C10.745 0 0 10.745 0 24c0 10.128 17.6 29.7 22.254 34.614a2.625 2.625 0 0 0 3.492 0C30.4 53.7 48 34.128 48 24 48 10.745 37.255 0 24 0z" fill="url(#grad-${status})" />
            <circle cx="24" cy="24" r="20" fill="white" opacity="0.15" />
            <g transform="translate(12, 12) scale(1)">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    ${style.icon}
                </svg>
            </g>
        </g>
    </svg>`;

    return L.divIcon({
        className: 'custom-branch-icon',
        html: `<div style="width: 26px; height: 32px; display: flex; align-items: center; justify-content: center; transform-origin: bottom center; transition: all 0.3s ease;">${svgIcon}</div>`,
        iconSize: [26, 32],
        iconAnchor: [13, 32], 
        popupAnchor: [0, -32]
    });
};

const FitBounds = ({ groups, branches, autoFit = true }: { groups: RouteGroup[], branches?: BranchPoint[], autoFit?: boolean }) => {
    const map = useMap();
    
    useEffect(() => {
        if (!autoFit) return;
        if (!groups.length && (!branches || branches.length === 0)) return;
        
        const bounds = L.latLngBounds([]);
        let hasPoints = false;
        
        groups.forEach(group => {
            group.points.forEach(p => {
                if (p.lat && p.lng) {
                    bounds.extend([p.lat, p.lng]);
                    hasPoints = true;
                }
            });
        });

        if (branches) {
            branches.forEach(b => {
                if (b.lat && b.lng) {
                    bounds.extend([b.lat, b.lng]);
                    hasPoints = true;
                }
            });
        }

        if (hasPoints && map) {
             // Add a small delay and check if map container exists to prevent "_leaflet_pos" errors during transitions
             const timeoutId = setTimeout(() => {
                // @ts-ignore - Accessing internal property to check if map is valid
                if (map && map._container) {
                    try {
                        map.fitBounds(bounds, { 
                            padding: [50, 50],
                            animate: false // Disable animation to prevent transition conflicts
                        });
                    } catch (e) {
                        console.warn("Map fitBounds error:", e);
                    }
                }
             }, 100);
             
             return () => clearTimeout(timeoutId);
        }
    }, [groups, branches, map, autoFit]);

    return null;
};

const MapEvents = ({ onBoundsChange }: { onBoundsChange?: (bounds: L.LatLngBounds) => void }) => {
    const map = useMap();
    
    useEffect(() => {
        if (!onBoundsChange) return;

        const handleMoveEnd = () => {
            onBoundsChange(map.getBounds());
        };

        // Trigger once on mount
        handleMoveEnd();

        map.on('moveend', handleMoveEnd);
        return () => {
            map.off('moveend', handleMoveEnd);
        };
    }, [map, onBoundsChange]);

    return null;
};

// --- SMART ROUTING COMPONENT ---
const SmartPolyline = ({ points, color, disableRouting = false }: { points: RoutePoint[], color: string, disableRouting?: boolean }) => {
    const [path, setPath] = useState<[number, number][]>([]);
    const [isFetching, setIsFetching] = useState(false);
    
    // Stable key to prevent infinite loops in useEffect
    const pointsKey = JSON.stringify(points.map(p => ({ lat: p.lat, lng: p.lng })));
    
    const validPoints = useMemo(() => {
        return points.filter(p => p.lat && p.lng);
    }, [pointsKey]);

    useEffect(() => {
        let isMounted = true;

        if (validPoints.length < 2) {
            setPath(validPoints.map(p => [p.lat, p.lng]));
            return;
        }

        // Default to straight line first
        const straightPath = validPoints.map(p => [p.lat, p.lng] as [number, number]);
        setPath(straightPath);

        if (disableRouting) return; // Skip fetching if disabled

        const fetchRoute = async () => {
            if (!isMounted) return;
            
            // Create a new abort controller for this fetch
            const controller = new AbortController();
            // Store it so we can abort it if needed (though we mostly rely on unmount cleanup)
            
            setIsFetching(true);
            try {
                // Construct OSRM URL: {lon},{lat};{lon},{lat}...
                const coordsString = validPoints
                    .map(p => `${p.lng},${p.lat}`)
                    .join(';');

                // Use OSRM public demo server (more reliable alternative)
                // We use routing.openstreetmap.de which is often more stable for standard driving routes
                const url = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;
                
                const response = await fetch(url, { signal: controller.signal });
                if (!response.ok) throw new Error(`OSRM error: ${response.status}`);
                
                const data = await response.json();
                if (isMounted && data.routes && data.routes[0]) {
                    // OSRM returns [lon, lat], Leaflet needs [lat, lon]
                    const decodedPath = data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
                    setPath(decodedPath);
                }
            } catch (e: any) {
                // Ignore abort errors
                if (e.name === 'AbortError') return;
                
                console.warn("Failed to fetch route geometry, falling back to straight lines.", e);
                // Fallback is already set
            } finally {
                if (isMounted) setIsFetching(false);
            }
            
            return controller;
        };

        // Debounce fetching
        let controller: AbortController | null = null;
        const timeoutId = setTimeout(async () => {
            controller = await fetchRoute() || null;
        }, 500);

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
            if (controller) controller.abort();
        };
    }, [pointsKey]); // Use stable key instead of validPoints array reference

    if (path.length < 2) return null;

    return (
        <Polyline 
            positions={path}
            pathOptions={{ 
                color: color, 
                weight: 5, 
                opacity: isFetching ? 0.5 : 0.9, 
                dashArray: isFetching ? '10, 10' : undefined,
                lineCap: 'round',
                lineJoin: 'round'
            }}
        >
             {!isFetching && (
                <Tooltip sticky direction="top" offset={[0, -10]}>
                    <span className="flex items-center gap-1 text-xs font-semibold">
                        <Navigation className="w-3 h-3" /> Rute Jalan
                    </span>
                </Tooltip>
             )}
        </Polyline>
    );
};

export function MapCard({ 
    routes = [], 
    groups = [], 
    branches = [], 
    showLegend = true, 
    showRadius: externalShowRadius,
    hideControls = false,
    disableRouting = false,
    onLegendClick,
    onBoundsChange,
    autoFit = true,
    height = '400px',  
    width = '100%', 
    className = '' 
}: MapCardProps) {
  useEffect(() => {
    // Inject Leaflet CSS from CDN to avoid bundler issues with relative asset paths
    const linkId = 'leaflet-css-cdn';
    if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        link.crossOrigin = '';
        document.head.appendChild(link);
    }
  }, []);

  const defaultCenter: [number, number] = [-6.2088, 106.8456];
  const [internalShowRadius, setInternalShowRadius] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showMonthFilter, setShowMonthFilter] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // Extract available months from coming_soon branches
  const availableMonths = useMemo(() => {
      const months = new Set<string>();
      branches.forEach(branch => {
          if (branch.status === 'coming_soon' && branch.openingDate) {
              const date = new Date(branch.openingDate);
              if (isNaN(date.getTime())) return;
              
              const monthKey = `${date.getFullYear()}-${date.getMonth()}`; // format: YYYY-M (0-11)
              months.add(monthKey);
          }
      });
      
      return Array.from(months).sort((a, b) => {
          // Sort chronologically
          const [yearA, monthA] = a.split('-').map(Number);
          const [yearB, monthB] = b.split('-').map(Number);
          return yearA - yearB || monthA - monthB;
      }).map(key => {
          const [year, month] = key.split('-').map(Number);
          const date = new Date(year, month);
          return {
              key,
              label: date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
          };
      });
  }, [branches]);

  // Filter branches based on selected month
  const filteredBranches = useMemo(() => {
      if (!selectedMonth) return branches;
      
      return branches.filter(branch => {
          // Always show active/inactive branches
          if (branch.status !== 'coming_soon') return true;
          
          // For coming_soon, check if it matches selected month
          if (!branch.openingDate) return false;
          
          const date = new Date(branch.openingDate);
          if (isNaN(date.getTime())) return false;
          
          const key = `${date.getFullYear()}-${date.getMonth()}`;
          return key === selectedMonth;
      });
  }, [branches, selectedMonth]);
  
  // Use external prop if provided, otherwise internal state
  const showRadius = externalShowRadius !== undefined ? externalShowRadius : internalShowRadius;
  
  const displayGroups: RouteGroup[] = groups.length > 0 
      ? groups 
      : routes.length > 0 
          ? [{ id: 'default', technicianName: 'Rute', color: '#0E7490', points: routes }] 
          : [];

  return (
    <div 
        className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm flex flex-col relative group ${className}`}
        style={{ height }}
    >
        {/* Map Toggle Controls */}
        {!hideControls && (
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
            {/* Radius Toggle */}
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setInternalShowRadius(!internalShowRadius);
                }}
                className={`w-10 h-10 rounded-xl shadow-lg border transition-all duration-200 flex items-center justify-center ${
                    showRadius 
                    ? 'bg-white border-blue-100 text-blue-600' 
                    : 'bg-white border-slate-100 text-slate-400 hover:text-slate-600'
                } hover:shadow-xl`}
                title={showRadius ? "Sembunyikan Radius" : "Tampilkan Radius"}
            >
                <Layers className="w-5 h-5" />
                <span className="sr-only">Toggle Radius</span>
            </button>

            {/* Labels Toggle */}
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowLabels(!showLabels);
                }}
                className={`w-10 h-10 rounded-xl shadow-lg border transition-all duration-200 flex items-center justify-center ${
                    showLabels 
                    ? 'bg-white border-blue-100 text-blue-600' 
                    : 'bg-white border-slate-100 text-slate-400 hover:text-slate-600'
                } hover:shadow-xl`}
                title={showLabels ? "Sembunyikan Label" : "Tampilkan Label"}
            >
                <Type className="w-5 h-5" />
                <span className="sr-only">Toggle Labels</span>
            </button>

            {/* Month Filter Toggle - Only show if there are coming soon branches with dates */}
            {availableMonths.length > 0 && (
                <div className="relative">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowMonthFilter(!showMonthFilter);
                        }}
                        className={`w-10 h-10 rounded-xl shadow-lg border transition-all duration-200 flex items-center justify-center ${
                            selectedMonth 
                            ? 'bg-blue-600 border-blue-600 text-white' 
                            : showMonthFilter
                                ? 'bg-white border-blue-100 text-blue-600'
                                : 'bg-white border-slate-100 text-slate-400 hover:text-slate-600'
                        } hover:shadow-xl`}
                        title="Filter Bulan Buka"
                    >
                        <Calendar className="w-5 h-5" />
                        <span className="sr-only">Filter Bulan</span>
                    </button>

                    {/* Dropdown Menu */}
                    {showMonthFilter && (
                        <div className="absolute right-12 top-0 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden py-1 z-[1100] animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estimasi Buka</span>
                                {selectedMonth && (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedMonth(null);
                                            setShowMonthFilter(false);
                                        }}
                                        className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
                                    >
                                        <X className="w-3 h-3" /> Reset
                                    </button>
                                )}
                            </div>
                            <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedMonth(null);
                                        setShowMonthFilter(false);
                                    }}
                                    className={`w-full px-3 py-2 text-left text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                                        selectedMonth === null 
                                            ? 'text-blue-600 font-bold bg-blue-50 dark:bg-blue-900/20' 
                                            : 'text-slate-600 dark:text-slate-300'
                                    }`}
                                >
                                    Semua Bulan
                                </button>
                                {availableMonths.map((month) => (
                                    <button
                                        key={month.key}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedMonth(month.key);
                                            setShowMonthFilter(false);
                                        }}
                                        className={`w-full px-3 py-2 text-left text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                                            selectedMonth === month.key 
                                                ? 'text-blue-600 font-bold bg-blue-50 dark:bg-blue-900/20' 
                                                : 'text-slate-600 dark:text-slate-300'
                                        }`}
                                    >
                                        {month.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Legend Toggle */}
            {onLegendClick && (
                 <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onLegendClick();
                    }}
                    className="w-10 h-10 bg-white rounded-xl shadow-lg border border-slate-100 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:shadow-xl transition-all duration-200"
                    title="Tampilkan Keterangan"
                >
                    <Info className="w-5 h-5" />
                    <span className="sr-only">Show Legend</span>
                </button>
            )}
        </div>
        )}

      <div style={{ height: showLegend ? 'calc(100% - 80px)' : '100%', width }} className="relative z-0 flex-1">
         <MapContainer 
            center={defaultCenter} 
            zoom={13} 
            scrollWheelZoom={true} 
            zoomControl={false}
            style={{ height: '100%', width: '100%' }}
         >
            <ZoomControl position="bottomleft" />
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <ScaleControl position="bottomleft" imperial={false} />
            
            <FitBounds groups={displayGroups} branches={filteredBranches} autoFit={autoFit} />
            <MapEvents onBoundsChange={onBoundsChange} />

            {/* Branch Markers */}
            {filteredBranches.map((branch) => (
                <LayerGroup key={`branch-${branch.id}`}>
                    <Marker 
                        position={[branch.lat, branch.lng]}
                        icon={createBranchIcon(branch.status)}
                        zIndexOffset={1000}
                    >
                        <Popup>
                            <div className="p-1 min-w-[150px]">
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-700">
                                    <Building2 className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                                    <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                        {branch.status === 'coming_soon' ? 'Segera Hadir' : 'Cabang Operasional'}
                                    </span>
                                </div>
                                <h3 className="font-bold text-slate-900 text-sm mb-1">{branch.name}</h3>
                                {branch.address && <p className="text-xs text-slate-600">{branch.address}</p>}
                                
                                {branch.status === 'coming_soon' && branch.openingDate && (
                                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-100 rounded text-xs text-yellow-800">
                                        <span className="font-bold block">Estimasi Buka:</span>
                                        {new Date(branch.openingDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </div>
                                )}

                                {branch.radius && branch.status !== 'coming_soon' && (
                                    <p className="text-[10px] text-slate-500 mt-1">
                                        Coverage Radius: {branch.radius} km
                                    </p>
                                )}
                            </div>
                        </Popup>
                        {showLabels && (
                        <Tooltip 
                            direction="top" 
                            offset={[0, -25]} 
                            opacity={1} 
                            permanent
                            className="!border-0 !p-0 !bg-transparent !shadow-none"
                        >
                            <div className="flex flex-col items-center group/tooltip">
                                <div className="relative px-3 py-1.5 rounded-lg bg-slate-900 text-center shadow-xl ring-1 ring-white/20 transform transition-all duration-200 group-hover/tooltip:scale-105">
                                    <div className="font-bold text-[12px] text-white uppercase tracking-wider font-sans whitespace-nowrap leading-none">
                                        {branch.name}
                                    </div>
                                    {branch.status === 'coming_soon' && (
                                        <div className="flex flex-col gap-0.5 mt-1 border-t border-white/10 pt-1">
                                            <div className="text-[9px] font-bold text-yellow-400 tracking-wide uppercase leading-none">
                                                Coming Soon
                                            </div>
                                            {branch.openingDate && (
                                                <div className="text-[8px] font-medium text-slate-300 leading-none">
                                                    Est: {new Date(branch.openingDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {/* Small arrow pointer */}
                                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900 mt-[-1px] drop-shadow-sm"></div>
                            </div>
                        </Tooltip>
                        )}
                    </Marker>
                    
                    {/* Radius Circle Overlay */}
                    {branch.radius && showRadius && (
                        <LayerGroup>
                            <Circle 
                                center={[branch.lat, branch.lng]}
                                radius={Number(branch.radius) * 1000} // Convert km to meters (Leaflet uses meters)
                                pathOptions={{ 
                                    color: branch.status === 'coming_soon' ? '#F59E0B' : '#3B82F6', 
                                    fillColor: branch.status === 'coming_soon' ? '#F59E0B' : '#3B82F6', 
                                    fillOpacity: 0.1, // Slightly increased opacity as requested
                                    weight: 2, // Thicker line as requested
                                    dashArray: '6, 6' 
                                }} 
                            >
                                <Tooltip sticky direction="top">
                                    <span className="text-xs font-bold">
                                        Radius: {branch.radius} KM (Kilometer)
                                    </span>
                                </Tooltip>
                            </Circle>
                            
                            {/* Visual Radius Measurement Line (Eastward) to prove scale */}
                            <Polyline 
                                positions={[
                                    [Number(branch.lat), Number(branch.lng)],
                                    [Number(branch.lat), Number(branch.lng) + (Number(branch.radius) / 111.32)] 
                                ]}
                                pathOptions={{ color: '#0F172A', weight: 2, opacity: 0.7, dashArray: '4, 4' }} // Thicker and darker measurement line
                            >
                                <Tooltip permanent direction="right" offset={[10, 0]} className="bg-white/90 border border-slate-200 shadow-sm text-xs font-medium text-slate-700">
                                    {branch.radius} KM
                                </Tooltip>
                            </Polyline>
                        </LayerGroup>
                    )}
                </LayerGroup>
            ))}

            {displayGroups.map((group) => (
                <LayerGroup key={group.id}>
                    {/* Use SmartPolyline for road routing if not hidden */}
                    {!group.hidePolyline && <SmartPolyline points={group.points} color={group.color} disableRouting={disableRouting} />}

                    {/* Draw Markers */}
                    {group.points.map((point, index) => {
                        if (!point.lat || !point.lng) return null;
                        // Skip rendering start points (branch locations) as customer markers if they are marked as such
                        if (point.status === 'branch_start' as any) return null;

                        return (
                            <Marker 
                                key={`${group.id}-${point.id}`} 
                                position={[point.lat, point.lng]}
                                icon={createPinIcon(point.status, point.orderIndex, point.markerColor, point.iconType)}
                            >
                                <Popup>
                                    <div className="p-1 min-w-[200px]">
                                        {/* Technician Info Header */}
                                        {group.technicianName && (
                                            <div className="mb-2 pb-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                                                <div className="p-1 rounded bg-slate-100 dark:bg-slate-700">
                                                    <UserIcon className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                                                </div>
                                                <span className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                    {group.technicianName}
                                                </span>
                                            </div>
                                        )}
                                        
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className="font-bold text-slate-900 text-sm">{point.name}</h3>
                                            <Badge status={point.status} size="sm" />
                                        </div>
                                            <p className="text-xs text-slate-600 mb-2">{point.address}</p>
                                        {point.isFallback && (
                                            <div className="mb-2 bg-red-50 border border-red-100 rounded p-1.5 flex items-start gap-1.5">
                                                <AlertTriangle className="w-3 h-3 text-red-600 shrink-0 mt-0.5" />
                                                <p className="text-[10px] text-red-700 font-medium leading-tight">
                                                    Lokasi tidak akurat (Default)
                                                </p>
                                            </div>
                                        )}
                                        <div className="flex gap-3 text-xs text-slate-500">
                                            {point.time && (
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> {point.time}
                                                </span>
                                            )}
                                            {point.distance && (
                                                <span className="flex items-center gap-1">
                                                    <Ruler className="w-3 h-3" /> {point.distance}
                                                </span>
                                            )}
                                            {point.travelTimeEstimate && (
                                                <span className="flex items-center gap-1 text-blue-600 font-medium">
                                                    <Timer className="w-3 h-3" /> {point.travelTimeEstimate}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </Popup>
                                <Tooltip 
                                    direction="bottom" 
                                    offset={[0, 10]} 
                                    opacity={0.9} 
                                    className="custom-map-tooltip"
                                >
                                    <span className="font-bold text-[11px] text-slate-800 uppercase tracking-tight">{point.name}</span>
                                </Tooltip>
                            </Marker>
                        );
                    })}
                </LayerGroup>
            ))}
         </MapContainer>
      </div>
      
      {showLegend && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col gap-4 flex-shrink-0 z-10 relative">
          
          <div className="flex flex-col sm:flex-row gap-8">
            {/* Status Legend */}
            <div>
                <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Status (Warna Pin)</h4>
                <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500 border border-slate-300 shadow-sm"></div>
                        <span className="text-xs text-slate-600 dark:text-slate-300">Terjadwal</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500 border border-slate-300 shadow-sm"></div>
                        <span className="text-xs text-slate-600 dark:text-slate-300">Proses</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500 border border-slate-300 shadow-sm"></div>
                        <span className="text-xs text-slate-600 dark:text-slate-300">Selesai</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500 border border-slate-300 shadow-sm"></div>
                        <span className="text-xs text-slate-600 dark:text-slate-300">Cancel</span>
                    </div>
                </div>
            </div>

            {/* Technician Legend */}
            {displayGroups.length > 0 && (
                <div>
                    <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Jalur Teknisi (Warna Garis)</h4>
                    <div className="flex flex-wrap gap-4">
                        {displayGroups.map((group) => (
                            <div key={group.id} className="flex items-center gap-2">
                                <div 
                                    className="h-1 w-6 rounded-full"
                                    style={{ backgroundColor: group.color }}
                                ></div>
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{group.technicianName}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
