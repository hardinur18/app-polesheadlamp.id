import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription
} from '../../components/ui/sheet';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { useMasterData } from '../master-data/context';
import { Order, AVAILABLE_TIME_SLOTS } from '../master-data/data';
import { usePermissions } from '@/app/hooks/usePermissions';
import { toast } from 'sonner';
import { logActivity } from '@/app/services/auditService';
import {
  isAdminManagementRole,
  isAdvertiserRole,
  isCsRole,
  isOwnerLikeRole,
  isTechnicianRole,
} from '@/app/data/roleHelpers';
import { Loader2, MapPin, Check, ChevronsUpDown, AlertTriangle, X } from 'lucide-react';
import { Alert } from '../../components/ui/alert';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import { cn } from "../../components/ui/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { getCoordinatesFromUrl, getDistance, expandShortUrl } from '@/utils/mapUtils';
import { OrderStatusReasonFields } from './OrderStatusReasonFields';
import { isReasonRequiredStatus } from './cancelReasonOptions';
import { RequiredLabel } from '../../components/ui/operational-page';
import {
  formatOrderBookingScheduleConflictMessage,
  formatOrderScheduleConflictMessage,
  formatOrderScheduleInactiveWarning,
  formatTechnicianUnavailableMessage,
  getOrderScheduleConflicts,
  getOrderProspectBookingScheduleConflicts,
  getTechnicianDaySchedule,
  shouldValidateOrderScheduleOnSave,
  validateOrderScheduleFromDB,
} from '@/app/services/orderScheduleValidation';
import { normalizeOrderTime } from '@/app/services/orderTime';

const FormSection = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="mb-4 border-b border-slate-100 pb-3 dark:border-slate-800">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
    </div>
    {children}
  </section>
);

function normalizeCustomerPhone(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

interface OrderFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Order | null;
  prefillData?: Partial<Order>;
  onSuccess?: (order: Order) => Promise<void> | void;
}

export const OrderForm: React.FC<OrderFormProps> = ({ isOpen, onClose, initialData, prefillData, onSuccess }) => {
  const { 
    addOrder, updateOrder, orders, prospectBookings, leads,
    services, vehicles, platforms, subChannels, users, areas, payments, activeBranches: branches,
    currentUser, currentRole, technicianSchedules, advertiserConfigs, affiliates,
    cancelReasons
  } = useMasterData();
  const { hasPermission } = usePermissions();
  const isAdminManagementUser = isAdminManagementRole(currentRole);
  const isAdvertiserUser = isAdvertiserRole(currentRole);
  const isCsUser = isCsRole(currentRole);
  const isTechnicianUser = isTechnicianRole(currentRole);
  const isOwnerLikeUser = isOwnerLikeRole(currentRole);
  const canCreateOrder = hasPermission('order.create');
  const canEditOrderInfo = hasPermission('order.edit') || (!initialData && canCreateOrder);
  const canAssignTechnician = hasPermission('order.assign_technician') || canEditOrderInfo;
  const canEditOrderStatus = hasPermission('order.status.edit') || canEditOrderInfo;
  const canMarkOrderDone = hasPermission('order.status.mark_done') || isOwnerLikeUser;
  const canEditPaymentType = hasPermission('order.payment.edit_type') || canEditOrderInfo;
  const canEditPaymentStatus = hasPermission('order.payment.edit_status');
  const canValidatePayment = canEditPaymentStatus || hasPermission('finance.manage') || isOwnerLikeUser;

  const [formData, setFormData] = useState<Partial<Order>>({});
  
  // Mobile Detection for Sheet Behavior
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile(); // Check on mount
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [recommendedBranches, setRecommendedBranches] = useState<{ id: string, name: string, distance: number }[]>([]);
  const [mapsUrlError, setMapsUrlError] = useState<string | null>(null);
  const [openVehicle, setOpenVehicle] = useState(false);
  const lastInitializedSourceRef = useRef<string | null>(null);

  const formSourceKey = initialData?.id
    ? `edit:${initialData.id}`
    : prefillData?.leadId
      ? `prefill:${prefillData.leadId}`
      : prefillData
        ? `prefill:${JSON.stringify(prefillData)}`
        : 'new';

  const scheduleConflicts = useMemo(
    () => getOrderScheduleConflicts(formData, orders || []),
    [formData.id, formData.technicianId, formData.serviceDate, formData.serviceTime, orders],
  );

  const ignoredBookingLeadIds = useMemo(
    () => new Set(
      (leads || [])
        .filter((lead) => lead.status === 'Cancel' || lead.status === 'Closing')
        .map((lead) => lead.id),
    ),
    [leads],
  );

  const scheduleBlockingProspectBookings = useMemo(
    () => (prospectBookings || []).filter((booking) =>
      !booking.leadId || !ignoredBookingLeadIds.has(booking.leadId)
    ),
    [ignoredBookingLeadIds, prospectBookings],
  );

  const blockingConflictMessage = useMemo(() => {
    if (!shouldValidateOrderScheduleOnSave(initialData, formData)) {
      return null;
    }

    if (scheduleConflicts.activeConflicts.length === 0) {
      return null;
    }

    return formatOrderScheduleConflictMessage(
      formData,
      scheduleConflicts.activeConflicts,
      users,
    );
  }, [formData, initialData, scheduleConflicts.activeConflicts, users]);

  const blockingBookingConflictMessage = useMemo(() => {
    if (!shouldValidateOrderScheduleOnSave(initialData, formData)) {
      return null;
    }

    const activeBookingConflicts = getOrderProspectBookingScheduleConflicts(
      formData,
      scheduleBlockingProspectBookings,
    );
    if (activeBookingConflicts.length === 0) {
      return null;
    }

    return formatOrderBookingScheduleConflictMessage(
      formData,
      activeBookingConflicts,
      users,
    );
  }, [formData, initialData, scheduleBlockingProspectBookings, users]);

  const blockingTechnicianAvailabilityMessage = useMemo(() => {
    if (!shouldValidateOrderScheduleOnSave(initialData, formData)) {
      return null;
    }

    const technicianSchedule = getTechnicianDaySchedule(
      formData.technicianId,
      formData.serviceDate,
      technicianSchedules,
    );

    if (!technicianSchedule) {
      return null;
    }

    return formatTechnicianUnavailableMessage(
      formData,
      technicianSchedule,
      users,
    );
  }, [formData, initialData, technicianSchedules, users]);

  const blockingScheduleMessage =
    blockingTechnicianAvailabilityMessage || blockingConflictMessage || blockingBookingConflictMessage;

  const matchingCustomerPhoneHistory = useMemo(() => {
    const normalizedPhone = normalizeCustomerPhone(formData.customerPhone);
    if (normalizedPhone.length < 8) {
      return [];
    }

    const orderMatches = (orders || [])
      .filter((order) =>
        order.id !== formData.id &&
        normalizeCustomerPhone(order.customerPhone) === normalizedPhone
      )
      .map((order) => ({
        type: 'Order',
        id: order.id,
        customerName: order.customerName,
        date: order.serviceDate,
        status: order.status,
      }));

    const bookingMatches = (prospectBookings || [])
      .filter((booking) =>
        !booking.orderId &&
        normalizeCustomerPhone(booking.customerPhone) === normalizedPhone
      )
      .map((booking) => ({
        type: 'Booking',
        id: booking.id,
        customerName: booking.customerName,
        date: booking.scheduleDate,
        status: booking.status,
      }));

    return [...orderMatches, ...bookingMatches]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 3);
  }, [formData.customerPhone, formData.id, orders, prospectBookings]);

  const inactiveConflictWarning = useMemo(() => {
    if (
      !formData.technicianId ||
      !formData.serviceDate ||
      !formData.serviceTime ||
      blockingScheduleMessage ||
      scheduleConflicts.inactiveConflicts.length === 0
    ) {
      return null;
    }

    return formatOrderScheduleInactiveWarning(
      formData,
      scheduleConflicts.inactiveConflicts,
      users,
    );
  }, [
    blockingScheduleMessage,
    formData,
    formData.serviceDate,
    formData.serviceTime,
    formData.technicianId,
    scheduleConflicts.inactiveConflicts,
    users,
  ]);

  // --- FILTERING LOGIC (ADVERTISER CONFIG) ---
  const filteredAdvertisers = React.useMemo(() => {
      const ads = users.filter((u) => isAdvertiserRole(u.role) && u.status === 'active');
      if (isCsUser && currentUser) {
          const myAdvertiserIds = advertiserConfigs
              .filter(cfg => cfg.csIds.includes(currentUser.id))
              .map(cfg => cfg.advertiserId);
          if (myAdvertiserIds.length > 0) return ads.filter(a => myAdvertiserIds.includes(a.id));
          return ads; 
      }
      return ads;
  }, [advertiserConfigs, currentUser, isCsUser, users]);

  const activeConfig = React.useMemo(() => {
      // Priority 1: Form Selection
      if (formData.advertiserId) {
         return advertiserConfigs.find(c => c.advertiserId === formData.advertiserId);
      }
      // Priority 2: Current User (Advertiser)
      if (isAdvertiserUser && currentUser) {
         return advertiserConfigs.find(c => c.advertiserId === currentUser.id);
      }
      return null;
  }, [advertiserConfigs, currentUser, formData.advertiserId, isAdvertiserUser]);

  const filteredPlatforms = React.useMemo(() => {
      // RULE 1: Admins -> All
      if (isAdminManagementUser) {
          return platforms.filter(p => p.status === 'active');
      }

      // Helper
      const mandatoryPlatformNames = ['repeat order', 'organik'];
      const mandatoryPlatforms = platforms.filter(p => mandatoryPlatformNames.includes(p.name.toLowerCase()));

      // RULE 2: Config Based
      if (activeConfig) {
          const allowedIds = activeConfig.platformIds || [];
          const allowedPlatforms = platforms.filter(p => allowedIds.includes(p.id));
          
          if (isAdvertiserUser) {
              // Advertiser: Config Only
              return allowedPlatforms;
          } else {
              // CS: Config + Mandatory
              const combined = [...allowedPlatforms, ...mandatoryPlatforms];
              return Array.from(new Map(combined.map(p => [p.id, p])).values());
          }
      }

      // RULE 3: CS (No Adv selected)
      if (isCsUser && currentUser) {
          const myConfigs = advertiserConfigs.filter(cfg => cfg.csIds?.includes(currentUser.id));
          if (myConfigs.length > 0) {
              const allowedIds = new Set<string>();
              myConfigs.forEach(cfg => cfg.platformIds?.forEach(id => allowedIds.add(id)));
              const allowedPlatforms = platforms.filter(p => allowedIds.has(p.id));
              const combined = [...allowedPlatforms, ...mandatoryPlatforms];
              return Array.from(new Map(combined.map(p => [p.id, p])).values());
          }
          // Fallback if no config: All Active + Mandatory
          const combined = [...platforms.filter(p => p.status === 'active'), ...mandatoryPlatforms];
          return Array.from(new Map(combined.map(p => [p.id, p])).values());
      }
      
      // Advertiser Fallback -> All Active (Safety net)
      if (isAdvertiserUser) {
          return platforms.filter(p => p.status === 'active');
      }

      return platforms;
  }, [activeConfig, advertiserConfigs, currentUser, isAdminManagementUser, isAdvertiserUser, isCsUser, platforms]);

  const filteredSubChannels = React.useMemo(() => {
      let scs = subChannels;
      
      // Strict Config
      if (activeConfig) {
          // Only filter if subChannelIds is defined and not empty array (if intended)
          // Assuming empty array = block all, but to be safe with "fallback" logic:
          if (activeConfig.subChannelIds && activeConfig.subChannelIds.length > 0) {
              scs = scs.filter(s => activeConfig.subChannelIds!.includes(s.id));
          }
      } 
      // If no config, pass through (Show All)

      if (formData.platformId) {
          scs = scs.filter(s => s.platformId === formData.platformId);
      }
      return scs.filter(s => s.status === 'active');
  }, [subChannels, activeConfig, formData.platformId]);

  const filteredCS = React.useMemo(() => {
      const css = users.filter((u) => isCsRole(u.role) && u.status === 'active');
      
      // Admins -> All
      if (isAdminManagementUser) {
          return css;
      }

      // Strict Config
      if (activeConfig) {
          if (activeConfig.csIds && activeConfig.csIds.length > 0) {
              return css.filter(c => activeConfig.csIds!.includes(c.id));
          }
          // If config exists but empty list -> Empty CS
          return [];
      }
      
      // No Config -> All CS (Safety net)
      return css;
  }, [users, activeConfig, isAdminManagementUser]);

  useEffect(() => {
     if (formData.subChannelId && formData.platformId) {
        const isValid = filteredSubChannels.some(sc => sc.id === formData.subChannelId);
        if (!isValid) {
            setFormData(prev => ({ ...prev, subChannelId: undefined }));
        }
     }
  }, [formData.platformId, filteredSubChannels]);

  const validateMapsUrl = async (url: string, silent = false): Promise<{ lat: number, lng: number } | null> => {
      let targetUrl = url || '';
      if (!targetUrl) return null;
      targetUrl = targetUrl.trim().replace(/[.,;]+$/, '');
      
      // 1. Cek apakah ini short URL yang dikenal
      const isShortUrl = targetUrl.includes('goo.gl') || targetUrl.includes('maps.app.goo.gl') || targetUrl.includes('bit.ly') || targetUrl.includes('g.co');
      
      if (isShortUrl) {
         if (!silent) toast.info("Mengambil detail lokasi dari link pendek...", { duration: 2000 });
         try {
             const expanded = await expandShortUrl(targetUrl);
             if (expanded && expanded !== targetUrl) {
                 targetUrl = expanded;
             }
         } catch (e) {
             console.error("Expand error:", e);
         }
      }

      // 2. Coba ambil koordinat
      let coords = getCoordinatesFromUrl(targetUrl);

      // 3. Jika gagal & bukan short URL (mungkin URL panjang tapi aneh), coba expand juga sebagai upaya terakhir
      if (!coords && !isShortUrl && targetUrl.startsWith('http')) {
          if (!silent) toast.info("Mencoba analisis link maps...", { duration: 2000 });
          try {
             const expanded = await expandShortUrl(targetUrl);
             if (expanded && expanded !== targetUrl) {
                 targetUrl = expanded;
                 coords = getCoordinatesFromUrl(targetUrl);
             }
          } catch (e) {
             console.error("Deep expand error:", e);
          }
      }

      if (!coords) {
         if (!silent) {
             toast.error('Gagal mendapatkan titik koordinat dari link ini.');
             // Tampilkan hint kenapa gagal
             if (targetUrl.includes('/search/')) {
                 setMapsUrlError("Link ini adalah hasil pencarian, bukan lokasi spesifik. Mohon pilih satu lokasi lalu klik 'Bagikan' > 'Salin Link'.");
             } else {
                 setMapsUrlError("Pastikan link mengandung koordinat atau gunakan tombol 'Bagikan' di Google Maps.");
             }
         }
         return null;
      }
      return coords;
  };

  const handleRecommendBranch = async () => {
    setMapsUrlError(null);
    const coords = await validateMapsUrl(formData.mapsUrl || '');
    if (!coords) {
        setMapsUrlError("URL tidak valid atau lokasi tidak ditemukan");
        return;
    }
    let foundBranches: { id: string, name: string, distance: number }[] = [];
    branches.forEach(branch => {
        let branchLat = branch.lat;
        let branchLng = branch.lng;
        if ((!branchLat || !branchLng) && branch.mapsUrl) {
            const branchCoords = getCoordinatesFromUrl(branch.mapsUrl);
            if (branchCoords) {
                branchLat = branchCoords.lat;
                branchLng = branchCoords.lng;
            }
        }
        if (branchLat && branchLng) {
            const dist = getDistance(coords.lat, coords.lng, branchLat, branchLng);
            foundBranches.push({ id: branch.id, name: branch.name, distance: dist });
        }
    });
    if (foundBranches.length > 0) {
        foundBranches.sort((a, b) => a.distance - b.distance);
        const topBranches = foundBranches.slice(0, 5);
        setRecommendedBranches(topBranches);
        toast.success(`Ditemukan ${topBranches.length} rekomendasi cabang terdekat.`);
    } else {
        toast.warning('Tidak dapat menemukan lokasi cabang yang valid untuk perbandingan.');
    }
  };

  useEffect(() => {
    if (!isOpen) {
      lastInitializedSourceRef.current = null;
      return;
    }

    if (lastInitializedSourceRef.current === formSourceKey) {
      return;
    }

    lastInitializedSourceRef.current = formSourceKey;
    setIsDirty(false);
    setRecommendedBranches([]); 
    setMapsUrlError(null);

    if (initialData) {
      setFormData({
        ...initialData,
        serviceTime: normalizeOrderTime(initialData.serviceTime),
        units: initialData.units || 1,
      });
      return;
    }

    const normalizedPrefillData = prefillData
      ? {
          ...prefillData,
          serviceTime: prefillData.serviceTime
            ? normalizeOrderTime(prefillData.serviceTime)
            : prefillData.serviceTime,
        }
      : undefined;

    setFormData({
      id: `OP-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      leadDate: new Date().toISOString().split('T')[0],
      status: 'pending',
      paymentType: 'Transfer',
      paymentStatus: 'Unpaid',
      paymentValidation: 'Pending',
      serviceCategory: 'Visit',
      units: 1,
      csId: isCsUser ? currentUser?.id : undefined,
      branchId: isTechnicianUser ? currentUser?.branchId : undefined,
      advertiserId: isAdvertiserUser ? currentUser?.id : undefined,
      ...normalizedPrefillData
    });
  }, [
    currentUser?.branchId,
    currentUser?.id,
    formSourceKey,
    initialData,
    isAdvertiserUser,
    isCsUser,
    isOpen,
    isTechnicianUser,
    prefillData,
  ]);

  useEffect(() => {
    if (formData.technicianId) {
      const tech = users.find(u => u.id === formData.technicianId);
      if (tech && tech.branchId) {
        setFormData(prev => {
            // Prevent unnecessary updates/renders if branchId is already correct
            if (prev.branchId === tech.branchId) return prev;
            return { ...prev, branchId: tech.branchId };
        });
      }
    }
  }, [formData.technicianId, users]);

  const handleChange = (field: keyof Order, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'serviceTime' ? normalizeOrderTime(value) : value,
    }));
    setIsDirty(true);
  };

  const handleStatusChange = (value: string) => {
    setFormData((prev) => {
      const nextStatus = value as Order['status'];
      const shouldResetReason =
        !isReasonRequiredStatus(nextStatus) ||
        (isReasonRequiredStatus(prev.status) && prev.status !== nextStatus);

      return {
        ...prev,
        status: nextStatus,
        ...(shouldResetReason
          ? {
              cancelReason: undefined,
              cancelReasonNote: undefined,
            }
          : {}),
      };
    });
    setIsDirty(true);
  };

  const handleClose = () => {
    if (isDirty) {
      setShowCancelConfirm(true);
    } else {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Sanitize empty strings to undefined to prevent Foreign Key Violation
    const sanitizedData = { ...formData };
    const nullableKeys: (keyof Order)[] = [
      'advertiserId', 'platformId', 'subChannelId', 'vehicleId', 'csId', 
      'branchId', 'technicianId', 'areaId', 'paymentMethodId', 'serviceId'
    ];
    
    nullableKeys.forEach(key => {
        if (sanitizedData[key] === "") {
            // @ts-ignore
            sanitizedData[key] = undefined;
        }
    });

    sanitizedData.serviceTime = normalizeOrderTime(sanitizedData.serviceTime);

    const requiredFields: (keyof Order)[] = [
      'leadDate', 'customerName', 'customerPhone', 'address', 
      'serviceDate', 'serviceTime', 'serviceId', 'serviceCategory', 
      'mapsUrl', 'platformId', 'price', 'csId'
    ];
    const missingFields = requiredFields.filter(field => !sanitizedData[field]);
    if (missingFields.length > 0) {
      toast.error(`Mohon lengkapi field wajib: ${missingFields.join(', ')}`);
      return;
    }

    // Validate cancel reason when status is cancelled or reschedule
    if ((sanitizedData.status === 'cancelled' || sanitizedData.status === 'reschedule') && !sanitizedData.cancelReason) {
      toast.error('Mohon pilih alasan ' + (sanitizedData.status === 'cancelled' ? 'pembatalan' : 'jadwal ulang'));
      return;
    }

    if (blockingScheduleMessage) {
      toast.error(blockingScheduleMessage);
      return;
    }

    // Clear cancel reason fields if status is not cancelled/reschedule
    if (sanitizedData.status !== 'cancelled' && sanitizedData.status !== 'reschedule') {
      sanitizedData.cancelReason = undefined;
      sanitizedData.cancelReasonNote = undefined;
    }

    // Auto-reset follow-up when status changes to cancelled/reschedule (new cancel)
    if (initialData && (sanitizedData.status === 'cancelled' || sanitizedData.status === 'reschedule') && initialData.status !== sanitizedData.status) {
      sanitizedData.isFollowedUp = false;
      sanitizedData.followedUpBy = undefined;
      sanitizedData.followedUpAt = undefined;
      sanitizedData.followUpNote = undefined;
    }

    setIsSubmitting(true);
    if (sanitizedData.mapsUrl) {
       const coords = await validateMapsUrl(sanitizedData.mapsUrl, true);
       if (!coords) {
           setMapsUrlError("URL Maps tidak valid. Mohon periksa kembali linknya.");
           toast.error("URL Maps tidak valid. Tidak dapat menyimpan pesanan.");
           setIsSubmitting(false);
           return;
       }
    }

    // Fresh DB validation to prevent double-booking from stale context data
    if (shouldValidateOrderScheduleOnSave(initialData, sanitizedData)) {
      const dbConflict = await validateOrderScheduleFromDB(sanitizedData, users, {
        ignoredBookingLeadIds,
      });
      if (dbConflict) {
        toast.error(dbConflict);
        setIsSubmitting(false);
        return;
      }
    }

    try {
      let savedOrder: Order | undefined;
      if (initialData) {
        savedOrder = await updateOrder(sanitizedData as Order);
        toast.success('Pesanan berhasil diperbarui');
        if (currentUser) {
          logActivity(
            { id: currentUser.id, name: currentUser.name, role: currentUser.role },
            'UPDATE',
            'Pesanan',
            `Memperbarui pesanan: ${sanitizedData.customerName}`,
            initialData.id || '',
            { service: sanitizedData.serviceId, status: sanitizedData.status }
          );
        }
      } else {
        savedOrder = await addOrder(sanitizedData as Order);
        toast.success('Pesanan berhasil dibuat');
        if (currentUser) {
          logActivity(
            { id: currentUser.id, name: currentUser.name, role: currentUser.role },
            'CREATE',
            'Pesanan',
            `Membuat pesanan baru: ${sanitizedData.customerName}`,
            '',
            { service: sanitizedData.serviceId, customer: sanitizedData.customerName }
          );
        }
      }
      if (onSuccess) await onSuccess((savedOrder || sanitizedData) as Order);
      onClose();
    } catch (error: any) {
      toast.error(error?.message || 'Gagal menyimpan pesanan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canEdit = (field: keyof Order): boolean => {
    const commonFields: (keyof Order)[] = [
      'leadDate', 'customerName', 'customerPhone', 'address', 
      'serviceDate', 'serviceTime', 'serviceId', 'serviceCategory', 
      'mapsUrl', 'vehicleId', 'price', 'platformId', 'notes', 
      'areaId', 'affiliateName'
    ];
    if (commonFields.includes(field)) {
      return canEditOrderInfo;
    }
    if (field === 'status') {
      return canEditOrderStatus;
    }
    if (field === 'paymentMethodId') {
      return canEditPaymentType;
    }
    if (field === 'csId') {
      return canEditOrderInfo && !isCsUser;
    }
    if (field === 'technicianId') {
       return canAssignTechnician;
    }
    if (field === 'advertiserId') {
       return canEditOrderInfo;
    }
    if (field === 'branchId') {
       return canEditOrderInfo && !isTechnicianUser;
    }
    if (field === 'paymentValidation') {
       return canValidatePayment;
    }
    if (field === 'paymentStatus' || field === 'income') {
       return canEditPaymentStatus;
    }
    return true; 
  };

  const csUsers = filteredCS;
  const techUsers = users.filter((u) => isTechnicianRole(u.role) && u.status === 'active');
  const advertiserUsers = filteredAdvertisers;
  const filteredAreas = formData.branchId ? areas.filter(a => a.branchId === formData.branchId) : areas;
  
  // Use real data from affiliates context instead of mock
  const activeAffiliates = (affiliates || []).filter(a => a.status === 'Active');

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <SheetContent 
        side={isMobile ? "bottom" : "right"} 
        className={cn(
          "flex flex-col gap-0 border-l border-slate-200 bg-slate-50 p-0 dark:border-slate-800 dark:bg-slate-950",
          isMobile ? "h-[90vh] rounded-t-xl" : "h-full w-full sm:max-w-xl md:max-w-2xl"
        )}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => { e.preventDefault(); handleClose(); }}
      >
        <SheetHeader className="sticky top-0 z-10 shrink-0 rounded-t-xl border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <SheetTitle className="text-left text-lg font-semibold text-slate-900 dark:text-slate-100">
                {initialData ? 'Edit Pesanan' : 'Tambah Pesanan Baru'}
              </SheetTitle>
              <SheetDescription className="text-left text-sm text-slate-500 dark:text-slate-400">
                Lengkapi detail pesanan berikut.
              </SheetDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8 text-slate-400 hover:text-slate-600 -mr-2 -mt-1 rounded-full"
            >
              <X className="w-4 h-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <form id="order-form" onSubmit={handleSubmit} className="space-y-4">
            
            <FormSection title="Data Pelanggan" description="Identitas customer, kontak, alamat, dan lokasi maps.">
              <div className="grid grid-cols-1 gap-4">
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label>ID Order</Label>
                   <Input value={formData.id || ''} disabled className="bg-slate-50 dark:bg-slate-800 font-mono text-sm" />
                 </div>
                 <div className="space-y-2">
                   <RequiredLabel>Tanggal Leads</RequiredLabel>
                   <Input 
                      type="date" 
                      value={formData.leadDate || ''} 
                      onChange={(e) => handleChange('leadDate', e.target.value)}
                      disabled={!canEdit('leadDate')}
                   />
                 </div>
               </div>

               <div className="space-y-2">
                 <RequiredLabel>Nama Lengkap Client</RequiredLabel>
                 <Input 
                    value={formData.customerName || ''} 
                    onChange={(e) => handleChange('customerName', e.target.value)}
                    disabled={!canEdit('customerName')}
                    className="font-medium"
                 />
               </div>

               <div className="space-y-2">
                 <RequiredLabel>No Whatsapp</RequiredLabel>
                 <Input 
                    value={formData.customerPhone || ''} 
                    onChange={(e) => handleChange('customerPhone', e.target.value)}
                    disabled={!canEdit('customerPhone')}
                 />
                 {matchingCustomerPhoneHistory.length > 0 && (
                   <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                     <div className="flex items-start gap-2">
                       <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                       <div className="space-y-1">
                         <p className="font-medium">Nomor ini punya riwayat order/booking.</p>
                         <p className="leading-relaxed">
                           Repeat order tetap boleh disimpan; yang diblokir hanya jadwal aktif dengan teknisi, tanggal, dan jam yang sama.
                         </p>
                         <div className="space-y-0.5 text-amber-800">
                           {matchingCustomerPhoneHistory.map((item) => (
                             <p key={`${item.type}-${item.id}`}>
                               {item.type} {item.id} - {item.date || '-'} - {item.status}
                             </p>
                           ))}
                         </div>
                       </div>
                     </div>
                   </div>
                 )}
               </div>

               <div className="space-y-2">
                 <RequiredLabel>Alamat Lengkap</RequiredLabel>
                 <Textarea 
                    value={formData.address || ''} 
                    onChange={(e) => handleChange('address', e.target.value)}
                    disabled={!canEdit('address')}
                    className="min-h-[80px]"
                 />
               </div>

               <div className="space-y-2">
                 <RequiredLabel>Maps URL</RequiredLabel>
                 <div className="flex gap-2">
                     <Input 
                         value={formData.mapsUrl || ''} 
                         onChange={(e) => {
                             handleChange('mapsUrl', e.target.value);
                             if (mapsUrlError) setMapsUrlError(null); 
                             if (!e.target.value) {
                                setRecommendedBranches([]);
                                setMapsUrlError(null);
                             }
                         }}
                         disabled={!canEdit('mapsUrl')}
                         placeholder="https://maps.google.com/..."
                         className={`flex-1 ${mapsUrlError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                     />
                     <Button
                         type="button"
                         variant="secondary"
                         size="icon"
                         onClick={handleRecommendBranch}
                         disabled={!formData.mapsUrl}
                         title="Cari Cabang Terdekat"
                         className="shrink-0"
                     >
                         <MapPin className="w-4 h-4" />
                     </Button>
                 </div>
                 {mapsUrlError && (
                    <p className="text-xs text-red-500 font-medium animate-in slide-in-from-top-1">{mapsUrlError}</p>
                 )}
                 {recommendedBranches.length > 0 && (
                    <div className="mt-2 space-y-2">
                        {recommendedBranches.map((branch, idx) => (
                            <Alert key={branch.id} className={`p-2 flex items-center gap-2 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 ${idx === 0 ? 'border-l-4 border-l-blue-500' : ''}`}>
                                <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                <div className="flex-1 flex items-center justify-between min-w-0">
                                    <div className="flex items-center gap-2 text-xs text-blue-900 dark:text-blue-200 overflow-hidden">
                                        <span className="font-bold uppercase shrink-0">{idx === 0 ? 'Utama' : `#${idx + 1}`}</span>
                                        <span className="truncate" title={branch.name}>{branch.name}</span>
                                        <span className="font-mono font-bold text-blue-700 dark:text-blue-400 shrink-0">({branch.distance.toFixed(1)} km)</span>
                                    </div>
                                    <Button 
                                        type="button" 
                                        size="sm" 
                                        variant="secondary" 
                                        className="ml-2 h-6 px-2 text-[10px] shrink-0"
                                        onClick={() => {
                                            handleChange('branchId', branch.id);
                                            handleChange('areaId', undefined); 
                                            setRecommendedBranches([]); 
                                            toast.success(`Cabang ${branch.name} dipilih`);
                                        }}
                                    >
                                        Pilih
                                    </Button>
                                </div>
                            </Alert>
                        ))}
                    </div>
                 )}
               </div>
              </div>
            </FormSection>

            <FormSection title="Layanan & Jadwal" description="Atur tanggal, jam, layanan, unit, dan harga.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-2">
                 <RequiredLabel>Tanggal Service</RequiredLabel>
                 <Input 
                    type="date" 
                    value={formData.serviceDate || ''} 
                    onChange={(e) => handleChange('serviceDate', e.target.value)}
                    disabled={!canEdit('serviceDate')}
                 />
               </div>

               <div className="space-y-2">
                 <RequiredLabel>Jam</RequiredLabel>
                 <Select 
                    value={formData.serviceTime || ''} 
                    onValueChange={(val) => handleChange('serviceTime', val)}
                    disabled={!canEdit('serviceTime')}
                 >
                    <SelectTrigger className={!formData.serviceTime ? "text-slate-500" : ""}>
                        <span className="text-slate-500"><Loader2 className="w-3 h-3 opacity-0" /></span> 
                        <SelectValue placeholder="--:--" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                        {AVAILABLE_TIME_SLOTS.map(time => (
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                    </SelectContent>
                 </Select>
               </div>

               <div className="space-y-2">
                 <RequiredLabel>Layanan</RequiredLabel>
                 <Select 
                   value={formData.serviceId} 
                   onValueChange={(val) => {
                      const selectedService = services.find(s => s.id === val);
                      setFormData(prev => ({ 
                        ...prev, 
                        serviceId: val,
                        price: selectedService ? selectedService.price : prev.price
                      }));
                      setIsDirty(true);
                   }}
                   disabled={!canEdit('serviceId')}
                 >
                   <SelectTrigger><SelectValue placeholder="Pilih Layanan" /></SelectTrigger>
                   <SelectContent>
                     {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                   </SelectContent>
                 </Select>
               </div>

               <div className="space-y-2">
                 <RequiredLabel>Jenis Layanan</RequiredLabel>
                 <Select 
                   value={formData.serviceCategory} 
                   onValueChange={(val) => handleChange('serviceCategory', val)}
                   disabled={!canEdit('serviceCategory')}
                 >
                   <SelectTrigger><SelectValue placeholder="Pilih Jenis" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="Visit">Visit</SelectItem>
                     <SelectItem value="Home Service">Home Service</SelectItem>
                   </SelectContent>
                 </Select>
               </div>

               <div className="md:col-span-2 grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <Label>Tipe Mobil</Label>
                     <Popover open={openVehicle} onOpenChange={setOpenVehicle}>
                       <PopoverTrigger asChild>
                         <Button
                           type="button"
                           variant="outline"
                           role="combobox"
                           aria-expanded={openVehicle}
                           disabled={!canEdit('vehicleId')}
                           className="w-full justify-between bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-left font-normal"
                         >
                           {formData.vehicleId
                             ? vehicles.find((v) => v.id === formData.vehicleId)?.name
                             : "Pilih Mobil"}
                           <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                         </Button>
                       </PopoverTrigger>
                       <PopoverContent className="w-[300px] p-0 border-slate-200 dark:border-slate-800" align="start">
                         <Command>
                           <CommandInput placeholder="Cari mobil..." />
                           <CommandList>
                             <CommandEmpty>Mobil tidak ditemukan.</CommandEmpty>
                             <CommandGroup>
                               {vehicles.map((v) => (
                                 <CommandItem
                                   key={v.id}
                                   value={v.name}
                                   onSelect={(currentValue) => {
                                     handleChange('vehicleId', v.id);
                                     setOpenVehicle(false);
                                   }}
                                 >
                                   <Check
                                     className={cn(
                                       "mr-2 h-4 w-4",
                                       formData.vehicleId === v.id ? "opacity-100" : "opacity-0"
                                     )}
                                   />
                                   {v.name}
                                 </CommandItem>
                               ))}
                             </CommandGroup>
                           </CommandList>
                         </Command>
                       </PopoverContent>
                     </Popover>
                  </div>
                  <div className="space-y-2">
                     <Label>Jumlah Unit</Label>
                     <Select 
                        value={String(formData.units || 1)} 
                        onValueChange={(val) => handleChange('units', parseInt(val))}
                        disabled={!canEdit('units' as any)}
                     >
                        <SelectTrigger className="bg-white dark:bg-slate-800">
                           <SelectValue placeholder="1 Unit" />
                        </SelectTrigger>
                        <SelectContent>
                           {[1,2,3,4,5,6,7].map(num => (
                              <SelectItem key={num} value={String(num)}>{num} Unit</SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </div>
               </div>

               <div className="md:col-span-2 space-y-2">
                 <RequiredLabel>Harga</RequiredLabel>
                 <Input 
                    type="text"
                    value={formData.price ? formData.price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : ''} 
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                      handleChange('price', rawValue ? parseInt(rawValue) : 0);
                    }}
                    disabled={!canEdit('price')}
                    placeholder="Rp 0"
                    className="font-bold"
                 />
               </div>
              </div>
            </FormSection>

            <FormSection title="Operasional" description="Sumber order, PIC, cabang, teknisi, daerah, dan status layanan.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <RequiredLabel>Platform</RequiredLabel>
                  <Select 
                    value={formData.platformId} 
                    onValueChange={(val) => handleChange('platformId', val)}
                    disabled={!canEdit('platformId')}
                  >
                    <SelectTrigger><SelectValue placeholder="Pilih Platform" /></SelectTrigger>
                    <SelectContent>
                      {filteredPlatforms.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                {formData.platformId && filteredSubChannels.length > 0 && (
                  <div className="space-y-2">
                    <Label>Sub Channel</Label>
                    <Select 
                      value={formData.subChannelId} 
                      onValueChange={(val) => handleChange('subChannelId', val)}
                      disabled={!canEdit('platformId')} 
                    >
                      <SelectTrigger><SelectValue placeholder="Pilih Sub Channel" /></SelectTrigger>
                      <SelectContent>
                        {filteredSubChannels.map(sc => <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Advertiser</Label>
                  <Select 
                    value={formData.advertiserId} 
                    onValueChange={(val) => handleChange('advertiserId', val)}
                    disabled={!canEdit('advertiserId')}
                  >
                    <SelectTrigger><SelectValue placeholder="Pilih Advertiser" /></SelectTrigger>
                    <SelectContent>
                      {advertiserUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <RequiredLabel>Customer Service</RequiredLabel>
                  <Select 
                    value={formData.csId} 
                    onValueChange={(val) => handleChange('csId', val)}
                    disabled={!canEdit('csId')}
                  >
                    <SelectTrigger><SelectValue placeholder="Pilih CS" /></SelectTrigger>
                    <SelectContent>
                      {csUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Cabang</Label>
                  <Select 
                    value={formData.branchId} 
                    onValueChange={(val) => {
                      // Only reset dependent fields if branch actually changed
                      if (val !== formData.branchId) {
                          setFormData(prev => ({ ...prev, branchId: val, areaId: undefined, technicianId: undefined }));
                          setIsDirty(true);
                      }
                    }}
                    disabled={!canEdit('branchId')}
                  >
                    <SelectTrigger><SelectValue placeholder="Pilih Cabang" /></SelectTrigger>
                    <SelectContent>
                      {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Teknisi</Label>
                  <Select 
                    value={formData.technicianId} 
                    onValueChange={(val) => handleChange('technicianId', val)}
                    disabled={!canEdit('technicianId')}
                  >
                    <SelectTrigger><SelectValue placeholder="Pilih Teknisi" /></SelectTrigger>
                    <SelectContent>
                      {techUsers
                        .filter(u => !formData.branchId || u.branchId === formData.branchId)
                        .map(u => {
                        const schedule = getTechnicianDaySchedule(
                          u.id,
                          formData.serviceDate,
                          technicianSchedules,
                        );
                        const isOff = !!schedule;
                        return (
                          <SelectItem 
                            key={u.id} 
                            value={u.id}
                            disabled={isOff}
                            className={isOff ? "opacity-50 cursor-not-allowed" : ""}
                          >
                            {`${u.name} ${isOff ? `(Sedang ${schedule?.type || 'Libur'})` : ''}`}
                          </SelectItem>
                        );
                      })}
                      {techUsers.filter(u => !formData.branchId || u.branchId === formData.branchId).length === 0 && (
                        <div className="p-2 text-sm text-slate-500 text-center">Tidak ada teknisi di cabang ini</div>
                      )}
                    </SelectContent>
                  </Select>
                  {blockingScheduleMessage && (
                    <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3 animate-in slide-in-from-top-1">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                        <p className="text-sm font-medium leading-tight text-red-800">
                          {blockingScheduleMessage}
                        </p>
                      </div>
                    </div>
                  )}
                  {!blockingScheduleMessage && inactiveConflictWarning && (
                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-xs leading-relaxed text-amber-800">
                        {inactiveConflictWarning}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Daerah</Label>
                  <Select 
                    value={formData.areaId} 
                    onValueChange={(val) => handleChange('areaId', val)}
                    disabled={!canEdit('areaId')}
                  >
                    <SelectTrigger><SelectValue placeholder="Pilih Daerah" /></SelectTrigger>
                    <SelectContent>
                      {filteredAreas.length > 0 ? (
                        filteredAreas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)
                      ) : (
                        <div className="p-2 text-sm text-slate-500 text-center">Tidak ada daerah untuk cabang ini</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Status Service</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={handleStatusChange}
                    disabled={!canEdit('status')}
                  >
                    <SelectTrigger><SelectValue placeholder="Pilih Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Terjadwal</SelectItem>
                      <SelectItem value="otw">Otw Jalan</SelectItem>
                      <SelectItem value="working">Pengerjaan</SelectItem>
                      <SelectItem value="qc">Menunggu QC</SelectItem>
                      <SelectItem value="done" disabled={!canMarkOrderDone}>Selesai</SelectItem>
                      <SelectItem value="reschedule">Jadwal Ulang</SelectItem>
                      <SelectItem value="cancelled">Batal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <OrderStatusReasonFields
                  status={formData.status}
                  cancelReasons={cancelReasons || []}
                  value={formData.cancelReason}
                  note={formData.cancelReasonNote}
                  onReasonChange={(value) => {
                    handleChange('cancelReason', value);
                    if (value !== 'Lainnya') {
                      handleChange('cancelReasonNote', '');
                    }
                  }}
                  onNoteChange={(value) => handleChange('cancelReasonNote', value)}
                  className="col-span-1 animate-in slide-in-from-top-2 md:col-span-2"
                />

                <div className="col-span-1 md:col-span-2 space-y-2">
                   <Label>Catatan</Label>
                   <Textarea 
                      value={formData.notes || ''} 
                      onChange={(e) => handleChange('notes', e.target.value)}
                      disabled={!canEdit('notes')}
                      className="min-h-[80px]"
                   />
                </div>
              </div>
            </FormSection>

            <FormSection title="Pembayaran" description="Metode pembayaran, uang masuk, validasi, dan affiliate.">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Jenis Pembayaran</Label>
                    <Select 
                      value={formData.paymentType || 'Transfer'} 
                      onValueChange={(val) => {
                         handleChange('paymentType', val);
                         if (val === 'Cash') {
                            handleChange('paymentMethodId', undefined);
                         }
                      }}
                      disabled={!canEdit('paymentMethodId')}
                    >
                      <SelectTrigger><SelectValue placeholder="Pilih Jenis" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Transfer">Transfer</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(formData.paymentType === 'Transfer' || !formData.paymentType) && (
                  <div className="space-y-2">
                    <Label>Metode Pembayaran</Label>
                    <Select 
                      value={formData.paymentMethodId} 
                      onValueChange={(val) => handleChange('paymentMethodId', val)}
                      disabled={!canEdit('paymentMethodId')}
                    >
                      <SelectTrigger><SelectValue placeholder="Pilih Metode" /></SelectTrigger>
                      <SelectContent>
                        {payments.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.bankName} - {p.accountNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  )}

                  <div className="space-y-2">
                    <Label>Uang Masuk</Label>
                    <Input 
                      type="text"
                      value={formData.income ? formData.income.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : ''} 
                      onChange={(e) => {
                        const rawValue = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                        handleChange('income', rawValue ? parseInt(rawValue) : 0);
                      }}
                      disabled={!canEdit('income')}
                      placeholder="Rp"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Status Pembayaran</Label>
                    <Select 
                      value={formData.paymentStatus} 
                      onValueChange={(val) => handleChange('paymentStatus', val)}
                      disabled={!canEdit('paymentStatus')}
                    >
                      <SelectTrigger><SelectValue placeholder="Status Bayar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Unpaid">Unpaid</SelectItem>
                        <SelectItem value="Paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className={canEdit('paymentValidation') ? "text-blue-600 dark:text-blue-400 font-bold" : ""}>
                        Validasi Payment
                    </Label>
                    <Select 
                      value={formData.paymentValidation} 
                      onValueChange={(val) => handleChange('paymentValidation', val)}
                      disabled={!canEdit('paymentValidation')}
                    >
                      <SelectTrigger className={canEdit('paymentValidation') ? "border-blue-200 bg-blue-50/50" : ""}><SelectValue placeholder="Validasi" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Valid">Valid</SelectItem>
                        <SelectItem value="Invalid">Invalid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Affiliate</Label>
                    <Select 
                      value={formData.affiliateName || ''} 
                      onValueChange={(val) => handleChange('affiliateName', val)}
                      disabled={!canEdit('affiliateName')}
                    >
                      <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <SelectValue placeholder="Pilih Affiliate" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        {activeAffiliates.map((aff) => (
                          <SelectItem key={aff.id} value={aff.name} className="text-slate-900 dark:text-slate-100 focus:bg-slate-100 dark:focus:bg-slate-800 cursor-pointer">
                            {aff.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
               </div>
            </FormSection>
            
            {/* Added extra padding for mobile bottom nav usually covering content */}
            <div className="h-12 md:hidden"></div>
          </form>
        </div>

        <SheetFooter className="sticky bottom-0 z-10 shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:gap-0 md:p-6">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting} className="w-full sm:w-auto mt-2 sm:mt-0">Batal</Button>
          <Button type="submit" form="order-form" disabled={isSubmitting || !!blockingScheduleMessage} className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-w-[140px]">
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Simpan...</> : "Simpan Pesanan"}
          </Button>
        </SheetFooter>
      </SheetContent>

      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan Perubahan?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda memiliki perubahan yang belum disimpan. Data yang sudah diisi akan hilang jika Anda keluar sekarang.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Kembali</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => { 
                setShowCancelConfirm(false); 
                onClose(); 
              }} 
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Ya, Batalkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
};
