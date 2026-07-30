import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search, Plus, MapPin, Calendar, Clock, Map as MapIcon, Eye, MoreVertical,
  CheckCircle2, XCircle, Timer, Truck, Edit, Trash2, Package, RefreshCw, Banknote, Loader2, MessageCircle, Camera, CreditCard,
  User as UserIcon, Building2, ChevronDown, Settings, Megaphone, Filter, FileSpreadsheet, FileDown, FileUp, FileText, Ruler, Lock, AlertTriangle, Phone, ArrowUpDown, ArrowUp, ArrowDown, ClipboardList
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Modal } from '../components/ui/Modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { MapCard } from '../components/ui/MapCard';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "../components/ui/sheet"
import { Label } from "../components/ui/label"
import { useMasterData } from '@/app/pages/master-data/context';
import { usePermissions } from '@/app/hooks/usePermissions';
import { logActivity } from '@/app/services/auditService';
import { Order, WATemplate } from './master-data/data';
import { DatePickerWithRange } from '../components/ui/date-range-picker';
import { startOfDay, endOfDay } from 'date-fns';
import { OrderForm } from './orders/OrderForm';
import { OrderDetailDialog } from './orders/OrderDetailDialog';
import { OrderPaymentDialog } from './orders/OrderPaymentDialog';
import { OrderStatusReasonFields } from './orders/OrderStatusReasonFields';
import { toast } from 'sonner';
import { ImportPreviewModal } from './orders/ImportPreviewModal';
import { isReasonRequiredStatus } from './orders/cancelReasonOptions';
import { getCoordinatesFromUrl, expandShortUrl } from '../../utils/mapUtils';
import { Upload } from '../components/ui/Upload';
import { supabase } from '../../lib/supabaseClient';
import { copyToClipboard } from '@/lib/clipboard';
import {
  OperationalEmptyState,
  OperationalFilterPanel,
  OperationalKpiCard,
  OperationalKpiGrid,
  OperationalPageHeader,
  OperationalPageShell,
  OperationalTableCard,
} from '../components/ui/operational-page';
import {
  buildActiveScheduleConflictMap,
  getScheduleConflictItemKey,
  getTechnicianDaySchedule,
} from '@/app/services/orderScheduleValidation';

// Extracted modules
import { WhatsappIcon } from './orders/WhatsappIcon';
import { getStatusLabel, getStatusBadgeVariant, getStatusReasonSummary, normalizeReasonFilterValue } from './orders/orderHelpers';
import { useOrderLookupMaps } from './orders/hooks/useOrderLookupMaps';
import { useOrderFilters } from './orders/hooks/useOrderFilters';
import { useOrderPagination } from './orders/hooks/useOrderPagination';
import { useOrderExport } from './orders/hooks/useOrderExport';
import { useOrderImport } from './orders/hooks/useOrderImport';
import { useOrderBulkActions } from './orders/hooks/useOrderBulkActions';
import { useOrderStatusActions } from './orders/hooks/useOrderStatusActions';

export function Pesanan({ onNavigate }: { onNavigate?: (id: string) => void }) {
  // --- Context & Permissions ---
  const {
    orders = [],
    users = [],
    services = [],
    vehicles = [],
    deleteOrder,
    updateOrder,
    addOrder,
    branches: allBranches = [],
    activeBranches: branches = [],
    areas = [],
    currentRole,
    payments = [],
    waTemplates = [],
    currentUser,
    leads = [],
    platforms = [],
    subChannels = [],
    cancelReasons = [],
    technicianSchedules = [],
    prospectBookings = [],
  } = useMasterData();
  const { hasPermission, isOrderLocked } = usePermissions();
  const nonScheduleLeadIds = useMemo(
    () => new Set(
      leads
        .filter((lead) => lead.status === 'Cancel' || lead.status === 'Closing')
        .map((lead) => lead.id),
    ),
    [leads],
  );
  const scheduleBlockingProspectBookings = useMemo(
    () => prospectBookings.filter((booking) =>
      !booking.leadId || !nonScheduleLeadIds.has(booking.leadId)
    ),
    [nonScheduleLeadIds, prospectBookings],
  );
  const scheduleConflictByItemKey = useMemo(
    () => buildActiveScheduleConflictMap(orders, scheduleBlockingProspectBookings),
    [orders, scheduleBlockingProspectBookings]
  );
  const conflictOrderIds = useMemo(() => {
    const ids = new Set<string>();

    orders.forEach((order) => {
      if (scheduleConflictByItemKey.has(getScheduleConflictItemKey('order', order.id))) {
        ids.add(order.id);
      }
    });

    return ids;
  }, [orders, scheduleConflictByItemKey]);

  // --- Hooks ---
  const { userMap, branchMap, areaMap, serviceMap, platformMap, subChannelMap, paymentMap, vehicleMap } =
    useOrderLookupMaps({ users, branches, areas, services, platforms, subChannels, payments, vehicles });

  const filters = useOrderFilters({
    orders, users, services, vehicles, branches, platforms, subChannels, cancelReasons, currentUser, currentRole,
    conflictOrderIds,
  });

  const {
    search, setSearch,
    statusFilter, setStatusFilter,
    cancelReasonFilter, setCancelReasonFilter,
    technicianFilter, setTechnicianFilter,
    csFilter, setCsFilter,
    serviceFilter, setServiceFilter,
    serviceCategoryFilter, setServiceCategoryFilter,
    vehicleFilter, setVehicleFilter,
    platformFilter, setPlatformFilter,
    advertiserFilter, setAdvertiserFilter,
    branchFilter, setBranchFilter,
    areaFilter, setAreaFilter,
    paymentTypeFilter, setPaymentTypeFilter,
    paymentMethodFilter, setPaymentMethodFilter,
    paymentStatusFilter, setPaymentStatusFilter,
    paymentValidationFilter, setPaymentValidationFilter,
    affiliateFilter, setAffiliateFilter,
    subChannelFilter, setSubChannelFilter,
    scheduleConflictFilter, setScheduleConflictFilter,
    dateRange, setDateRange,
    dateFilterMode, setDateFilterMode,
    filteredOrdersBase, filteredOrders, statusCounts, cancelReasonFilterOptions,
    stats, activeFilterCount, accessibleOrders,
    availableBranches, availableTechnicians, availableCS, availablePlatforms, availableSubChannels,
    technicians, csUsers, advertisers, activeServices, serviceCategories, affiliateNames,
    resetSheetFilters,
    canAccessAllOrders, isAdminManagementUser, isAdvertiserUser, isCsUser, isTechnicianUser, isFinanceUser,
  } = filters;

  const pagination = useOrderPagination({
    filteredOrders, filteredOrdersBase, statusFilter, cancelReasonFilter,
  });
  const {
    currentPage, setCurrentPage, itemsPerPage, setItemsPerPage,
    selectedIds, setSelectedIds, sortConfig, requestSort,
    sortedOrders, totalPages, paginatedOrders, handleSelectAll, handleSelectRow,
  } = pagination;

  const statusActions = useOrderStatusActions({ updateOrder, currentUser });
  const {
    quickStatusChange, quickStatusReason, quickStatusReasonNote,
    setQuickStatusReason, setQuickStatusReasonNote,
    editingPriceId, setEditingPriceId, tempPrice, setTempPrice,
    resetQuickStatusChange, buildStatusUpdatePayload,
    openQuickStatusChange, handleInlineStatusChange, handleConfirmQuickStatusChange,
  } = statusActions;

  const { handleExportCSV, handleExportXLSX, handleExportPDF, handleDownloadTemplate } =
    useOrderExport({ filteredOrders, users, services, vehicles, branches, areas, platforms, payments });

  const {
    isImportPreviewOpen, setIsImportPreviewOpen,
    importPreviewData, setImportPreviewData, fileInputRef,
    handleImportClick, handleConfirmImport, handleImportOrders,
  } = useOrderImport({ users, services, vehicles, branches, areas, platforms, payments, addOrder });

  const bulkActions = useOrderBulkActions({
    orders, services, selectedIds, setSelectedIds,
    updateOrder, deleteOrder, currentUser, buildStatusUpdatePayload,
  });
  const {
    isBulkEditOpen, setIsBulkEditOpen,
    bulkField, setBulkField, bulkValue, setBulkValue,
    bulkStatusReason, setBulkStatusReason, bulkStatusReasonNote, setBulkStatusReasonNote,
    isMassDeleteOpen, setIsMassDeleteOpen,
    resetBulkEditor, handleBulkUpdate, handleMassDelete, confirmMassDelete,
  } = bulkActions;

  // --- Permissions (derived) ---
  const canViewOrderDetails = hasPermission('order.view_details');
  const canEditOrders = hasPermission('order.edit');
  const canDeleteOrders = hasPermission('order.delete');
  const canViewOrderPayments = hasPermission('order.payment.view');
  const canViewCustomerContact = hasPermission('customer.contact.view');
  const canViewStaffContact = hasPermission('staff.contact.view');
  const canViewRoute = hasPermission('map.view_route');
  const canAssignTechnician = hasPermission('order.assign_technician') || canEditOrders;
  const canEditOrderPrice = canEditOrders;
  const canUploadPaymentProof =
    hasPermission('order.payment.edit_status') ||
    hasPermission('finance.manage') ||
    canAccessAllOrders ||
    isCsUser;
  const canShowOrderActions =
    canViewCustomerContact ||
    canViewRoute ||
    canViewOrderDetails ||
    canViewOrderPayments ||
    canEditOrders ||
    canDeleteOrders;


  // --- Local UI State ---
  const [viewMode, setViewMode] = useState<'table' | 'map' | 'calendar'>('table');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [photoViewerOrder, setPhotoViewerOrder] = useState<Order | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [waSheetOpen, setWaSheetOpen] = useState(false);
  const [waTargetOrder, setWaTargetOrder] = useState<Order | null>(null);

  // --- Helpers ---
  const getTechnicianName = useCallback((id?: string) => users.find(u => u.id === id)?.name || '-', [users]);
  const getServiceName = useCallback((id?: string) => services.find(s => s.id === id)?.name || '-', [services]);
  const getVehicleName = useCallback((id?: string) => vehicles.find(v => v.id === id)?.name || '-', [vehicles]);
  const getTechnicianOffSchedule = useCallback(
    (technicianId?: string | null, serviceDate?: string | null) =>
      getTechnicianDaySchedule(technicianId, serviceDate, technicianSchedules),
    [technicianSchedules]
  );

  // --- Upload ---
  const uploadToStorage = async (file: File, path: string) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${path}/${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('orders').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('orders').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (e: any) {
      console.error('Upload failed:', e);
      throw e;
    }
  };

  const handleSavePaymentProof = async () => {
    if (!photoViewerOrder || uploadedFiles.length === 0) return;
    setIsUploading(true);
    try {
      const uploadPromises = uploadedFiles.map(file =>
        uploadToStorage(file, `${photoViewerOrder.id}/payment`)
      );
      const newPhotos = await Promise.all(uploadPromises);
      const currentPhotos = photoViewerOrder.photos || {};
      const existingPaymentPhotos = (currentPhotos as any)['payment'] || [];
      const updatedPhotos = { ...currentPhotos, payment: [...existingPaymentPhotos, ...newPhotos] };
      // @ts-ignore
      await updateOrder({ ...photoViewerOrder, photos: updatedPhotos });
      setPhotoViewerOrder(prev => prev ? ({ ...prev, photos: updatedPhotos }) : null);
      toast.success("Bukti pembayaran berhasil diupload");
      setUploadedFiles([]);
    } catch (e: any) {
      toast.error("Gagal upload: " + e.message);
    } finally {
      setIsUploading(false);
    }
  };

  // --- Coordinate Resolution ---
  const attemptedResolution = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    const resolveMissingCoordinates = async () => {
      const ordersToFix = orders.filter(o =>
        o.mapsUrl &&
        !attemptedResolution.current.has(o.id) &&
        (!o.lat || !o.lng || (Math.abs(o.lat - -6.2088) < 0.0001 && Math.abs((o.lng || 0) - 106.8456) < 0.0001))
      );

      if (ordersToFix.length === 0) return;

      for (const order of ordersToFix.slice(0, 5)) {
        attemptedResolution.current.add(order.id);
        try {
          let url = order.mapsUrl;
          if (url && (url.includes('goo.gl') || url.includes('maps.app.goo.gl'))) {
            const expanded = await expandShortUrl(url);
            if (expanded) url = expanded;
          }
          if (url) {
            const coords = getCoordinatesFromUrl(url);
            if (coords && !(Math.abs(coords.lat - -6.2088) < 0.0001 && Math.abs(coords.lng - 106.8456) < 0.0001)) {
              await updateOrder({ ...order, lat: coords.lat, lng: coords.lng });
            }
          }
        } catch (e) {
          console.error('Failed to resolve coordinates for order:', order.id, e);
        }
      }
    };

    resolveMissingCoordinates();
  }, [orders, updateOrder]);

  // --- Handlers ---
  const handleViewDetail = useCallback((order: Order) => {
    setDetailOrder(order);
    setIsDetailOpen(true);
  }, []);

  const handleViewPayment = useCallback((order: Order) => {
    setPaymentOrder(order);
    setIsPaymentDialogOpen(true);
  }, []);

  const handleEdit = useCallback((order: Order) => {
    setEditingOrder(order);
    setIsFormOpen(true);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setDeleteId(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteId) {
      const orderToDelete = orders.find(o => o.id === deleteId);
      deleteOrder(deleteId);
      toast.success('Pesanan berhasil dihapus');
      if (currentUser && orderToDelete) {
        logActivity(
          { id: currentUser.id, name: currentUser.name, role: currentUser.role },
          'DELETE',
          'Pesanan',
          `Menghapus pesanan: ${orderToDelete.customerName}`,
          deleteId
        );
      }
      setDeleteId(null);
    }
  }, [deleteId, orders, deleteOrder, currentUser]);

  // --- WhatsApp ---
  const isTemplateUsed = useCallback((order: Order, templateId: string) => {
    return order.templateHistory?.some(h => h.templateId === templateId);
  }, []);

  const handleWhatsappTemplate = useCallback((order: Order, template?: WATemplate) => {
    const phone = order.customerPhone.replace(/^0/, '62').replace(/\D/g, '');
    let message = "";

    if (template) {
      message = template.message;
      message = message.replace(/\[Nama\]/g, order.customerName);
      message = message.replace(/\[Mobil\]/g, getVehicleName(order.vehicleId));
      message = message.replace(/\[Order ID\]/g, '\`\`\`' + order.id + '\`\`\`');

      const newHistory = {
        templateId: template.id,
        templateName: template.title,
        sentAt: new Date().toISOString(),
        sentBy: currentUser?.id
      };

      updateOrder({
        ...order,
        templateHistory: [...(order.templateHistory || []), newHistory]
      });
    }

    const url = `https://wa.me/${phone}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
    window.open(url, '_blank');
  }, [getVehicleName, currentUser, updateOrder]);

  // --- Map Data ---
  const routeGroups = useMemo(() => {
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

    const groupedOrders: { [key: string]: Order[] } = {};
    filteredOrders.forEach(order => {
      const techId = order.technicianId || 'unassigned';
      if (!groupedOrders[techId]) groupedOrders[techId] = [];
      groupedOrders[techId].push(order);
    });

    return Object.entries(groupedOrders).map(([techId, techOrders], groupIndex) => {
      const technician = users.find(u => u.id === techId);
      const technicianName = technician ? technician.name : (techId === 'unassigned' ? 'Belum Ditugaskan' : 'Unknown');
      const color = TECH_COLORS[groupIndex % TECH_COLORS.length];

      const sorted = [...techOrders].sort((a, b) => {
        const timeA = a.serviceTime || '23:59';
        const timeB = b.serviceTime || '23:59';
        return timeA.localeCompare(timeB);
      });

      const points = sorted.map((order, index) => {
        let lat = order.lat;
        let lng = order.lng;
        let isFallback = false;

        if ((!lat || !lng) && order.mapsUrl) {
          const coords = getCoordinatesFromUrl(order.mapsUrl);
          if (coords) { lat = coords.lat; lng = coords.lng; }
        }

        const isDefaultLoc = (l: number, g: number) =>
          (Math.abs(l - -6.2088) < 0.0001 && Math.abs(g - 106.8456) < 0.0001);

        if (!lat || !lng || isDefaultLoc(lat, lng)) {
          lat = -6.2088;
          lng = 106.8456;
          isFallback = true;
        }

        if (isFallback) {
          const angle = index * (Math.PI / 3);
          const radius = 0.0004 + (index * 0.00005);
          lat += Math.cos(angle) * radius;
          lng += Math.sin(angle) * radius;
        }

        let distance = '0 km';
        let travelTimeEstimate = '';

        if (index > 0) {
          const prev = sorted[index - 1];
          let prevLat = prev.lat;
          let prevLng = prev.lng;

          if ((!prevLat || !prevLng) && prev.mapsUrl) {
            const prevCoords = getCoordinatesFromUrl(prev.mapsUrl);
            if (prevCoords) { prevLat = prevCoords.lat; prevLng = prevCoords.lng; }
          }

          if (!prevLat || !prevLng) { prevLat = -6.2088; prevLng = 106.8456; }

          if (lat && lng && prevLat && prevLng) {
            const d = getDistance(prevLat, prevLng, lat, lng);
            distance = `${d.toFixed(1)} km`;
            const minutes = Math.round(d * 2);
            const finalMinutes = minutes + (d > 0.5 ? 5 : 0);
            travelTimeEstimate = `\u00b1 ${finalMinutes} mnt`;
          }
        }

        return {
          id: order.id, name: order.customerName, address: order.address,
          lat: lat || 0, lng: lng || 0, status: order.status,
          time: order.serviceTime, distance, travelTimeEstimate,
          technicianName, isFallback, orderIndex: index + 1
        };
      });

      return { id: techId, technicianName, color, points };
    }).filter(group => group.points.length > 0);
  }, [filteredOrders, users]);

  const branchPoints = useMemo(() => {
    const parseBranchCoords = (url?: string) => {
      if (!url) return null;
      try {
        const patterns = [
          /@(-?\d+\.\d+),(-?\d+\.\d+)/,
          /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
          /search\/.*\/(-?\d+\.\d+),(-?\d+\.\d+)/
        ];
        for (const pattern of patterns) {
          const match = url.match(pattern);
          if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
        }
      } catch (e) { console.error(e); }
      return null;
    };

    return branches.map(branch => {
      let lat = branch.lat;
      let lng = branch.lng;
      let radius = branch.radius;

      if (branch.mapsUrl) {
        const coords = parseBranchCoords(branch.mapsUrl);
        if (coords) {
          return { id: branch.id, name: branch.name, code: branch.code, lat: coords.lat, lng: coords.lng, address: branch.address, radius: radius || 0 };
        }
      }

      if (lat && lng) {
        return { id: branch.id, name: branch.name, code: branch.code, lat, lng, address: branch.address, radius: radius || 0 };
      }

      return null;
    }).filter(Boolean) as { id: string; name: string; code?: string; lat: number; lng: number; address?: string; radius: number }[];
  }, [branches]);


  // Access Control Check (Render Level)
  if (!hasPermission('order.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-center p-8">
        <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-full mb-4">
           <svg className="w-12 h-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
           </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Akses Ditolak</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md">
          Anda tidak memiliki izin untuk mengakses halaman Pesanan.
        </p>
      </div>
    );
  }

  return (
    <OperationalPageShell>
      <div className="flex flex-col space-y-4">
        <OperationalPageHeader
          title="Pesanan & Layanan"
          subtitle="Kelola pesanan, penugasan teknisi, jadwal, pembayaran, dan komunikasi customer."
          eyebrow="Operasional"
          icon={ClipboardList}
          actions={
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
             {/* Export Button - Hidden for Advertiser */}
             {!isAdvertiserUser && (
             <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-9 bg-white px-3 text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700" title="Export / Import Data">
                      <FileSpreadsheet className="w-4 h-4" />
                      <ChevronDown className="w-3 h-3 ml-2 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                    <DropdownMenuLabel>Data Management</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer dark:text-slate-200 dark:focus:bg-slate-700">
                      <FileDown className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />
                      Export ke CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportXLSX} className="cursor-pointer dark:text-slate-200 dark:focus:bg-slate-700">
                      <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600 dark:text-green-400" />
                      Export ke Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer dark:text-slate-200 dark:focus:bg-slate-700">
                      <FileText className="w-4 h-4 mr-2 text-red-600 dark:text-red-400" />
                      Export ke PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleImportClick} className="cursor-pointer dark:text-slate-200 dark:focus:bg-slate-700">
                      <FileUp className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />
                      Import Excel/CSV
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleDownloadTemplate} className="cursor-pointer dark:text-slate-200 dark:focus:bg-slate-700">
                      <FileText className="w-4 h-4 mr-2 text-slate-600 dark:text-slate-400" />
                      Download Template
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
             )}
             
             <div className="flex h-9 shrink-0 items-center rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
                <Button 
                    variant="ghost" 
                    size="sm"
                    className={`h-7 px-3 ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'}`}
                    onClick={() => setViewMode('table')}
                >
                    <Settings className="w-4 h-4 mr-2" /> List
                </Button>
                {!isAdvertiserUser && (
                <Button 
                    variant="ghost" 
                    size="sm"
                    className={`h-7 px-3 ${viewMode === 'map' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'}`}
                    onClick={() => setViewMode('map')}
                >
                    <MapIcon className="w-4 h-4 mr-2" /> Peta
                </Button>
                )}
                
                <Button 
                    variant="ghost" 
                    size="sm"
                    className={`h-7 px-3 ${viewMode === 'calendar' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'}`}
                    onClick={() => setViewMode('calendar')}
                >
                    <Calendar className="w-4 h-4 mr-2" /> Kalender
                </Button>
             </div>

             {hasPermission('order.create') && (
             <>
                 {/* Mobile Add Button (Square Icon) */}
                 <Button 
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 p-0 text-white shadow-sm hover:bg-blue-700 sm:hidden"
                    onClick={() => {
                       setEditingOrder(null);
                       setIsFormOpen(true);
                    }}
                 >
                    <Plus className="h-5 w-5" />
                 </Button>

                 {/* Desktop Add Button (Full Text) */}
                 <Button 
                    className="hidden h-9 items-center bg-blue-600 text-white shadow-sm hover:bg-blue-700 sm:flex"
                    onClick={() => {
                       setEditingOrder(null);
                       setIsFormOpen(true);
                    }}
                 >
                    <Plus className="mr-2 h-4 w-4" /> Tambah Pesanan
                 </Button>
             </>
             )}
            </div>
          }
        />

        <OperationalKpiGrid className="grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <OperationalKpiCard label="Total" value={stats.total.toLocaleString('id-ID')} icon={Package} />
          <OperationalKpiCard
            label="Selesai"
            value={
              <div className="flex items-end gap-2">
                <span>{stats.done.toLocaleString('id-ID')}</span>
                <span className="mb-1 text-xs font-medium opacity-70">({stats.doneUnits.toLocaleString('id-ID')} Unit)</span>
              </div>
            }
            icon={CheckCircle2}
            tone="emerald"
          />
          <OperationalKpiCard label="Terjadwal" value={stats.pending.toLocaleString('id-ID')} icon={Calendar} tone="amber" />
          <OperationalKpiCard label="Reschedule" value={stats.reschedule.toLocaleString('id-ID')} icon={RefreshCw} tone="violet" />
          <OperationalKpiCard label="Cancel" value={stats.cancelled.toLocaleString('id-ID')} icon={XCircle} tone="rose" />
          <OperationalKpiCard label="Proses" value={stats.processing.toLocaleString('id-ID')} icon={Loader2} tone="blue" />
          <OperationalKpiCard
            label="Revenue"
            value={<span title={`Rp ${stats.revenue.toLocaleString('id-ID')}`}>Rp {(stats.revenue / 1000).toLocaleString('id-ID')}K</span>}
            icon={Banknote}
            tone="emerald"
            className="col-span-2 md:col-span-1"
          />
        </OperationalKpiGrid>

        {/* Content Card */}
        <OperationalTableCard>
          
          {/* Toolbar */}
          <OperationalFilterPanel className="rounded-none border-0 border-b border-slate-100 p-4 shadow-none dark:border-slate-700 md:p-5">
            
            {/* Row 1: Status Filter */}
            <div className="flex w-full items-center gap-2 overflow-x-auto pb-3 scrollbar-hide">
              <Button 
                variant={statusFilter === 'all' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => setStatusFilter('all')}
                className={statusFilter === 'all' ? "bg-slate-900 dark:bg-blue-600 text-white shadow-sm uppercase text-xs h-8 px-3" : "text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 uppercase text-xs h-8 px-3"}
              >
                Semua
                <span className={`ml-2 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${statusFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                   {filteredOrdersBase.length}
                </span>
              </Button>
               {[
                 { value: 'pending', label: 'Terjadwal' },
                 { value: 'otw', label: 'OTW Jalan' },
                 { value: 'working', label: 'Pengerjaan' },
                 { value: 'qc', label: 'Menunggu QC' },
                 { value: 'processing', label: 'Proses' },
                 { value: 'done', label: 'Selesai' },
                 { value: 'reschedule', label: 'Jadwal Ulang' },
                 { value: 'cancelled', label: 'Cancel' }
               ].map(option => (
                  <Button 
                    key={option.value}
                    variant={statusFilter === option.value ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => setStatusFilter(option.value)}
                    className={statusFilter === option.value ? "bg-slate-900 dark:bg-blue-600 text-white shadow-sm uppercase text-xs h-8 px-3" : "text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 uppercase text-xs h-8 px-3"}
                  >
                    {option.label}
                    <span className={`ml-2 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${statusFilter === option.value ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                       {statusCounts[option.value] || 0}
                    </span>
                  </Button>
               ))}
            </div>

            {/* Row 2: Filters & Search - MINIMALIST */}
            <div className="flex flex-col items-start justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800 xl:flex-row xl:items-center">
              {/* Left: Search & Date */}
              <div className="grid w-full flex-1 grid-cols-1 gap-3 md:grid-cols-[minmax(260px,1fr)_auto] xl:max-w-[760px]">
                 <div className="relative w-full">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <Input 
                      placeholder="Cari Order ID, Nama, No HP..." 
                      className="pl-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 transition-all w-full shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                 </div>
                 <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <Select value={dateFilterMode} onValueChange={(v: any) => setDateFilterMode(v)}>
                        <SelectTrigger className="w-full sm:w-[150px] shrink-0 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="service">Jadwal Service</SelectItem>
                            <SelectItem value="lead">Tanggal Leads</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="flex-1 sm:w-auto">
                        <DatePickerWithRange 
                        date={dateRange}
                        setDate={setDateRange}
                        className="w-full"
                        />
                    </div>
                 </div>
                 {statusFilter === 'cancelled' && (
                    <div className="w-full sm:w-[220px]">
                      <Select value={cancelReasonFilter} onValueChange={setCancelReasonFilter}>
                        <SelectTrigger className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600">
                          <SelectValue placeholder="Semua alasan cancel" />
                        </SelectTrigger>
                        <SelectContent className="z-[200]">
                          <SelectItem value="all">Semua alasan cancel</SelectItem>
                          {cancelReasonFilterOptions.map((option) => (
                            <SelectItem key={option.label} value={option.label}>
                              {option.label} ({option.count})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                 )}
              </div>

              {/* Right: Filter Button (Sheet) */}
              <Sheet>
                 <SheetTrigger asChild>
                    <Button 
                        variant={activeFilterCount > 0 ? "default" : "outline"} 
                        className={`${activeFilterCount > 0 ? "bg-blue-600 hover:bg-blue-700 text-white border-transparent" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"} shadow-sm whitespace-nowrap px-4 transition-all duration-200`}
                    >
                       <Filter className="w-4 h-4 mr-2" />
                       Filter
                       {activeFilterCount > 0 && (
                          <span className="ml-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/20 text-white text-[10px] font-bold px-1">
                             {activeFilterCount}
                          </span>
                       )}
                    </Button>
                 </SheetTrigger>
                 <SheetContent side="right" className="w-[400px] sm:w-[540px] z-[150] flex flex-col h-full p-0 gap-0 bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
                      <SheetHeader className="text-left p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <SheetTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">Filter Pesanan</SheetTitle>
                        <SheetDescription className="text-slate-500 dark:text-slate-400 mt-1">
                          Sesuaikan filter di bawah ini untuk menemukan data pesanan yang spesifik.
                        </SheetDescription>
                      </SheetHeader>
                    
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        {/* 1. SDM (Teknisi, CS, Advertiser) */}
                        <div className="space-y-4">
                           <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                              <div className="p-1.5 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                                <UserIcon className="w-4 h-4" />
                              </div>
                              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">SDM & Tim</h4>
                           </div>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* CS Filter */}
                                {(isAdminManagementUser || isAdvertiserUser || isTechnicianUser) && (
                                <div className="space-y-2">
                                   <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Customer Service</Label>
                                   <Select value={csFilter} onValueChange={setCsFilter}>
                                      <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua CS" /></SelectTrigger>
                                      <SelectContent className="z-[200]">
                                         <SelectItem value="all">Semua CS</SelectItem>
                                         {availableCS.map((cs) => (
                                            <SelectItem key={cs.id} value={cs.id}>{cs.name}</SelectItem>
                                         ))}
                                      </SelectContent>
                                   </Select>
                                </div>
                                )}

                                {/* Technician Filter */}
                                {!isAdvertiserUser && (
                                <div className="space-y-2">
                                   <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Teknisi</Label>
                                   <Select value={isTechnicianUser && currentUser?.id ? currentUser.id : technicianFilter} onValueChange={setTechnicianFilter} disabled={isTechnicianUser}>
                                      <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Teknisi" /></SelectTrigger>
                                      <SelectContent className="z-[200]">
                                         {!isTechnicianUser && <SelectItem value="all">Semua Teknisi</SelectItem>}
                                         {availableTechnicians.map((tech) => {
                                            if (isTechnicianUser && tech.id !== currentUser?.id) return null;
                                            return <SelectItem key={tech.id} value={tech.id}>{tech.name}</SelectItem>;
                                         })}
                                      </SelectContent>
                                   </Select>
                                </div>
                                )}

                                {/* Advertiser Filter */}
                                {isAdminManagementUser && (
                                <div className="space-y-2">
                                   <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Advertiser</Label>
                                   <Select value={advertiserFilter} onValueChange={setAdvertiserFilter}>
                                      <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Adv" /></SelectTrigger>
                                      <SelectContent className="z-[200]">
                                         <SelectItem value="all">Semua Advertiser</SelectItem>
                                         {advertisers.map((adv) => (
                                            <SelectItem key={adv.id} value={adv.id}>{adv.name}</SelectItem>
                                         ))}
                                      </SelectContent>
                                   </Select>
                                </div>
                                )}
                           </div>
                        </div>

                        {/* 2. Layanan & Operasional (Branch, Service, Category, Vehicle) */}
                        <div className="space-y-4">
                           <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                              <div className="p-1.5 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                                <Truck className="w-4 h-4" />
                              </div>
                              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Layanan & Operasional</h4>
                           </div>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                   <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Cabang</Label>
                                   <Select value={branchFilter} onValueChange={setBranchFilter}>
                                      <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Cabang" /></SelectTrigger>
                                      <SelectContent className="z-[200]">
                                         <SelectItem value="all">Semua Cabang</SelectItem>
                                         {availableBranches.map((branch) => (
                                            <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                                         ))}
                                      </SelectContent>
                                   </Select>
                                </div>
                                <div className="space-y-2">
                                   <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Jadwal</Label>
                                   <Select value={scheduleConflictFilter} onValueChange={setScheduleConflictFilter}>
                                      <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Jadwal" /></SelectTrigger>
                                      <SelectContent className="z-[200]">
                                         <SelectItem value="all">Semua Jadwal</SelectItem>
                                         <SelectItem value="conflict">Hanya Bentrok</SelectItem>
                                      </SelectContent>
                                   </Select>
                                </div>
                                <div className="space-y-2">
                                   <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Layanan</Label>
                                   <Select value={serviceFilter} onValueChange={setServiceFilter}>
                                      <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Layanan" /></SelectTrigger>
                                      <SelectContent className="z-[200]">
                                         <SelectItem value="all">Semua Layanan</SelectItem>
                                         {activeServices.map((svc) => (
                                            <SelectItem key={svc.id} value={svc.id}>{svc.name}</SelectItem>
                                         ))}
                                      </SelectContent>
                                   </Select>
                                </div>
                                <div className="space-y-2">
                                   <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Kategori</Label>
                                   <Select value={serviceCategoryFilter} onValueChange={setServiceCategoryFilter}>
                                      <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Kategori" /></SelectTrigger>
                                      <SelectContent className="z-[200]">
                                         <SelectItem value="all">Semua Kategori</SelectItem>
                                         <SelectItem value="Visit">Visit</SelectItem>
                                         <SelectItem value="Home Service">Home Service</SelectItem>
                                      </SelectContent>
                                   </Select>
                                </div>
                                <div className="space-y-2">
                                   <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Kendaraan</Label>
                                   <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                                      <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Tipe" /></SelectTrigger>
                                      <SelectContent className="z-[200]">
                                         <SelectItem value="all">Semua Tipe</SelectItem>
                                         {vehicles.map((v) => (
                                            <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                         ))}
                                      </SelectContent>
                                   </Select>
                                </div>
                           </div>
                        </div>

                        {/* 3. Sumber Order (Platform, Advertiser Specific) */}
                        <div className="space-y-4">
                           <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                              <div className="p-1.5 rounded-md bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
                                <Megaphone className="w-4 h-4" />
                              </div>
                              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Sumber Order</h4>
                           </div>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                   <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Platform</Label>
                                   <Select value={platformFilter} onValueChange={setPlatformFilter}>
                                      <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Platform" /></SelectTrigger>
                                      <SelectContent className="z-[200]">
                                         <SelectItem value="all">Semua Platform</SelectItem>
                                         {platforms.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                         ))}
                                      </SelectContent>
                                   </Select>
                                </div>
                                
                                {isAdvertiserUser && (
                                <div className="space-y-2">
                                   <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Sub Channel</Label>
                                   <Select value={subChannelFilter} onValueChange={setSubChannelFilter}>
                                      <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Sub Channel" /></SelectTrigger>
                                      <SelectContent className="z-[200]">
                                         <SelectItem value="all">Semua Sub Channel</SelectItem>
                                         {availableSubChannels.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                         ))}
                                      </SelectContent>
                                   </Select>
                                </div>
                                )}

                                <div className="space-y-2">
                                   <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Area</Label>
                                   <Select value={areaFilter} onValueChange={setAreaFilter}>
                                      <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Area" /></SelectTrigger>
                                      <SelectContent className="z-[200]">
                                         <SelectItem value="all">Semua Area</SelectItem>
                                         {areas.map((a) => (
                                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                         ))}
                                      </SelectContent>
                                   </Select>
                                </div>

                                <div className="space-y-2">
                                   <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Affiliate</Label>
                                   <Select value={affiliateFilter} onValueChange={setAffiliateFilter}>
                                      <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10"><SelectValue placeholder="Semua Affiliate" /></SelectTrigger>
                                      <SelectContent className="z-[200]">
                                         <SelectItem value="all">Semua Affiliate</SelectItem>
                                         {Array.from(new Set(orders.map(o => o.affiliateName).filter(Boolean))).map(aff => (
                                            <SelectItem key={aff as string} value={aff as string}>{aff}</SelectItem>
                                         ))}
                                      </SelectContent>
                                   </Select>
                                </div>
                           </div>
                        </div>

                        {/* 4. Pembayaran */}
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
                                    <SelectContent className="z-[200]">
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
                                    <SelectContent className="z-[200]">
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
                                    <SelectContent className="z-[200]">
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
                                    <SelectContent className="z-[200]">
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
          </OperationalFilterPanel>

          {/* Data Content: Table, Map, or Calendar */}
          {viewMode === 'calendar' && (
             <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-3 md:p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-3 md:mb-6">
                   <h3 className="text-sm md:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Calendar className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                      Kalender Order
                   </h3>
                   <div className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/30 px-2 py-1 rounded-md">
                      Total: <span className="font-bold text-slate-900 dark:text-slate-100">{filteredOrdersBase.length}</span> <span className="hidden sm:inline">Order dalam periode ini</span><span className="sm:hidden">Order</span>
                   </div>
                </div>

                <div className="grid grid-cols-7 gap-1 md:gap-4">
                   {(() => {
                      // Determine Date Range
                      let start = dateRange?.from ? startOfDay(dateRange.from) : startOfDay(new Date());
                      let end = dateRange?.to ? endOfDay(dateRange.to) : endOfDay(start);
                      
                      // Default to current month if no range selected (or range too small/invalid)
                      if (!dateRange?.from) {
                          const now = new Date();
                          start = new Date(now.getFullYear(), now.getMonth(), 1);
                          end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                      }

                      // Generate Days
                      const days = [];
                      // Adjust start to beginning of week (Monday) for better calendar look if needed, 
                      // but keeping logic simple strictly to date range for now as requested.
                      for(let dt=new Date(start); dt<=end; dt.setDate(dt.getDate()+1)){
                          days.push(new Date(dt));
                      }

                      // Group Orders
                      const ordersByDate: Record<string, number> = {};
                      filteredOrdersBase.forEach(o => {
                          const dateToUse = dateFilterMode === 'lead' ? o.leadDate : o.serviceDate;
                          if (dateToUse) {
                              try {
                                const dateKey = new Date(dateToUse).toISOString().split('T')[0];
                                ordersByDate[dateKey] = (ordersByDate[dateKey] || 0) + 1;
                              } catch(e) {}
                          }
                      });

                      const conflictOrdersByDate: Record<string, number> = {};
                      if (dateFilterMode !== 'lead') {
                          filteredOrdersBase.forEach((order) => {
                              const conflictInfo = scheduleConflictByItemKey.get(getScheduleConflictItemKey('order', order.id));
                              if (!conflictInfo || !order.serviceDate) return;

                              try {
                                const dateKey = new Date(order.serviceDate).toISOString().split('T')[0];
                                conflictOrdersByDate[dateKey] = (conflictOrdersByDate[dateKey] || 0) + 1;
                              } catch(e) {}
                          });
                      }

                      return days.map((day) => {
                          const year = day.getFullYear();
                          const month = String(day.getMonth() + 1).padStart(2, '0');
                          const d = String(day.getDate()).padStart(2, '0');
                          const key = `${year}-${month}-${d}`;
                          
                          const count = ordersByDate[key] || 0;
                          const conflictCount = conflictOrdersByDate[key] || 0;
                          const isToday = key === new Date().toISOString().split('T')[0];
                          const hasOrders = count > 0;

                          return (
                              <div 
                                key={key} 
                                className={`
                                    relative flex flex-col items-center justify-center p-1 md:p-4 rounded-md md:rounded-xl border transition-all duration-200
                                    ${isToday 
                                        ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' 
                                        : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-700'
                                    }
                                    ${hasOrders ? 'hover:shadow-md' : 'opacity-60'}
                                    min-h-[60px] md:min-h-[100px]
                                `}
                              >
                                  <span className="text-[10px] md:text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5 md:mb-1">
                                      {day.toLocaleDateString('id-ID', { weekday: 'short' })}
                                  </span>
                                  <span className={`text-xs md:text-2xl font-bold ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                      {day.getDate()}
                                  </span>
                                  <span className="hidden md:block text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                                      {day.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}
                                  </span>
                                  
                                  {count > 0 && (
                                      <div className="absolute top-1 right-1 md:top-2 md:right-2">
                                          <span className={`flex h-4 w-4 md:h-6 md:w-6 items-center justify-center rounded-full ${dateFilterMode === 'lead' ? 'bg-purple-500' : 'bg-red-500'} text-[9px] md:text-xs font-bold text-white shadow-sm animate-in zoom-in duration-300`}>
                                              {count}
                                          </span>
                                      </div>
                                  )}
                                  {conflictCount > 0 && (
                                      <span className="absolute bottom-1 left-1 right-1 truncate text-center text-[9px] font-semibold text-red-600 dark:text-red-400 md:bottom-2 md:text-[10px]">
                                          Bentrok {conflictCount}
                                      </span>
                                  )}
                              </div>
                          );
                      });
                   })()}
                </div>
             </div>
          )}

          {/* Data Content: Table or Map */}
          {viewMode === 'table' ? (
          <>
          {selectedIds.size > 0 && (
              <div className="bg-blue-50 border border-blue-100 p-2 px-4 rounded-lg flex items-center justify-between mb-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-3 text-sm text-blue-700">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-medium">{selectedIds.size} pesanan terpilih</span>
                  </div>
                  <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="h-8 text-xs text-slate-500 hover:text-slate-700">
                          Batal
                      </Button>
                      
                      {(hasPermission('order.edit') || hasPermission('order.payment.edit_status') || hasPermission('order.status.edit') || hasPermission('order.assign_technician')) && (
                      <Button size="sm" variant="outline" onClick={() => setIsBulkEditOpen(true)} className="h-8 text-xs shadow-sm bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900">
                          <Edit className="w-3.5 h-3.5 mr-1.5" />
                          Edit ({selectedIds.size})
                      </Button>
                      )}

                      {hasPermission('order.delete') && (
                      <Button size="sm" variant="destructive" onClick={handleMassDelete} className="h-8 text-xs shadow-sm">
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          Hapus ({selectedIds.size})
                      </Button>
                      )}
                  </div>
              </div>
          )}

          <div className="hidden border-t border-slate-100 bg-white md:block dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-900">
                <TableRow className="border-b border-slate-200 hover:bg-transparent dark:border-slate-800">
                  <TableHead className="w-[50px] py-4 pl-4">
                    <Checkbox 
                        className="border-slate-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        checked={paginatedOrders.length > 0 && Array.from(selectedIds).filter(id => paginatedOrders.find(o => o.id === id)).length === paginatedOrders.length}
                        onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                    />
                  </TableHead>
                  <TableHead className="w-[50px] font-semibold text-slate-600 dark:text-slate-400 text-[11px] uppercase tracking-wider py-4 text-center">No</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-[11px] uppercase tracking-wider py-4 pl-4">ID Order</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-[11px] uppercase tracking-wider py-4">Jadwal</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-[11px] uppercase tracking-wider py-4">Pelanggan</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-[11px] uppercase tracking-wider py-4 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition-colors group select-none" onClick={() => requestSort('price')}>
                    <div className="flex items-center gap-1">
                        Layanan & Harga
                        {sortConfig?.key === 'price' ? (
                             sortConfig.direction === 'asc' ? 
                             <ArrowUp className="w-3.5 h-3.5 text-orange-500" /> : 
                             <ArrowDown className="w-3.5 h-3.5 text-orange-500" />
                        ) : (
                             <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-[11px] uppercase tracking-wider py-4">Operasional</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-[11px] uppercase tracking-wider py-4 text-center">Metode Bayar</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-[11px] uppercase tracking-wider py-4 text-center">Status Bayar</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-[11px] uppercase tracking-wider py-4 text-center">Status</TableHead>
                  {canShowOrderActions && (
                  <TableHead className="text-right font-semibold text-slate-600 dark:text-slate-400 text-[11px] uppercase tracking-wider py-4 pr-6">Aksi</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOrders.length === 0 ? (
                   <TableRow>
                     <TableCell colSpan={11}>
                        <OperationalEmptyState
                          icon={ClipboardList}
                          title="Tidak ada pesanan ditemukan"
                          description="Coba ubah filter, tanggal, atau kata kunci pencarian."
                          className="py-14"
                        />
                     </TableCell>
                   </TableRow>
                ) : (
                  paginatedOrders.map((order, index) => {
                    const scheduleConflictInfo = scheduleConflictByItemKey.get(
                      getScheduleConflictItemKey('order', order.id)
                    );

                    return (
                    <TableRow key={order.id} className={`border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/70 ${selectedIds.has(order.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                      <TableCell className="py-6 pl-4 align-top w-[40px]">
                        <Checkbox 
                            className="border-slate-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            checked={selectedIds.has(order.id)}
                            onCheckedChange={(checked) => handleSelectRow(order.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="py-6 align-top text-center text-sm text-slate-500 dark:text-slate-400 font-medium w-[50px]">
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </TableCell>
                      <TableCell className="py-6 pl-4 align-top">
                        <div className="flex flex-col gap-1">
                          <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                copyToClipboard(order.id, {
                                  successMessage: "ID Order disalin!",
                                  description: `${order.id} siap ditempel.`
                                });
                              }}
                              className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm cursor-pointer hover:underline"
                              title="Klik untuk menyalin ID"
                          >
                            {order.id}
                          </div>
                          {order.leadDate && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide">
                              {new Date(order.leadDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                          {order.created_at && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-none mt-0.5">
                              {new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':')} WIB
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-6 align-top">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-slate-900 dark:text-slate-200 text-sm">
                             {new Date(order.serviceDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </span>
                          <div className="flex flex-col gap-1">
                              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                 <Clock className="w-3.5 h-3.5" /> {order.serviceTime}
                              </span>
                              {scheduleConflictInfo && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 dark:text-red-400">
                                  <AlertTriangle className="h-3 w-3" />
                                  Bentrok jadwal
                                </span>
                              )}
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium w-fit ${
                                 (order.serviceCategory === 'Home Service' || (!order.serviceCategory && areaMap[order.areaId]))
                                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-100 dark:border-blue-800' 
                                    : 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400 border border-orange-100 dark:border-orange-800'
                              }`}>
                                 {order.serviceCategory || (areaMap[order.areaId] ? 'Home Service' : 'Visit')}
                              </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-6 align-top">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-slate-900 dark:text-slate-200 text-sm">{order.customerName}</span>
                          
                          {/* Advertiser Only: Platform & Sub Channel */}
                          {isAdvertiserUser && (
                             <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                   {platformMap[order.platformId]?.name || '-'}
                                   {(order as any).subChannelId && subChannelMap[(order as any).subChannelId]?.name && (
                                      <> | {subChannelMap[(order as any).subChannelId]?.name}</>
                                   )}
                                </span>
                             </div>
                          )}
                          
                          {(canViewCustomerContact || canViewRoute) && (
                            <>
                            {canViewCustomerContact && (
                            <div className="flex items-center gap-2">
                               <a 
                                 href={`https://wa.me/${order.customerPhone.replace(/\D/g, '').replace(/^0/, '62')}`} 
                                 target="_blank" 
                                 rel="noopener noreferrer"
                                 className="text-green-500 hover:text-green-600 transition-colors"
                                 title="Chat WhatsApp"
                               >
                                  <MessageCircle className="w-3.5 h-3.5" />
                               </a>
                               <span className="text-xs text-slate-500 dark:text-slate-400">{order.customerPhone}</span>
                            </div>
                            )}

                            <div className="flex items-start gap-2">
                               {canViewRoute && order.mapsUrl && (
                                  <a 
                                    href={order.mapsUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors mt-0.5"
                                    title="Buka Maps"
                                  >
                                     <MapPin className="w-3.5 h-3.5" />
                                  </a>
                               )}
                               <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight" title={order.address}>
                                  {order.address}
                               </span>
                            </div>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-6 align-top">
                        <div className="flex flex-col gap-1 max-w-[150px]">
                          <span 
                            className="text-[11px] font-medium text-slate-900 dark:text-slate-200 whitespace-nowrap overflow-hidden text-ellipsis" 
                            title={serviceMap[order.serviceId]?.name || order.serviceId}
                          >
                            {serviceMap[order.serviceId]?.name || order.serviceId}
                          </span>
                          <div className="flex items-center gap-1">
                             <span className="text-xs text-slate-500 dark:text-slate-400">
                                {vehicleMap[order.vehicleId]?.name || order.vehicleId} ({order.units || 1})
                             </span>
                          </div>
                          
                          {canEditOrderPrice && (editingPriceId === order.id ? (
                              <div className="flex items-center gap-1 mt-1">
                                  <div className="relative">
                                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">Rp</span>
                                      <Input 
                                         className="h-7 w-28 text-xs pl-6 pr-1" 
                                         value={tempPrice}
                                         onChange={(e) => {
                                             const val = e.target.value.replace(/\D/g, '');
                                             setTempPrice(val ? Number(val).toLocaleString('id-ID') : '');
                                         }}
                                         autoFocus
                                         onKeyDown={(e) => {
                                             if (e.key === 'Enter') {
                                                 const rawPrice = parseInt(tempPrice.replace(/\./g, '')) || 0;
                                                 updateOrder({ ...order, price: rawPrice });
                                                 setEditingPriceId(null);
                                                 toast.success('Harga berhasil diperbarui');
                                             } else if (e.key === 'Escape') {
                                                 setEditingPriceId(null);
                                             }
                                         }}
                                      />
                                  </div>
                                  <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 hover:bg-green-50 rounded-full" onClick={() => {
                                     const rawPrice = parseInt(tempPrice.replace(/\./g, '')) || 0;
                                     updateOrder({ ...order, price: rawPrice });
                                     setEditingPriceId(null);
                                     toast.success('Harga berhasil diperbarui');
                                  }}>
                                     <CheckCircle2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600 hover:bg-red-50 rounded-full" onClick={() => setEditingPriceId(null)}>
                                     <XCircle className="w-3.5 h-3.5" />
                                  </Button>
                              </div>
                          ) : (
                              <div className="flex items-center gap-2 mt-1 group/price">
                                  <span className={`${isAdvertiserUser ? 'text-[10px] font-medium text-slate-500' : 'text-sm font-semibold text-slate-900 dark:text-slate-200'}`}>
                                     Rp {order.price.toLocaleString('id-ID')}
                                  </span>
                                  {canEditOrderPrice && (
                                      <Edit 
                                         className="w-3 h-3 text-slate-400 hover:text-blue-600 cursor-pointer opacity-0 group-hover/price:opacity-100 transition-all"
                                         onClick={() => {
                                             setEditingPriceId(order.id);
                                             setTempPrice(order.price.toLocaleString('id-ID'));
                                         }}
                                      />
                                  )}
                              </div>
                          ))}
                        </div>
                      </TableCell>

                      <TableCell className="py-6 align-top">
                        <div className="flex flex-col gap-2">
                           {(() => {
                             const technician = userMap[order.technicianId];
                             const cs = userMap[order.csId];
                             const branch = branchMap[order.branchId];
                             const area = areaMap[order.areaId];
                             
                             return (
                               <>
                                 {/* 1. Teknisi */}
                                 {(!isAdvertiserUser || canAssignTechnician || canViewStaffContact) && (
                                 <div className="flex items-center gap-2 group/tech relative">
                                    {technician ? (
                                      <>
                                         {canViewStaffContact && technician.phone && (
                                            <a 
                                              href={`https://wa.me/${technician.phone.replace(/\D/g, '').replace(/^0/, '62')}`} 
                                              target="_blank" 
                                              rel="noopener noreferrer" 
                                              className="text-green-500 hover:text-green-600 shrink-0"
                                              title="Chat Teknisi"
                                            >
                                               <MessageCircle className="w-4 h-4" />
                                            </a>
                                         )}
                                         <div className="flex items-center gap-1.5 max-w-[140px]">
                                            <span className="text-[10px] text-slate-500 font-medium shrink-0">Teknisi</span>
                                            <span className="text-slate-300 dark:text-slate-600 shrink-0">|</span>
                                            <span 
                                               className="text-[11px] font-semibold text-slate-900 dark:text-slate-200 whitespace-nowrap overflow-hidden text-ellipsis min-w-0"
                                               title={technician.name}
                                            >
                                               {technician.name}
                                            </span>
                                         </div>
                                      </>
                                    ) : (
                                       <span className="text-sm text-slate-400 italic">-</span>
                                    )}

                                    {/* Technician Edit Dropdown */}
                                    {canAssignTechnician && !isOrderLocked(order.status) && (
                                       <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                             <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-opacity">
                                                <ChevronDown className="w-3.5 h-3.5" />
                                             </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="start" className="w-[200px] max-h-[300px] overflow-y-auto bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 z-[100]">
                                             <DropdownMenuLabel>Pilih Teknisi</DropdownMenuLabel>
                                             <DropdownMenuSeparator />
                                             <DropdownMenuItem 
                                                onClick={() => {
                                                   // @ts-ignore
                                                   updateOrder({ ...order, technicianId: null })
                                                }}
                                                className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                                             >
                                                <span className="italic">Lepas Teknisi</span>
                                             </DropdownMenuItem>
                                             {technicians.map((tech) => {
                                                const technicianOffSchedule = getTechnicianOffSchedule(tech.id, order.serviceDate);
                                                const isTechnicianOff = !!technicianOffSchedule;
                                                return (
                                                <DropdownMenuItem 
                                                   key={tech.id}
                                                   disabled={isTechnicianOff}
                                                   onClick={async () => {
                                                      if (isTechnicianOff) {
                                                        return;
                                                      }
                                                      try {
                                                        // @ts-ignore
                                                        // Auto-update Branch if Technician has one
                                                        const updates: any = { technicianId: tech.id };
                                                        if (tech.branchId) {
                                                            updates.branchId = tech.branchId;
                                                        }
                                                        await updateOrder({ ...order, ...updates });
                                                        
                                                        if (tech.branchId) {
                                                            toast.success(`Teknisi diganti ke ${tech.name} (Cabang disesuaikan)`);
                                                        } else {
                                                            toast.success(`Teknisi diganti ke ${tech.name}`);
                                                        }
                                                      } catch (error: any) {
                                                        console.error(error);
                                                        toast.error(error?.message || `Gagal mengganti teknisi ke ${tech.name}`);
                                                      }
                                                   }}
                                                   className={`cursor-pointer ${order.technicianId === tech.id ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : ''} ${isTechnicianOff ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                   <div className="flex flex-col w-full">
                                                      <span className="font-medium text-sm">
                                                        {tech.name} {isTechnicianOff ? `(Sedang ${technicianOffSchedule?.type || 'Libur'})` : ''}
                                                      </span>
                                                      {tech.branch && <span className="text-[10px] text-slate-500">{tech.branch}</span>}
                                                   </div>
                                                   {order.technicianId === tech.id && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-blue-600" />}
                                                </DropdownMenuItem>
                                             )})}
                                          </DropdownMenuContent>
                                       </DropdownMenu>
                                    )}
                                 </div>
                                 )}

                                 {/* 2. Cabang Only (Area hidden) */}
                                 {!isAdvertiserUser && branch && (
                                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 ml-0.5 max-w-[150px]">
                                       <Building2 className="w-3.5 h-3.5 shrink-0" />
                                       <span className="text-[11px] whitespace-nowrap overflow-hidden text-ellipsis min-w-0" title={branch?.name}>
                                          {branch?.name}
                                       </span>
                                    </div>
                                 )}

                                 {/* 3. CS */}
                                 {cs && (
                                    <div className="flex items-center gap-2">
                                       {canViewStaffContact && cs.phone && (
                                          <a 
                                            href={`https://wa.me/${cs.phone.replace(/\D/g, '').replace(/^0/, '62')}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="text-green-500 hover:text-green-600 shrink-0"
                                            title="Chat CS"
                                          >
                                             <MessageCircle className="w-3.5 h-3.5" />
                                          </a>
                                       )}
                                       <div className="flex items-center gap-1.5 max-w-[140px]">
                                          <span 
                                             className="text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap overflow-hidden text-ellipsis min-w-0"
                                             title={cs.name}
                                          >
                                             {cs.name}
                                          </span>
                                          <span className="text-[10px] text-slate-400 shrink-0">- CS</span>
                                       </div>
                                    </div>
                                 )}
                               </>
                             );
                           })()}
                        </div>
                      </TableCell>

                      <TableCell className="py-6 text-center align-top">
                        <div className="flex items-center justify-center gap-1">
                           <div className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                             {order.paymentType || '-'}
                             {order.paymentType === 'Transfer' && order.paymentMethodId && ` - ${payments.find(p => p.id === order.paymentMethodId)?.bankName}`}
                           </div>
                           {hasPermission('order.payment.edit_type') && !isOrderLocked(order.status) && (
                           <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600">
                                 <ChevronDown className="w-3.5 h-3.5" />
                               </Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="center" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 min-w-[160px] p-1">
                                {['Transfer', 'Cash'].map((type) => (
                                  <DropdownMenuItem 
                                    key={type}
                                    onClick={() => {
                                       const updates: any = { paymentType: type };
                                       if (type === 'Cash') updates.paymentMethodId = undefined;
                                       updateOrder({ ...order, ...updates });
                                       toast.success(`Jenis pembayaran diperbarui: ${type}`);
                                    }}
                                    className="text-sm cursor-pointer py-2 px-3 rounded-sm focus:bg-slate-50 dark:focus:bg-slate-700"
                                  >
                                     <div className="flex items-center justify-between w-full">
                                        <span className={order.paymentType === type ? 'font-medium' : ''}>{type.toUpperCase()}</span>
                                        {order.paymentType === type && <CheckCircle2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />}
                                     </div>
                                  </DropdownMenuItem>
                                ))}
                             </DropdownMenuContent>
                           </DropdownMenu>
                           )}
                        </div>
                      </TableCell>
                      <TableCell className="py-6 text-center align-top">
                        <div className="flex items-center justify-center gap-1">
                           <div className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                              order.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' :
                              order.paymentStatus === 'Down Payment' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' :
                              'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                           }`}>
                             {order.paymentStatus || 'Unpaid'}
                           </div>
                           {hasPermission('order.payment.edit_status') && (
                           <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600">
                                 <ChevronDown className="w-3.5 h-3.5" />
                               </Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="center" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 min-w-[160px] p-1">
                                {['Unpaid', 'Down Payment', 'Paid'].map((status) => (
                                  <DropdownMenuItem 
                                    key={status}
                                    onClick={() => {
                                       updateOrder({ ...order, paymentStatus: status as any });
                                       toast.success(`Status pembayaran diperbarui: ${status}`);
                                    }}
                                    className="text-sm cursor-pointer py-2 px-3 rounded-sm focus:bg-slate-50 dark:focus:bg-slate-700"
                                  >
                                     <div className="flex items-center justify-between w-full">
                                        <span className={order.paymentStatus === status ? 'font-medium' : ''}>{status}</span>
                                        {order.paymentStatus === status && <CheckCircle2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />}
                                     </div>
                                  </DropdownMenuItem>
                                ))}
                             </DropdownMenuContent>
                           </DropdownMenu>
                           )}
                        </div>
                      </TableCell>
                      <TableCell className="py-6 text-center align-top">
                        {(() => {
                            // Resolve Effective Status (Shadow Status from photos._status)
                            const rawStatus = order.status;
                            const customStatus = (order.photos as any)?._status;
                            const effectiveStatus = customStatus && (rawStatus === 'processing' || rawStatus === 'pending') 
                                ? customStatus 
                                : rawStatus;
                            
                            const reasonSummary = getStatusReasonSummary(order, effectiveStatus);

                            return (
                                <div className="flex flex-col items-center gap-1.5">
                                  <div className="flex items-center justify-center gap-1">
                                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getStatusBadgeVariant(effectiveStatus)}`}>
                                        {getStatusLabel(effectiveStatus)}
                                    </div>
                                    {hasPermission('order.status.edit') && !isOrderLocked(order.status) && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600">
                                            <ChevronDown className="w-3.5 h-3.5" />
                                        </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="center" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 min-w-[160px] p-1">
                                            {[
                                            { value: 'pending', label: 'Terjadwal' },
                                            { value: 'done', label: 'Selesai' },
                                            { value: 'reschedule', label: 'Jadwal Ulang' },
                                            { value: 'cancelled', label: 'Cancel' },
                                            { value: 'processing', label: 'Proses' },
                                            ].map((status) => {
                                            const isDisabled = status.value === 'done' && !hasPermission('order.status.mark_done');
                                            return (
                                                <DropdownMenuItem 
                                                key={status.value}
                                                disabled={isDisabled}
                                                onClick={() => {
                                                    void handleInlineStatusChange(order, status.value as Order['status']);
                                                }}
                                                className={`text-sm cursor-pointer py-2 px-3 rounded-sm focus:bg-slate-50 dark:focus:bg-slate-700 ${
                                                    isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                                                }`}
                                                >
                                                    <div className="flex items-center justify-between w-full">
                                                    <span className={order.status === status.value ? 'font-medium' : ''}>{status.label}</span>
                                                    {order.status === status.value && <CheckCircle2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />}
                                                    </div>
                                                </DropdownMenuItem>
                                            );
                                            })}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    )}
                                  </div>
                                  {reasonSummary && (
                                    <div className="max-w-[140px] text-center text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                                      {reasonSummary}
                                    </div>
                                  )}
                                </div>
                            );
                        })()}
                      </TableCell>
                      {canShowOrderActions && (
                      <TableCell className="py-6 pr-6 text-right align-top">
                       <div className="flex justify-end gap-2">
                          {canViewCustomerContact && (
                          <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <div className="relative inline-block">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-[#25D366] hover:text-[#128C7E] hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full">
                                     <WhatsappIcon className="w-4 h-4" />
                                  </Button>
                                  {(order.templateHistory?.length || 0) > 0 && (
                                     <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-800">
                                        {new Set(order.templateHistory?.map(h => h.templateId)).size}
                                     </span>
                                  )}
                               </div>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="end" className="w-[320px] p-0 z-[60] border-slate-100 dark:border-slate-700 shadow-xl bg-white dark:bg-slate-800">
                                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800 flex justify-between items-start rounded-t-md">
                                  <div>
                                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Pilih Template</h4>
                                    <p className="text-[10px] text-slate-400 mt-0.5">{new Set(order.templateHistory?.map(h => h.templateId)).size} dari {waTemplates.filter(t => t.category === 'Orders' || t.category === 'General' || !t.category).length} digunakan</p>
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 text-slate-400 hover:text-slate-600 -mr-2 -mt-1"
                                    onClick={() => onNavigate?.('wa-templates')}
                                  >
                                    <Settings className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                                
                                <div className="max-h-[300px] overflow-y-auto py-1 custom-scrollbar">
                                  {waTemplates.filter(t => t.category === 'Orders' || t.category === 'General' || !t.category).map(t => {
                                     const isUsed = isTemplateUsed(order, t.id);
                                     return (
                                        <DropdownMenuItem key={t.id} onClick={() => handleWhatsappTemplate(order, t)} className={`px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 flex flex-col items-start gap-1 mx-1 rounded-md my-0.5 ${isUsed ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}>
                                           <div className="flex items-center justify-between w-full">
                                              <span className={`font-medium text-sm ${isUsed ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-slate-200'}`}>{t.title}</span>
                                              {isUsed && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-500" />}
                                           </div>
                                           <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 w-full text-left font-normal leading-relaxed">
                                             {t.message.replace(/\[Nama\]/g, order.customerName).substring(0, 50)}...
                                           </span>
                                        </DropdownMenuItem>
                                     );
                                  })}
                                </div>

                                <div className="p-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30 rounded-b-md">
                                  <Button 
                                    variant="ghost" 
                                    className="w-full justify-center text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 shadow-sm transition-all h-9"
                                    onClick={() => handleWhatsappTemplate(order)}
                                  >
                                    Chat Kosong (Tanpa Template)
                                  </Button>
                                </div>
                             </DropdownMenuContent>
                          </DropdownMenu>
                          )}

                          {canViewRoute && order.mapsUrl && (
                          <a href={order.mapsUrl} target="_blank" rel="noopener noreferrer">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-full"
                              title="Buka Maps"
                            >
                              <MapIcon className="w-4 h-4" />
                            </Button>
                          </a>
                          )}

                          {canViewOrderDetails && (
                          <div className="relative">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setPhotoViewerOrder(order)}
                                className={`h-8 w-8 rounded-full ${
                                    ((order.photos as any)?.before?.length && (order.photos as any)?.after?.length && (order.photos as any)?.payment?.length && (order.photos as any)?.signature?.length)
                                    ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                    : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                }`}
                                title="Lihat Foto"
                              >
                                <Camera className="w-4 h-4" />
                              </Button>
                              {(() => {
                                 const p = order.photos as any;
                                 const count = (p?.before?.length ? 1 : 0) + 
                                               (p?.after?.length ? 1 : 0) + 
                                               (p?.payment?.length ? 1 : 0) + 
                                               (p?.signature?.length ? 1 : 0);
                                 if (count > 0) {
                                     return (
                                        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
                                            {count}
                                        </span>
                                     );
                                 }
                                 return null;
                              })()}
                          </div>
                          )}

                          {canViewOrderPayments && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleViewPayment(order)}
                            className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-full"
                          >
                            <CreditCard className="w-4 h-4" />
                          </Button>
                          )}
                          {canViewOrderDetails && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleViewDetail(order)}
                            className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          )}

                          {(canEditOrders || canDeleteOrders) && !isOrderLocked(order.status) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                                 <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                              {canEditOrders && (
                              <DropdownMenuItem onClick={() => handleEdit(order)} className="cursor-pointer">
                                <Edit className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              )}
                              {canDeleteOrders && (
                                <>
                                  <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-700" />
                                  <DropdownMenuItem onClick={() => handleDelete(order.id)} className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
                                    <Trash2 className="mr-2 h-4 w-4" /> Hapus
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          )}
                        </div>
                      </TableCell>
                      )}
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            </div>
            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                   <div className="flex items-center">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400" 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      >
                         &lt;
                      </Button>
                      <div className="flex items-center justify-center min-w-[32px] font-medium text-slate-700 dark:text-slate-200">
                        {currentPage}
                      </div>
                      <span className="text-slate-400 mx-1">/</span>
                      <span className="text-slate-400 mr-2">{totalPages}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400" 
                        disabled={currentPage === totalPages || totalPages === 0}
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      >
                         &gt;
                      </Button>
                   </div>
              </div>
              
              <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Tampilkan:</span>
                  <Select 
                     value={itemsPerPage.toString()} 
                     onValueChange={(val) => {
                         setItemsPerPage(Number(val));
                         setCurrentPage(1);
                     }}
                  >
                      <SelectTrigger className="w-[140px] h-8 text-xs bg-white dark:bg-slate-800 border border-blue-200 dark:border-slate-700 hover:border-blue-300 focus:ring-blue-200 text-slate-700 dark:text-slate-300 rounded-md shadow-sm">
                          <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[200]">
                          <SelectItem value="50">50 / Halaman</SelectItem>
                          <SelectItem value="100">100 / Halaman</SelectItem>
                          <SelectItem value="200">200 / Halaman</SelectItem>
                          <SelectItem value="300">300 / Halaman</SelectItem>
                      </SelectContent>
                  </Select>
              </div>
            </div>
          </div>

           {/* Bulk Edit Modal */}
            <Modal
                title={`Edit Massal (${selectedIds.size} Pesanan)`}
                isOpen={isBulkEditOpen}
                onClose={resetBulkEditor}
                className="max-w-md"
            >
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Pilih Kolom yang akan diedit</Label>
                        <Select value={bulkField} onValueChange={(val) => { setBulkField(val); setBulkValue(''); setBulkStatusReason(''); setBulkStatusReasonNote(''); }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih Kolom" />
                            </SelectTrigger>
                            <SelectContent className="z-[250]">
                                {(hasPermission('order.status.edit') || hasPermission('order.edit')) && <SelectItem value="status">Status Order</SelectItem>}
                                {(hasPermission('order.assign_technician') || hasPermission('order.edit')) && <SelectItem value="technicianId">Teknisi</SelectItem>}
                                {hasPermission('order.edit') && <SelectItem value="csId">Customer Service (CS)</SelectItem>}
                                {hasPermission('order.edit') && <SelectItem value="advertiserId">Advertiser</SelectItem>}
                                {hasPermission('order.edit') && <SelectItem value="branchId">Cabang</SelectItem>}
                                {hasPermission('order.edit') && <SelectItem value="serviceId">Layanan</SelectItem>}
                                {(hasPermission('order.payment.edit_status') || hasPermission('order.edit')) && <SelectItem value="paymentStatus">Status Pembayaran</SelectItem>}
                                {(hasPermission('order.payment.edit_status') || hasPermission('order.edit')) && <SelectItem value="deletePaymentProof" className="text-red-600 focus:text-red-700 font-medium">Hapus Bukti Transfer</SelectItem>}
                            </SelectContent>
                        </Select>
                    </div>

                    {bulkField && (
                        <div className="space-y-2">
                            <Label>Pilih Nilai Baru</Label>
                            {bulkField === 'status' ? (
                                <Select value={bulkValue} onValueChange={(value) => { setBulkValue(value); setBulkStatusReason(''); setBulkStatusReasonNote(''); }}>
                                    <SelectTrigger><SelectValue placeholder="Pilih Status" /></SelectTrigger>
                                    <SelectContent className="z-[250]">
                                        <SelectItem value="pending">Terjadwal</SelectItem>
                                        <SelectItem value="processing">Proses</SelectItem>
                                        <SelectItem value="done">Selesai</SelectItem>
                                        <SelectItem value="reschedule">Jadwal Ulang</SelectItem>
                                        <SelectItem value="cancelled">Cancel</SelectItem>
                                    </SelectContent>
                                </Select>
                            ) : bulkField === 'deletePaymentProof' ? (
                                <Select value={bulkValue} onValueChange={setBulkValue}>
                                    <SelectTrigger className="border-red-200 text-red-600 focus:ring-red-500"><SelectValue placeholder="Konfirmasi Penghapusan" /></SelectTrigger>
                                    <SelectContent className="z-[250]">
                                        <SelectItem value="confirm" className="text-red-600 font-bold focus:bg-red-50 focus:text-red-700">Ya, Hapus Bukti Permanen</SelectItem>
                                    </SelectContent>
                                </Select>
                            ) : bulkField === 'technicianId' ? (
                                <Select value={bulkValue} onValueChange={setBulkValue}>
                                    <SelectTrigger><SelectValue placeholder="Pilih Teknisi" /></SelectTrigger>
                                    <SelectContent className="z-[250]">
                                        {technicians.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : bulkField === 'csId' ? (
                                <Select value={bulkValue} onValueChange={setBulkValue}>
                                    <SelectTrigger><SelectValue placeholder="Pilih CS" /></SelectTrigger>
                                    <SelectContent className="z-[250]">
                                        {csUsers.map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : bulkField === 'advertiserId' ? (
                                <Select value={bulkValue} onValueChange={setBulkValue}>
                                    <SelectTrigger><SelectValue placeholder="Pilih Advertiser" /></SelectTrigger>
                                    <SelectContent className="z-[250]">
                                        {advertisers.map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : bulkField === 'branchId' ? (
                                <Select value={bulkValue} onValueChange={setBulkValue}>
                                    <SelectTrigger><SelectValue placeholder="Pilih Cabang" /></SelectTrigger>
                                    <SelectContent className="z-[250]">
                                        {branches.map(b => (
                                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : bulkField === 'serviceId' ? (
                                <Select value={bulkValue} onValueChange={setBulkValue}>
                                    <SelectTrigger><SelectValue placeholder="Pilih Layanan" /></SelectTrigger>
                                    <SelectContent className="z-[250]">
                                        {activeServices.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name} - Rp {s.price.toLocaleString()}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : bulkField === 'paymentStatus' ? (
                                <Select value={bulkValue} onValueChange={setBulkValue}>
                                    <SelectTrigger><SelectValue placeholder="Pilih Status Bayar" /></SelectTrigger>
                                    <SelectContent className="z-[250]">
                                        <SelectItem value="Unpaid">Unpaid</SelectItem>
                                        <SelectItem value="Down Payment">Down Payment</SelectItem>
                                        <SelectItem value="Paid">Paid</SelectItem>
                                    </SelectContent>
                                </Select>
                            ) : null}
                        </div>
                    )}

                    {bulkField === 'status' && isReasonRequiredStatus(bulkValue) && (
                        <OrderStatusReasonFields
                            status={bulkValue}
                            cancelReasons={cancelReasons}
                            value={bulkStatusReason}
                            note={bulkStatusReasonNote}
                            onReasonChange={(value) => {
                                setBulkStatusReason(value);
                                if (value !== 'Lainnya') {
                                    setBulkStatusReasonNote('');
                                }
                            }}
                            onNoteChange={setBulkStatusReasonNote}
                        />
                    )}
                    
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="ghost" onClick={resetBulkEditor}>Batal</Button>
                        <Button onClick={handleBulkUpdate} disabled={!bulkField || !bulkValue}>Simpan Perubahan</Button>
                    </div>
                </div>
            </Modal>

            <Modal
                title={quickStatusChange ? `Ubah Status ke ${getStatusLabel(quickStatusChange.nextStatus)}` : 'Ubah Status'}
                isOpen={Boolean(quickStatusChange)}
                onClose={resetQuickStatusChange}
                size="sm"
                preventOutsideClose
                footer={
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={resetQuickStatusChange}>Batal</Button>
                        <Button onClick={handleConfirmQuickStatusChange}>Simpan Status</Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    {quickStatusChange && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">#{quickStatusChange.order.id}</span>
                            {' '}atas nama{' '}
                            <span className="font-medium text-slate-900 dark:text-slate-100">{quickStatusChange.order.customerName}</span>
                            {' '}akan diubah menjadi{' '}
                            <span className="font-semibold text-slate-900 dark:text-slate-100">{getStatusLabel(quickStatusChange.nextStatus)}</span>.
                        </div>
                    )}

                    <OrderStatusReasonFields
                        status={quickStatusChange?.nextStatus}
                        cancelReasons={cancelReasons}
                        value={quickStatusReason}
                        note={quickStatusReasonNote}
                        onReasonChange={(value) => {
                            setQuickStatusReason(value);
                            if (value !== 'Lainnya') {
                                setQuickStatusReasonNote('');
                            }
                        }}
                        onNoteChange={setQuickStatusReasonNote}
                    />
                </div>
            </Modal>

            {/* Mass Delete Alert */}
            <AlertDialog open={isMassDeleteOpen} onOpenChange={setIsMassDeleteOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Konfirmasi Hapus Massal</AlertDialogTitle>
                  <AlertDialogDescription>
                    Apakah Anda yakin ingin menghapus {selectedIds.size} pesanan yang dipilih? 
                    Tindakan ini tidak dapat dibatalkan.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmMassDelete} className="bg-red-600 hover:bg-red-700">
                    Hapus
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

          {/* MOBILE CARD LIST (Visible on sm/xs) */}
          <div className="md:hidden p-4 space-y-3">
              {filteredOrders.length === 0 ? (
                 <div className="text-center py-12 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                    Tidak ada pesanan ditemukan
                 </div>
              ) : (
                 filteredOrders.map((order) => {
                     const technician = userMap[order.technicianId];
                     const cs = userMap[order.csId];
                     const isLocked = isOrderLocked(order.status);
                     const isAdvertiser = isAdvertiserUser;
                     const useCompactAdvertiserCard = isAdvertiser && !canViewCustomerContact && !canViewRoute;
                     const reasonSummary = getStatusReasonSummary(order);
                     const scheduleConflictInfo = scheduleConflictByItemKey.get(
                       getScheduleConflictItemKey('order', order.id)
                     );

                     return (
                     <div key={order.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
                        {/* Header Row: ID + Status */}
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-blue-600 dark:text-blue-400 text-xs">#{order.id}</span>
                                <span className="text-[10px] text-slate-400">
                                   {new Date(order.serviceDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} • {order.serviceTime}
                                </span>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <Badge className={`uppercase text-[9px] px-1.5 py-0.5 rounded-sm ${getStatusBadgeVariant(order.status)}`}>
                                    {getStatusLabel(order.status)}
                                </Badge>
                                {reasonSummary && (
                                    <span className="max-w-[120px] text-right text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                                        {reasonSummary}
                                    </span>
                                )}
                            </div>
                        </div>
                        {scheduleConflictInfo && (
                            <div className="mb-2 inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 dark:text-red-400">
                                <AlertTriangle className="h-3 w-3" />
                                Bentrok jadwal
                            </div>
                        )}

                        {/* Content Row: Name, Platform | Sub Channel */}
                        <div className="space-y-1">
                            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-tight">{order.customerName}</h3>
                            
                            {/* Advertiser View: Simple Platform Info */}
                            {useCompactAdvertiserCard ? (
                                <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                                    <span className="font-medium text-slate-700 dark:text-slate-300">
                                        {platformMap[order.platformId]?.name || '-'}
                                    </span>
                                    {(order as any).subChannelId && subChannelMap[(order as any).subChannelId]?.name && (
                                        <>
                                            <span className="text-slate-300 dark:text-slate-600">|</span>
                                            <span>{subChannelMap[(order as any).subChannelId]?.name}</span>
                                        </>
                                    )}
                                </div>
                            ) : (
                                /* Normal View: More Details */
                                <div className="space-y-1 mt-1">
                                    {canViewCustomerContact && (
                                    <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                                        <Phone className="w-3 h-3" />
                                        <span>{order.customerPhone}</span>
                                    </div>
                                    )}
                                    {(canViewCustomerContact || canViewRoute) && (
                                    <div className="flex items-start gap-1 text-xs text-slate-500 dark:text-slate-400">
                                        <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                                        <span className="line-clamp-1">{order.address}</span>
                                    </div>
                                    )}
                                    {order.technicianId && (
                                        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 pt-1">
                                            <UserIcon className="w-3 h-3" />
                                            <span>Teknisi: {technician?.name || order.technicianId}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Actions Footer */}
                        {canShowOrderActions && (
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                                <div className="flex items-center gap-2">
                                     {/* WhatsApp Action - Mobile uses Bottom Sheet */}
                                     {canViewCustomerContact && (
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                                            onClick={() => {
                                                setWaTargetOrder(order);
                                                setWaSheetOpen(true);
                                            }}
                                        >
                                            <WhatsappIcon className="w-4 h-4 mr-1" />
                                            <span className="text-xs">Chat</span>
                                        </Button>
                                     )}

                                     {/* Map Action */}
                                     {canViewRoute && order.mapsUrl && (
                                        <a href={order.mapsUrl} target="_blank" rel="noopener noreferrer">
                                            <Button variant="ghost" size="sm" className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                                                <MapIcon className="w-4 h-4 mr-1" />
                                                <span className="text-xs">Peta</span>
                                            </Button>
                                        </a>
                                     )}
                                </div>

                                <div className="flex items-center gap-1">
                                    {canViewOrderDetails && (
                                        <>
                                        <div className="relative">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => setPhotoViewerOrder(order)}
                                                className={`h-8 w-8 rounded-full ${
                                                    ((order.photos as any)?.before?.length && (order.photos as any)?.after?.length && (order.photos as any)?.payment?.length && (order.photos as any)?.signature?.length)
                                                    ? 'text-blue-600 hover:text-blue-700'
                                                    : 'text-slate-400 hover:text-blue-600'
                                                }`}
                                            >
                                                <Camera className="w-4 h-4" />
                                            </Button>
                                            {(() => {
                                                const p = order.photos as any;
                                                const count = (p?.before?.length ? 1 : 0) + 
                                                              (p?.after?.length ? 1 : 0) + 
                                                              (p?.payment?.length ? 1 : 0) + 
                                                              (p?.signature?.length ? 1 : 0);
                                                if (count > 0) {
                                                    return (
                                                        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
                                                            {count}
                                                        </span>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                        {canViewOrderPayments && (
                                        <Button variant="ghost" size="icon" onClick={() => handleViewPayment(order)} className="h-8 w-8 text-slate-400 hover:text-emerald-600">
                                            <CreditCard className="w-4 h-4" />
                                        </Button>
                                        )}
                                        {canViewOrderDetails && (
                                        <Button variant="ghost" size="icon" onClick={() => handleViewDetail(order)} className="h-8 w-8 text-slate-400 hover:text-blue-600">
                                            <Eye className="w-4 h-4" />
                                        </Button>
                                        )}
                                        </>
                                    )}
                                    
                                    {(canEditOrders || canDeleteOrders) && !isOrderLocked(order.status) && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {canEditOrders && (
                                                    <DropdownMenuItem onClick={() => handleEdit(order)}>
                                                        <Edit className="w-4 h-4 mr-2" /> Edit
                                                    </DropdownMenuItem>
                                                )}
                                                {canDeleteOrders && (
                                                    <DropdownMenuItem onClick={() => handleDelete(order.id)} className="text-red-600">
                                                        <Trash2 className="w-4 h-4 mr-2" /> Hapus
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    );

                 })
              )}
          </div>
          </>
          ) : (
             <div className="flex flex-col h-full min-h-[600px] bg-slate-50 dark:bg-slate-900">
                {/* Map View Header */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#0E7490] flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                        <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                        <h4 className="font-bold text-[#0B1F3B] dark:text-slate-100 mb-1">Peta Sebaran & Rute</h4>
                        <p className="text-xs text-[#6B7280] dark:text-slate-400">
                           Menampilkan {routeGroups.reduce((acc, g) => acc + g.points.length, 0)} titik kunjungan dari {routeGroups.length} teknisi aktif.
                        </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row h-auto lg:h-[700px]">
                   {/* Sidebar List */}
                   <div className="w-full lg:w-80 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-y-auto order-2 lg:order-1 h-[300px] lg:h-full">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
                            <h5 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wide">
                                Jadwal Teknisi
                            </h5>
                        </div>
                        <div className="p-2 space-y-4">
                            {routeGroups.map((group) => (
                            <div key={group.id} className="space-y-2">
                                {/* Technician Header */}
                                <div className="flex items-center gap-2 px-2 py-1">
                                    <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: group.color }}></div>
                                    <h5 className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                                        {group.technicianName}
                                    </h5>
                                    <span className="text-[10px] text-slate-400">({group.points.length})</span>
                                </div>

                                {/* Points List */}
                                <div className="space-y-1 ml-1.5 pl-2 border-l border-slate-200 dark:border-slate-700">
                                {group.points.map((point, index) => (
                                    <div key={point.id} className="group flex items-start gap-2 p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                                        <div 
                                            className="w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 shadow-sm"
                                            style={{ backgroundColor: group.color }} 
                                        >
                                            {index + 1}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 w-full">
                                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate flex-1">{point.name}</p>
                                            </div>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">{point.address}</p>
                                            
                                            {point.isFallback && (
                                                <div className="mt-1 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded px-2 py-1 flex items-start gap-1.5">
                                                    <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                                                    <p className="text-[10px] text-red-700 dark:text-red-300 font-medium leading-tight">
                                                        Lokasi belum ditemukan. Menggunakan titik default Jakarta.
                                                    </p>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge status={point.status} size="sm" className="text-[9px] px-1 py-0 h-4" />
                                                <span className="text-[10px] text-slate-400 font-medium flex items-center gap-0.5">
                                                    <Clock className="w-2.5 h-2.5" /> {point.time}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                </div>
                            </div>
                            ))}
                            {routeGroups.length === 0 && (
                                <div className="text-center py-8 px-4 text-xs text-slate-400">
                                    Tidak ada rute teknisi yang terbentuk dari filter saat ini.
                                </div>
                            )}
                        </div>
                   </div>

                   {/* Map Area */}
                   <div className="w-full aspect-[2/3] md:aspect-auto md:flex-1 relative z-0 md:h-full order-1 lg:order-2">
                        <MapCard 
                            groups={routeGroups} 
                            branches={branchPoints}
                            height="100%" 
                            showLegend={false} 
                            className="border-none rounded-none" 
                        />
                   </div>
                </div>
             </div>
          )}
        </OperationalTableCard>

        {/* Mobile WA Template Sheet */}
        <Sheet open={waSheetOpen} onOpenChange={setWaSheetOpen}>
            <SheetContent side="bottom" className="rounded-t-[20px] max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 px-6 pt-6 pb-8">
                <SheetHeader className="text-left mb-6 space-y-1">
                    <SheetTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">Pilih Template Pesan</SheetTitle>
                    <SheetDescription className="text-slate-500 dark:text-slate-400 text-sm">
                        Kirim pesan WhatsApp ke <span className="font-medium text-slate-700 dark:text-slate-300">{waTargetOrder?.customerName}</span> ({waTargetOrder?.customerPhone})
                    </SheetDescription>
                </SheetHeader>
                
                <div className="space-y-3 pb-4">
                    {waTargetOrder && waTemplates
                        .filter(t => t.category === 'Orders' || t.category === 'General' || !t.category)
                        .map(t => {
                            const isUsed = isTemplateUsed(waTargetOrder, t.id);
                            return (
                                <div 
                                    key={t.id} 
                                    onClick={() => {
                                        handleWhatsappTemplate(waTargetOrder, t);
                                        setWaSheetOpen(false);
                                    }}
                                    className={`group p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 active:scale-[0.99] ${
                                        isUsed 
                                        ? 'bg-blue-50/50 border-blue-500 dark:bg-blue-900/10 dark:border-blue-500' 
                                        : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'
                                    }`}
                                >
                                    <div className="mb-1.5">
                                        <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                            {t.title}
                                        </h4>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                        {t.message.replace(/\[Nama\]/g, waTargetOrder.customerName)}
                                    </p>
                                </div>
                            );
                    })}
                </div>

                <div className="pt-2 sticky bottom-0 bg-white dark:bg-slate-900 pb-2">
                    <Button 
                        variant="outline" 
                        className="w-full justify-center h-12 rounded-xl border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 hover:border-slate-400 transition-all"
                        onClick={() => {
                            if (waTargetOrder) handleWhatsappTemplate(waTargetOrder);
                            setWaSheetOpen(false);
                        }}
                    >
                        Chat Manual (Tanpa Template)
                    </Button>
                </div>
            </SheetContent>
        </Sheet>

        {/* Order Form Modal */}
        <OrderForm 
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          initialData={editingOrder}
        />

        {/* Order Detail Modal */}
        {detailOrder && (
        <OrderDetailDialog 
           isOpen={isDetailOpen}
           onClose={() => setIsDetailOpen(false)}
           order={detailOrder}
        />
        )}

        {paymentOrder && (
        <OrderPaymentDialog
           isOpen={isPaymentDialogOpen}
           onClose={() => {
             setIsPaymentDialogOpen(false);
             setPaymentOrder(null);
           }}
           order={paymentOrder}
        />
        )}

        {/* Photo Viewer Modal */}
        <Modal
            isOpen={!!photoViewerOrder}
            onClose={() => setPhotoViewerOrder(null)}
            title="Dokumentasi Pekerjaan"
            size="lg"
        >
            {photoViewerOrder && (
                <div className="h-[500px] flex flex-col">
                    <Tabs defaultValue="before" className="w-full flex-1 flex flex-col">
                        <TabsList className="grid w-full grid-cols-4 mb-4 bg-slate-100 dark:bg-slate-800 p-1">
                            <TabsTrigger value="before" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm text-[10px] sm:text-xs px-1">Sebelum ({(photoViewerOrder.photos as any)?.before?.length || 0})</TabsTrigger>
                            <TabsTrigger value="after" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm text-[10px] sm:text-xs px-1">Sesudah ({(photoViewerOrder.photos as any)?.after?.length || 0})</TabsTrigger>
                            <TabsTrigger value="payment" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm text-[10px] sm:text-xs px-1">
                                Bayar ({(photoViewerOrder.photos as any)?.payment?.length === 0 && (photoViewerOrder.photos as any)?.paymentDeleted ? <span className="text-red-500 font-medium">Dihapus</span> : (photoViewerOrder.photos as any)?.payment?.length || 0})
                            </TabsTrigger>
                            <TabsTrigger value="signature" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm text-[10px] sm:text-xs px-1">TTD ({(photoViewerOrder.photos as any)?.signature?.length || 0})</TabsTrigger>
                        </TabsList>
                        
                        {['before', 'after', 'payment', 'signature'].map((type) => (
                             <TabsContent key={type} value={type} className="flex-1 overflow-y-auto min-h-0 p-1">
                                {(photoViewerOrder.photos as any)?.[type]?.length > 0 ? (
                                    <div className={`grid gap-4 pb-4 ${type === 'payment' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                        {(photoViewerOrder.photos as any)[type].map((url: string, idx: number) => (
                                            <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex justify-center items-center">
                                                <img 
                                                    src={url} 
                                                    alt={`${type} ${idx + 1}`} 
                                                    className="w-full h-[300px] sm:h-[400px] object-contain" 
                                                    loading="lazy"
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                    <a 
                                                        href={url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="bg-white/90 text-slate-900 text-xs px-3 py-1.5 rounded-full font-medium shadow-sm hover:bg-white pointer-events-auto transform scale-95 group-hover:scale-100 transition-transform"
                                                    >
                                                        Lihat Full Size
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl mb-4">
                                        {type === 'payment' && (photoViewerOrder.photos as any)?.paymentDeleted ? (
                                            <>
                                                <Trash2 className="w-12 h-12 mb-3 text-red-400 opacity-50" />
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Bukti pembayaran telah dihapus</p>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    Dihapus pada {(photoViewerOrder.photos as any)?.paymentDeletedAt ? new Date((photoViewerOrder.photos as any).paymentDeletedAt).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : 'sistem'}
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <Camera className="w-12 h-12 mb-2 opacity-20 text-slate-400" />
                                                <p className="text-sm text-slate-400">Tidak ada foto {
                                                    type === 'payment' ? 'bukti pembayaran' : 
                                                    type === 'before' ? 'sebelum pengerjaan' : 
                                                    type === 'after' ? 'setelah pengerjaan' : 
                                                    'bukti tanda tangan'
                                                }</p>
                                            </>
                                        )}
                                    </div>
                                )}

                                {type === 'payment' && canUploadPaymentProof && (
                                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                        <h4 className="font-bold text-sm mb-3 text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                            <FileUp className="w-4 h-4" />
                                            Upload Bukti Pembayaran
                                        </h4>
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <Upload
                                                label="Pilih foto bukti transfer/pembayaran"
                                                accept="image/*"
                                                multiple={true}
                                                maxFiles={3}
                                                onChange={setUploadedFiles}
                                                preview={true}
                                            />
                                            <div className="mt-4 flex justify-end">
                                                <Button 
                                                    size="sm" 
                                                    onClick={handleSavePaymentProof}
                                                    disabled={isUploading || uploadedFiles.length === 0}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                                >
                                                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileUp className="w-4 h-4 mr-2" />}
                                                    {isUploading ? 'Mengupload...' : 'Simpan Foto'}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                             </TabsContent>
                        ))}
                    </Tabs>
                </div>
            )}
        </Modal>

      {/* Import Preview Dialog */}
      <ImportPreviewModal 
        isOpen={isImportPreviewOpen}
        onClose={() => {
            setIsImportPreviewOpen(false);
            setImportPreviewData([]);
        }}
        onConfirm={handleConfirmImport}
        initialData={importPreviewData}
      />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-slate-900 dark:text-slate-100">Apakah Anda yakin?</AlertDialogTitle>
              <AlertDialogDescription>
                Data pesanan yang dihapus tidak dapat dikembalikan lagi.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-0">Batal</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">Hapus</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {/* Hidden File Input for Import */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".csv,.xlsx,.xls" 
        onChange={handleImportOrders} 
      />
    </OperationalPageShell>
  );
}
