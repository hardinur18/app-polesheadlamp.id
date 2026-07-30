import React, { useEffect, useState, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, Clock, MapPin, Plus, Search, Filter, AlertCircle, CheckCircle2, User, LayoutList, LayoutGrid, Eye, Route, Copy } from 'lucide-react';
import { cn } from '../components/ui/StatusBadge';
import { useMasterData, type TechnicianSchedule } from './master-data/context';
import { Lead, Order, ProspectBooking } from './master-data/data';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useMediaQuery } from '../hooks/use-media-query';
import { logActivity } from '@/app/services/auditService';
import {
  isAdminManagementRole,
  isAdvertiserRole,
  isCsRole,
  isTechnicianRole,
} from '@/app/data/roleHelpers';
import { getCoordinatesFromUrl, expandShortUrl } from '@/utils/mapUtils';
import { copyToClipboard } from '@/lib/clipboard';
import { supabase } from '@/lib/supabaseClient';
import { ProspectBookingForm } from './leads/ProspectBookingForm';
import {
  buildActiveScheduleConflictMap,
  getScheduleConflictItemKey,
} from '@/app/services/orderScheduleValidation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addDays, differenceInCalendarDays, getDay, parseISO, isValid } from 'date-fns';
import { id } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { toast } from 'sonner';

// --- HELPER COMPONENTS ---

type ScheduleItem = {
  id: string;
  source: 'order' | 'booking';
  sourceId: string;
  orderId?: string;
  leadId?: string;
  customerName: string;
  customerPhone?: string;
  address?: string;
  serviceDate: string;
  serviceTime: string;
  serviceId?: string;
  serviceLabel: string;
  mapsUrl?: string;
  units: number;
  platformId?: string;
  subChannelId?: string;
  csId?: string;
  advertiserId?: string;
  technicianId?: string;
  branchId?: string;
  areaId?: string;
  status: Order['status'] | ProspectBooking['status'];
};

type AddProspectFormRequest = {
  source: 'schedule';
  scheduleDate?: string;
  scheduleTime?: string;
  technicianId?: string;
  technicianName?: string;
  branchId?: string;
  branchName?: string;
};

type ScheduleView = 'day' | 'week' | 'month' | 'list' | 'availability';
type AvailabilityPreset = 'today' | 'tomorrow' | 'next7' | 'next14';

const DEFAULT_OPERATING_SLOTS = ['08:00', '10:00', '12:00', '15:00', '17:00'] as const;
const OPTIONAL_OPERATING_SLOT = '19:00' as const;
const OPERATING_SLOTS = [...DEFAULT_OPERATING_SLOTS, OPTIONAL_OPERATING_SLOT] as const;
const INACTIVE_SCHEDULE_STATUSES = new Set<string>(['cancelled', 'reschedule']);
const AVAILABILITY_PRESET_OPTIONS: Array<{
  key: AvailabilityPreset;
  buttonLabel: string;
  periodLabel: string;
  startOffset: number;
  days: number;
}> = [
  { key: 'today', buttonLabel: 'Hari Ini', periodLabel: 'Hari Ini', startOffset: 0, days: 1 },
  { key: 'tomorrow', buttonLabel: 'Besok', periodLabel: 'Besok', startOffset: 1, days: 1 },
  { key: 'next7', buttonLabel: '7 Hari ke Depan', periodLabel: '7 Hari ke Depan', startOffset: 0, days: 7 },
  { key: 'next14', buttonLabel: '14 Hari ke Depan', periodLabel: '14 Hari ke Depan', startOffset: 0, days: 14 },
];

const toCalendarDate = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const createAvailabilityPresetRange = (
  presetKey: AvailabilityPreset,
  baseDate = new Date()
): DateRange => {
  const preset = AVAILABILITY_PRESET_OPTIONS.find((option) => option.key === presetKey) || AVAILABILITY_PRESET_OPTIONS[2];
  const from = toCalendarDate(addDays(baseDate, preset.startOffset));
  const to = toCalendarDate(addDays(from, preset.days - 1));

  return { from, to };
};

const normalizeAvailabilityRange = (
  range: DateRange | undefined,
  fallbackPreset: AvailabilityPreset,
  baseDate = new Date()
) => {
  const fallbackRange = createAvailabilityPresetRange(fallbackPreset, baseDate);
  const fallbackFrom = fallbackRange.from ? toCalendarDate(fallbackRange.from) : toCalendarDate(baseDate);
  const rawFrom = range?.from ? toCalendarDate(range.from) : range?.to ? toCalendarDate(range.to) : fallbackFrom;
  const rawTo = range?.to ? toCalendarDate(range.to) : range?.from ? toCalendarDate(range.from) : fallbackFrom;

  return rawFrom <= rawTo
    ? { from: rawFrom, to: rawTo }
    : { from: rawTo, to: rawFrom };
};

const matchAvailabilityPreset = (
  range: DateRange | undefined,
  baseDate = new Date()
): AvailabilityPreset | null => {
  if (!range?.from) return null;

  const normalized = normalizeAvailabilityRange(range, 'next7', baseDate);

  for (const preset of AVAILABILITY_PRESET_OPTIONS) {
    const presetRange = normalizeAvailabilityRange(createAvailabilityPresetRange(preset.key, baseDate), preset.key, baseDate);
    if (
      isSameDay(normalized.from, presetRange.from) &&
      isSameDay(normalized.to, presetRange.to)
    ) {
      return preset.key;
    }
  }

  return null;
};

const getOperationalSlotTime = (serviceTime?: string) => {
  if (!serviceTime) return null;

  const orderHour = parseInt(serviceTime.split(':')[0], 10);
  if (Number.isNaN(orderHour)) return null;

  if (orderHour < 10) return OPERATING_SLOTS[0];
  if (orderHour < 12) return OPERATING_SLOTS[1];
  if (orderHour < 15) return OPERATING_SLOTS[2];
  if (orderHour < 17) return OPERATING_SLOTS[3];
  if (orderHour < 19) return OPERATING_SLOTS[4];
  return OPERATING_SLOTS[5];
};

const isInactiveScheduleItem = (item: ScheduleItem) => INACTIVE_SCHEDULE_STATUSES.has(item.status);

const isShortMapsUrl = (value: string) =>
  value.includes('goo.gl') ||
  value.includes('maps.app.goo.gl') ||
  value.includes('bit.ly') ||
  value.includes('g.co');

const decodeMapsValue = (value: string) => decodeURIComponent(value.replace(/\+/g, ' ')).trim();

const extractMapsDirectionValue = (value?: string) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const coords = getCoordinatesFromUrl(trimmed);
  if (coords) {
    return `${coords.lat},${coords.lng}`;
  }

  try {
    const parsed = new URL(trimmed);

    for (const key of ['destination', 'daddr', 'origin', 'saddr', 'query', 'q', 'll']) {
      const rawValue = parsed.searchParams.get(key);
      if (rawValue) {
        return decodeMapsValue(rawValue);
      }
    }

    const placeMatch = parsed.pathname.match(/\/place\/([^/]+)/i);
    if (placeMatch?.[1]) {
      return decodeMapsValue(placeMatch[1]);
    }

    const searchMatch = parsed.pathname.match(/\/search\/([^/]+)/i);
    if (searchMatch?.[1]) {
      return decodeMapsValue(searchMatch[1]);
    }
  } catch {
    return trimmed;
  }

  return null;
};

const getScheduleStatusMeta = (item: ScheduleItem) => {
  if (item.source === 'booking') {
    switch (item.status) {
      case 'confirmed':
        return {
          label: 'Booking Confirmed',
          pillClass: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
          cardClass: 'bg-violet-50 border-violet-100 text-violet-950',
          dotClass: 'bg-violet-500',
          outlineClass: 'bg-violet-100/60 border-violet-200 text-violet-700',
          bucket: 'scheduled' as const,
        };
      case 'reschedule':
        return {
          label: 'Booking Ulang',
          pillClass: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
          cardClass: 'bg-amber-50 border-amber-100 text-amber-950',
          dotClass: 'bg-amber-500',
          outlineClass: 'bg-amber-100/60 border-amber-200 text-amber-700',
          bucket: 'scheduled' as const,
        };
      case 'cancelled':
        return {
          label: 'Booking Batal',
          pillClass: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
          cardClass: 'bg-slate-50 border-slate-200 text-slate-500',
          dotClass: 'bg-slate-400',
          outlineClass: 'bg-slate-100 border-slate-200 text-slate-600',
          bucket: 'cancelled' as const,
        };
      case 'tentative':
      default:
        return {
          label: 'Booking Prospek',
          pillClass: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
          cardClass: 'bg-violet-50 border-violet-100 text-violet-950',
          dotClass: 'bg-violet-500',
          outlineClass: 'bg-violet-100/60 border-violet-200 text-violet-700',
          bucket: 'pending' as const,
        };
    }
  }

  switch (item.status) {
    case 'done':
      return {
        label: 'Selesai',
        pillClass: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
        cardClass: 'bg-emerald-50 border-emerald-100 text-emerald-950',
        dotClass: 'bg-emerald-500',
        outlineClass: 'bg-emerald-100/50 border-emerald-200 text-emerald-700',
        bucket: 'done' as const,
      };
    case 'cancelled':
      return {
        label: 'Batal',
        pillClass: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
        cardClass: 'bg-slate-50 border-slate-200 text-slate-500',
        dotClass: 'bg-slate-400',
        outlineClass: 'bg-slate-100 border-slate-200 text-slate-600',
        bucket: 'cancelled' as const,
      };
    case 'reschedule':
      return {
        label: 'Jadwal Ulang',
        pillClass: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
        cardClass: 'bg-amber-50 border-amber-100 text-amber-950',
        dotClass: 'bg-amber-500',
        outlineClass: 'bg-amber-100/50 border-amber-200 text-amber-700',
        bucket: 'scheduled' as const,
      };
    case 'processing':
    case 'waiting':
    case 'otw':
    case 'working':
    case 'qc':
    case 'teknisi_completed':
      return {
        label: 'Diproses',
        pillClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
        cardClass: 'bg-indigo-50 border-indigo-100 text-indigo-950',
        dotClass: 'bg-indigo-500',
        outlineClass: 'bg-indigo-100/50 border-indigo-200 text-indigo-700',
        bucket: 'scheduled' as const,
      };
    case 'pending':
    default:
      return {
        label: 'Terjadwal',
        pillClass: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300',
        cardClass: 'bg-blue-50 border-blue-100 text-blue-950',
        dotClass: 'bg-blue-500',
        outlineClass: 'bg-blue-100/50 border-blue-200 text-blue-700',
        bucket: 'pending' as const,
      };
  }
};

export default function Schedule() {
  const {
    orders: rawOrders,
    prospectBookings: rawProspectBookings,
    leads,
    users,
    branches: allBranches,
    activeBranches: branches,
    services,
    technicianSchedules,
    addLead,
    deleteLead,
    addProspectBooking,
    currentUser,
    currentRole,
  } = useMasterData();
  const { hasPermission } = usePermissions();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const isAdminManagementUser = isAdminManagementRole(currentRole);
  const isAdvertiserUser = isAdvertiserRole(currentRole);
  const isCsUser = isCsRole(currentRole);

  // Filter orders for Advertiser
  const orders = useMemo(() => {
      if (isAdvertiserUser) {
          return rawOrders.filter(o => o.advertiserId === currentUser?.id);
      }
      return rawOrders;
  }, [currentUser, isAdvertiserUser, rawOrders]);

  const nonScheduleLeadIds = useMemo(() => {
    return new Set(
      leads
        .filter((lead) => lead.status === 'Cancel' || lead.status === 'Closing')
        .map((lead) => lead.id),
    );
  }, [leads]);

  const prospectBookings = useMemo(() => {
    const visibleBookings = rawProspectBookings.filter((booking) =>
      !booking.orderId &&
      !INACTIVE_SCHEDULE_STATUSES.has(booking.status) &&
      (!booking.leadId || !nonScheduleLeadIds.has(booking.leadId))
    );
    if (isAdvertiserUser) {
      return visibleBookings.filter((booking) => booking.advertiserId === currentUser?.id);
    }
    return visibleBookings;
  }, [currentUser, isAdvertiserUser, nonScheduleLeadIds, rawProspectBookings]);

  const [view, setView] = useState<ScheduleView>('month');
  const [listDateMode, setListDateMode] = useState<'all' | 'daily'>('all');
  const [currentDate, setCurrentDate] = useState(() => toCalendarDate(new Date()));
  const [todayDate, setTodayDate] = useState(() => toCalendarDate(new Date()));
  const [showLateOperatingSlot, setShowLateOperatingSlot] = useState(false);
  const [availabilityPreset, setAvailabilityPreset] = useState<AvailabilityPreset | null>('next7');
  const [availabilityDateRange, setAvailabilityDateRange] = useState<DateRange>(() => createAvailabilityPresetRange('next7', new Date()));
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [selectedCSId, setSelectedCSId] = useState<string>('all');
  const [selectedTechId, setSelectedTechId] = useState<string>('all');
  const [selectedAdvertiserId, setSelectedAdvertiserId] = useState<string>('all');
  const [showUnassigned, setShowUnassigned] = useState(false); // Default hidden, triggered by FAB
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [routeItem, setRouteItem] = useState<ScheduleItem | null>(null);
  const [destinationMapsUrl, setDestinationMapsUrl] = useState('');
  const [isOpeningRoute, setIsOpeningRoute] = useState(false);
  const [isAddProspectOpen, setIsAddProspectOpen] = useState(false);
  const [addProspectContext, setAddProspectContext] = useState<AddProspectFormRequest | null>(null);
  const [leadFormInstanceKey, setLeadFormInstanceKey] = useState(0);
  const canOpenAddProspectFromTimeline = hasPermission('leads.create');

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const nextToday = toCalendarDate(new Date());
      setTodayDate((prev) => (
        isSameDay(prev, nextToday) ? prev : nextToday
      ));
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const openAddProspectFromTimeline = (request: AddProspectFormRequest) => {
    if (!canOpenAddProspectFromTimeline) return;
    setAddProspectContext(request);
    setLeadFormInstanceKey((prev) => prev + 1);
    setIsAddProspectOpen(true);
  };

  const handleAddProspectSheetOpenChange = (open: boolean) => {
    setIsAddProspectOpen(open);
    if (!open) {
      setAddProspectContext(null);
    }
  };

  const addProspectContextSummary = useMemo(() => {
    if (!addProspectContext || addProspectContext.source !== 'schedule') return null;

    const parts = ['Slot timeline dipilih'];
    if (addProspectContext.scheduleDate) {
      parts.push(format(new Date(`${addProspectContext.scheduleDate}T00:00:00`), 'dd MMM yyyy'));
    }
    if (addProspectContext.scheduleTime) {
      parts.push(addProspectContext.scheduleTime);
    }
    if (addProspectContext.branchName) {
      parts.push(addProspectContext.branchName);
    }
    if (addProspectContext.technicianName) {
      parts.push(addProspectContext.technicianName);
    }

    return parts.join(' • ');
  }, [addProspectContext]);

  const bookingDraftLead = useMemo<Lead>(() => ({
    id: `TEMP-${leadFormInstanceKey}`,
    name: '',
    phone: '',
    status: 'Booking',
    timestamp: new Date().toISOString(),
    lastContact: 'Baru saja',
    csId: isCsUser ? currentUser?.id : undefined,
    advertiserId: isAdvertiserUser ? currentUser?.id : undefined,
  }), [currentUser, isAdvertiserUser, isCsUser, leadFormInstanceKey]);

  const initialBookingOverrides = useMemo<Partial<ProspectBooking> | undefined>(() => {
    if (!addProspectContext) return undefined;

    return {
      scheduleDate: addProspectContext.scheduleDate || format(currentDate, 'yyyy-MM-dd'),
      scheduleTime: addProspectContext.scheduleTime || '08:00',
      branchId: addProspectContext.branchId || '',
      technicianId: addProspectContext.technicianId,
      status: 'tentative',
      csId: isCsUser ? currentUser?.id : undefined,
      advertiserId: isAdvertiserUser ? currentUser?.id : undefined,
    };
  }, [addProspectContext, currentDate, currentUser, isAdvertiserUser, isCsUser]);

  const getScheduleBookingConflictMessage = (booking: ProspectBooking) => {
    if (!booking.scheduleDate || !booking.scheduleTime || !booking.branchId || !booking.technicianId) {
      return 'Slot booking belum lengkap. Silakan pilih slot jadwal yang valid.';
    }

    const slotTime = getOperationalSlotTime(booking.scheduleTime);
    if (!slotTime) {
      return 'Jam booking tidak sesuai slot operasional.';
    }

    if (!bookableOperatingSlotSet.has(slotTime)) {
      return `Slot ${slotTime} saat ini tidak aktif di pengaturan jadwal.`;
    }

    const technician = users.find((user) => user.id === booking.technicianId);
    const branch = branches.find((item) => item.id === booking.branchId);
    const bookingDate = parseISO(booking.scheduleDate);
    const bookingDateLabel = isValid(bookingDate)
      ? format(bookingDate, 'EEEE, d MMMM yyyy', { locale: id })
      : booking.scheduleDate;
    const technicianLabel = technician?.name || 'teknisi ini';
    const branchLabel = branch?.name || 'cabang terpilih';

    const offSchedule = technicianSchedules.find((schedule) =>
      schedule.userId === booking.technicianId &&
      schedule.date === booking.scheduleDate
    );

    if (offSchedule) {
      const reasonLabel = offSchedule.reason ? ` (${offSchedule.reason})` : '';
      return `${technicianLabel} sedang ${offSchedule.type.toLowerCase()}${reasonLabel} pada ${bookingDateLabel}.`;
    }

    const conflictingItem = scheduleItems.find((item) =>
      !isInactiveScheduleItem(item) &&
      item.serviceDate === booking.scheduleDate &&
      item.technicianId === booking.technicianId &&
      getOperationalSlotTime(item.serviceTime) === slotTime
    );

    if (!conflictingItem) {
      return null;
    }

    return `Slot ${slotTime} untuk ${technicianLabel} di ${branchLabel} pada ${bookingDateLabel} sudah terisi.`;
  };

  const validateScheduleBookingBeforeSubmit = async (booking: ProspectBooking) => {
    const localConflictMessage = getScheduleBookingConflictMessage(booking);
    if (localConflictMessage) {
      return localConflictMessage;
    }

    if (!booking.scheduleDate || !booking.scheduleTime || !booking.branchId || !booking.technicianId) {
      return 'Slot booking belum lengkap. Silakan pilih slot jadwal yang valid.';
    }

    const slotTime = getOperationalSlotTime(booking.scheduleTime);
    if (!slotTime) {
      return 'Jam booking tidak sesuai slot operasional.';
    }

    try {
      const [{ data: offSchedules, error: offError }, { data: bookingRows, error: bookingError }, { data: orderRows, error: orderError }] = await Promise.all([
        supabase
          .from('technician_schedules')
          .select('type, reason')
          .eq('user_id', booking.technicianId)
          .eq('date', booking.scheduleDate)
          .limit(1),
        supabase
          .from('prospect_bookings')
          .select('schedule_time, status, order_id, lead_id')
          .eq('technician_id', booking.technicianId)
          .eq('schedule_date', booking.scheduleDate),
        supabase
          .from('orders')
          .select('service_time, status')
          .eq('technician_id', booking.technicianId)
          .eq('service_date', booking.scheduleDate),
      ]);

      if (offError) throw offError;
      if (bookingError) throw bookingError;
      if (orderError) throw orderError;

      if (offSchedules && offSchedules.length > 0) {
        const offSchedule = offSchedules[0];
        const reasonLabel = offSchedule.reason ? ` (${offSchedule.reason})` : '';
        const technician = users.find((user) => user.id === booking.technicianId);
        return `${technician?.name || 'Teknisi ini'} sedang ${String(offSchedule.type).toLowerCase()}${reasonLabel} pada tanggal tersebut.`;
      }

      const bookingConflict = (bookingRows || []).some((row) =>
        !row.order_id &&
        !INACTIVE_SCHEDULE_STATUSES.has(row.status) &&
        (!row.lead_id || !nonScheduleLeadIds.has(row.lead_id)) &&
        getOperationalSlotTime(row.schedule_time) === slotTime
      );
      if (bookingConflict) {
        return `Slot ${slotTime} sudah terisi booking lain. Silakan pilih slot lain.`;
      }

      const orderConflict = (orderRows || []).some((row) =>
        !INACTIVE_SCHEDULE_STATUSES.has(row.status) && getOperationalSlotTime(row.service_time) === slotTime
      );
      if (orderConflict) {
        return `Slot ${slotTime} sudah terpakai order aktif. Silakan pilih slot lain.`;
      }

      return null;
    } catch (error) {
      console.error('Error validating booking slot before submit:', error);
      return 'Gagal memverifikasi slot terbaru. Coba simpan ulang beberapa detik lagi.';
    }
  };

  const handleSubmitBookingFromTimeline = async (booking: ProspectBooking) => {
    const generateShortId = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < 7; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    const newLead: Lead = {
      id: generateShortId(),
      name: booking.customerName.trim(),
      phone: booking.customerPhone.trim(),
      status: 'Booking',
      timestamp: new Date().toISOString(),
      lastContact: 'Baru saja',
      notes: booking.notes,
      csId: booking.csId || (isCsUser ? currentUser?.id : undefined),
      advertiserId: booking.advertiserId || (isAdvertiserUser ? currentUser?.id : undefined),
      vehicleId: booking.vehicleId,
      platformId: booking.platformId,
      subChannelId: booking.subChannelId,
    };

    const conflictMessage = await validateScheduleBookingBeforeSubmit(booking);
    if (conflictMessage) {
      toast.error(conflictMessage);
      return;
    }

    const newBooking: ProspectBooking = {
      ...booking,
      leadId: newLead.id,
      customerName: newLead.name,
      customerPhone: newLead.phone,
      csId: newLead.csId,
      advertiserId: newLead.advertiserId,
      status: 'tentative',
      createdAt: booking.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await addLead(newLead, { silent: true });
      await addProspectBooking(newBooking, { silent: true });
      toast.success("Booking prospek berhasil dibuat");
      if (currentUser) {
        const slotLabel = [addProspectContext?.scheduleDate, addProspectContext?.scheduleTime].filter(Boolean).join(' ');
        logActivity(
          { id: currentUser.id, name: currentUser.name, role: currentUser.role },
          'CREATE',
          'Booking Prospek',
          `Membuat booking prospek dari timeline: ${newLead.name}${slotLabel ? ` (${slotLabel})` : ''}`,
          newBooking.id,
          {
            source: 'schedule_timeline',
            leadId: newLead.id,
            branchId: newBooking.branchId,
            technicianId: newBooking.technicianId,
            scheduleDate: newBooking.scheduleDate,
            scheduleTime: newBooking.scheduleTime,
            bookingStatus: newBooking.status,
          }
        );
      }
      setIsAddProspectOpen(false);
      setAddProspectContext(null);
    } catch (err) {
      try {
        await deleteLead(newLead.id, { silent: true });
      } catch (cleanupError) {
        console.error("Failed to rollback prospect after booking error:", cleanupError);
      }
      console.error("Error submitting booking from timeline:", err);
      toast.error("Gagal membuat booking prospek");
    }
  };

  // --- DERIVED STATE ---

  // 1. Filter Technicians based on Branch
  const activeTechnicians = useMemo(() => {
    return users.filter(u => 
      isTechnicianRole(u.role) && 
      u.status === 'active' &&
      (selectedBranchId === 'all' || u.branchId === selectedBranchId)
    );
  }, [users, selectedBranchId]);

  const activeCS = useMemo(() => users.filter((u) => isCsRole(u.role) && u.status === 'active'), [users]);
  const activeAdvertisers = useMemo(() => users.filter((u) => isAdvertiserRole(u.role) && u.status === 'active'), [users]);
  const branchFilterOptions = branches;

  const resolveDirectionPoint = async (primary?: string, fallback?: string) => {
    const candidates = [primary?.trim(), fallback?.trim()].filter(Boolean) as string[];

    for (const candidate of candidates) {
      const expandedCandidate = candidate.startsWith('http') && isShortMapsUrl(candidate)
        ? await expandShortUrl(candidate)
        : candidate;

      const extractedValue = extractMapsDirectionValue(expandedCandidate);
      if (extractedValue) {
        return extractedValue;
      }
    }

    return null;
  };

  const openRouteDialog = (item: ScheduleItem) => {
    setRouteItem(item);
    setDestinationMapsUrl('');
  };

  const handleOpenGoogleRoute = async () => {
    if (!routeItem) return;
    if (!destinationMapsUrl.trim()) {
      toast.error('Isi link Maps tujuan dulu');
      return;
    }

    setIsOpeningRoute(true);

    try {
      const origin = await resolveDirectionPoint(routeItem.mapsUrl, routeItem.address);
      if (!origin) {
        toast.error('Lokasi asal card belum bisa dipakai untuk buka rute');
        return;
      }

      const destination = await resolveDirectionPoint(destinationMapsUrl);
      if (!destination) {
        toast.error('Link Maps tujuan belum bisa dibaca');
        return;
      }

      const directionUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
      window.open(directionUrl, '_blank', 'noopener,noreferrer');
      setRouteItem(null);
      setDestinationMapsUrl('');
    } finally {
      setIsOpeningRoute(false);
    }
  };

  const scheduleItems = useMemo<ScheduleItem[]>(() => {
    const orderItems: ScheduleItem[] = orders
      .filter((order) => !INACTIVE_SCHEDULE_STATUSES.has(order.status))
      .map((order) => ({
      id: `order-${order.id}`,
      source: 'order',
      sourceId: order.id,
      orderId: order.id,
      leadId: order.leadId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      address: order.address,
      serviceDate: order.serviceDate,
      serviceTime: order.serviceTime,
      serviceId: order.serviceId,
      serviceLabel: services.find((service) => service.id === order.serviceId)?.name || order.serviceCategory || 'Pesanan',
      mapsUrl: order.mapsUrl,
      units: order.units || 1,
      platformId: order.platformId,
      subChannelId: order.subChannelId,
      csId: order.csId,
      advertiserId: order.advertiserId,
      technicianId: order.technicianId,
      branchId: order.branchId,
      areaId: order.areaId,
      status: order.status,
    }));

    const bookingItems: ScheduleItem[] = prospectBookings
      .filter((booking) => !INACTIVE_SCHEDULE_STATUSES.has(booking.status))
      .map((booking) => ({
      id: `booking-${booking.id}`,
      source: 'booking',
      sourceId: booking.id,
      orderId: booking.orderId,
      leadId: booking.leadId,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      address: booking.address,
      serviceDate: booking.scheduleDate,
      serviceTime: booking.scheduleTime,
      serviceId: booking.serviceId,
      serviceLabel: services.find((service) => service.id === booking.serviceId)?.name || 'Booking Prospek',
      mapsUrl: booking.mapsUrl,
      units: 1,
      platformId: booking.platformId,
      subChannelId: booking.subChannelId,
      csId: booking.csId,
      advertiserId: booking.advertiserId,
      technicianId: booking.technicianId,
      branchId: booking.branchId,
      areaId: booking.areaId,
      status: booking.status,
    }));

    return [...orderItems, ...bookingItems];
  }, [orders, prospectBookings, services]);

  const scheduleConflictByItemKey = useMemo(
    () => buildActiveScheduleConflictMap(orders, prospectBookings),
    [orders, prospectBookings]
  );

  const availabilityPresetConfig = useMemo(
    () => availabilityPreset
      ? AVAILABILITY_PRESET_OPTIONS.find((option) => option.key === availabilityPreset) || null
      : null,
    [availabilityPreset]
  );

  const availabilityResolvedRange = useMemo(
    () => normalizeAvailabilityRange(availabilityDateRange, availabilityPreset || 'next7', todayDate),
    [availabilityDateRange, availabilityPreset, todayDate]
  );

  const availabilityStartDate = availabilityResolvedRange.from;
  const availabilityEndDate = availabilityResolvedRange.to;

  const availabilityRangeDays = useMemo(
    () => differenceInCalendarDays(availabilityEndDate, availabilityStartDate) + 1,
    [availabilityEndDate, availabilityStartDate]
  );

  const availabilityDates = useMemo(
    () => eachDayOfInterval({ start: availabilityStartDate, end: availabilityEndDate }),
    [availabilityStartDate, availabilityEndDate]
  );

  const availabilityRangeStartStr = useMemo(
    () => format(availabilityStartDate, 'yyyy-MM-dd'),
    [availabilityStartDate]
  );
  const availabilityRangeEndStr = useMemo(
    () => format(availabilityEndDate, 'yyyy-MM-dd'),
    [availabilityEndDate]
  );

  const hasLateOperatingSchedulesInScope = useMemo(() => {
    return scheduleItems.some((item) => {
      if (isInactiveScheduleItem(item)) return false;
      if (!item.serviceDate) return false;
      if (selectedBranchId !== 'all' && item.branchId !== selectedBranchId) return false;
      if (selectedCSId !== 'all' && item.csId !== selectedCSId) return false;
      if (selectedTechId !== 'all' && item.technicianId !== selectedTechId) return false;
      if (selectedAdvertiserId !== 'all' && item.advertiserId !== selectedAdvertiserId) return false;
      if (getOperationalSlotTime(item.serviceTime) !== OPTIONAL_OPERATING_SLOT) return false;

      const itemDate = parseISO(item.serviceDate);
      if (!isValid(itemDate)) return false;

      if (view === 'availability') {
        return item.serviceDate >= availabilityRangeStartStr && item.serviceDate <= availabilityRangeEndStr;
      }

      if (view === 'day' || (view === 'list' && listDateMode === 'daily')) {
        return isSameDay(itemDate, currentDate);
      }

      return isSameMonth(itemDate, currentDate);
    });
  }, [
    scheduleItems,
    selectedBranchId,
    selectedCSId,
    selectedTechId,
    selectedAdvertiserId,
    view,
    listDateMode,
    currentDate,
    availabilityRangeStartStr,
    availabilityRangeEndStr,
  ]);

  const bookableOperatingSlots = useMemo(
    () => (showLateOperatingSlot ? OPERATING_SLOTS : DEFAULT_OPERATING_SLOTS),
    [showLateOperatingSlot]
  );
  const bookableOperatingSlotSet = useMemo(
    () => new Set<string>(bookableOperatingSlots),
    [bookableOperatingSlots]
  );
  const shouldDisplayLateOperatingSlot = showLateOperatingSlot || hasLateOperatingSchedulesInScope;
  const displayOperatingSlots = useMemo(
    () => (shouldDisplayLateOperatingSlot ? OPERATING_SLOTS : DEFAULT_OPERATING_SLOTS),
    [shouldDisplayLateOperatingSlot]
  );
  const displayOperatingSlotSet = useMemo(
    () => new Set<string>(displayOperatingSlots),
    [displayOperatingSlots]
  );

  const getDisplayOperationalSlotTime = (serviceTime?: string) => {
    const slotTime = getOperationalSlotTime(serviceTime);
    return slotTime && displayOperatingSlotSet.has(slotTime) ? slotTime : null;
  };

  const availabilityBranches = useMemo(
    () => (selectedBranchId === 'all' ? branches : branches.filter((branch) => branch.id === selectedBranchId)),
    [branches, selectedBranchId]
  );

  const availabilitySlotItemsMap = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();

    scheduleItems.forEach((item) => {
      if (isInactiveScheduleItem(item)) return;
      if (!item.serviceDate || !item.branchId || !item.technicianId) return;
      if (item.serviceDate < availabilityRangeStartStr || item.serviceDate > availabilityRangeEndStr) return;
      if (selectedBranchId !== 'all' && item.branchId !== selectedBranchId) return;

      const slotTime = getDisplayOperationalSlotTime(item.serviceTime);
      if (!slotTime) return;

      const key = `${item.serviceDate}|${item.branchId}|${item.technicianId}|${slotTime}`;
      const currentItems = map.get(key) || [];
      currentItems.push(item);
      map.set(key, currentItems);
    });

    return map;
  }, [scheduleItems, availabilityRangeStartStr, availabilityRangeEndStr, selectedBranchId, displayOperatingSlotSet]);

  const availabilityOffMap = useMemo(() => {
    const map = new Map<string, TechnicianSchedule>();

    technicianSchedules.forEach((schedule) => {
      if (schedule.date < availabilityRangeStartStr || schedule.date > availabilityRangeEndStr) return;
      map.set(`${schedule.date}|${schedule.userId}`, schedule);
    });

    return map;
  }, [technicianSchedules, availabilityRangeStartStr, availabilityRangeEndStr]);

  const availabilityCards = useMemo(() => {
    return availabilityDates.map((date) => {
      const dateStr = format(date, 'yyyy-MM-dd');

      const branchSections = availabilityBranches.map((branch) => {
        const branchTechnicians = activeTechnicians.filter((tech) => tech.branchId === branch.id);

        const technicians = branchTechnicians.map((tech) => {
          const offSchedule = availabilityOffMap.get(`${dateStr}|${tech.id}`);

          const slots = displayOperatingSlots.map((slotTime) => {
            if (offSchedule) {
              return {
                slotTime,
                state: 'off' as const,
                items: [] as ScheduleItem[],
              };
            }

            const items = availabilitySlotItemsMap.get(`${dateStr}|${branch.id}|${tech.id}|${slotTime}`) || [];
            const state = items.length === 0
              ? (bookableOperatingSlotSet.has(slotTime) ? 'empty' as const : 'inactive' as const)
              : items.some((item) => item.source === 'order')
                ? 'order' as const
                : 'booking' as const;

            return { slotTime, state, items };
          });

          return {
            tech,
            offSchedule,
            slots,
            emptyCount: slots.filter((slot) => slot.state === 'empty').length,
            occupiedCount: slots.filter((slot) => slot.state === 'order' || slot.state === 'booking').length,
            offCount: slots.filter((slot) => slot.state === 'off').length,
          };
        });

        return {
          branch,
          technicians,
          emptyCount: technicians.reduce((total, technician) => total + technician.emptyCount, 0),
          occupiedCount: technicians.reduce((total, technician) => total + technician.occupiedCount, 0),
          offCount: technicians.reduce((total, technician) => total + technician.offCount, 0),
        };
      });

      return {
        date,
        dateStr,
        branches: branchSections,
        emptyCount: branchSections.reduce((total, branch) => total + branch.emptyCount, 0),
        occupiedCount: branchSections.reduce((total, branch) => total + branch.occupiedCount, 0),
        offCount: branchSections.reduce((total, branch) => total + branch.offCount, 0),
      };
    });
  }, [availabilityDates, availabilityBranches, activeTechnicians, availabilityOffMap, availabilitySlotItemsMap, displayOperatingSlots, bookableOperatingSlotSet]);

  const availabilitySummary = useMemo(() => {
    return {
      totalDates: availabilityCards.length,
      totalTechnicians: activeTechnicians.filter((tech) =>
        selectedBranchId === 'all' ? true : tech.branchId === selectedBranchId
      ).length,
      totalEmptySlots: availabilityCards.reduce((total, day) => total + day.emptyCount, 0),
      totalOccupiedSlots: availabilityCards.reduce((total, day) => total + day.occupiedCount, 0),
      totalOffSlots: availabilityCards.reduce((total, day) => total + day.offCount, 0),
    };
  }, [availabilityCards, activeTechnicians, selectedBranchId]);

  const branchAvailabilityLabel = selectedBranchId === 'all'
    ? 'semua cabang'
    : availabilityBranches[0]?.name || 'cabang terpilih';

  const availabilityRangeDisplayLabel = useMemo(
    () => `${format(availabilityStartDate, 'd MMM yyyy', { locale: id })} - ${format(availabilityEndDate, 'd MMM yyyy', { locale: id })}`,
    [availabilityEndDate, availabilityStartDate]
  );
  const availabilityPeriodLabel = useMemo(() => {
    if (availabilityPresetConfig) return availabilityPresetConfig.periodLabel;
    if (availabilityRangeDays === 1) {
      return format(availabilityStartDate, 'd MMM yyyy', { locale: id });
    }
    return availabilityRangeDisplayLabel;
  }, [availabilityPresetConfig, availabilityRangeDays, availabilityRangeDisplayLabel, availabilityStartDate]);

  const availabilityHeaderInfoLabel = useMemo(() => {
    const branchLabel = selectedBranchId === 'all'
      ? 'Semua Cabang'
      : branches.find((branch) => branch.id === selectedBranchId)?.name || 'Cabang Terpilih';

    return `Slot kosong ${availabilityPeriodLabel.toLowerCase()} - ${branchLabel}`;
  }, [availabilityPeriodLabel, branches, selectedBranchId]);

  const availabilityCopyText = useMemo(() => {
    const lines = [
      `Jadwal kosong ${branchAvailabilityLabel}`,
      availabilityRangeDays === 1
        ? `Tanggal: ${format(availabilityStartDate, 'EEEE, d MMMM yyyy', { locale: id })}`
        : `Periode: ${format(availabilityStartDate, 'EEEE, d MMMM yyyy', { locale: id })} - ${format(availabilityEndDate, 'EEEE, d MMMM yyyy', { locale: id })}`,
      '',
    ];

    let hasEmptySlot = false;

    availabilityCards.forEach((day) => {
      const dayLines: string[] = [];

      day.branches.forEach((branch) => {
        const technicianLines = branch.technicians
          .map((technician, technicianIndex) => {
            const emptySlots = technician.slots
              .filter((slot) => slot.state === 'empty')
              .map((slot) => slot.slotTime);

            if (emptySlots.length === 0) return null;

            return `- Tim ${technicianIndex + 1}: ${emptySlots.join(', ')}`;
          })
          .filter((value): value is string => Boolean(value));

        if (technicianLines.length === 0) return;

        hasEmptySlot = true;

        if (selectedBranchId === 'all') {
          dayLines.push(branch.branch.name);
        }

        dayLines.push(...technicianLines);
      });

      if (dayLines.length === 0) return;

      lines.push(format(day.date, 'EEEE, d MMMM yyyy', { locale: id }));
      lines.push(...dayLines);
      lines.push('');
    });

    if (!hasEmptySlot) {
      return [
        `Belum ada slot kosong untuk ${branchAvailabilityLabel}.`,
        availabilityRangeDays === 1
          ? `Tanggal: ${format(availabilityStartDate, 'EEEE, d MMMM yyyy', { locale: id })}`
          : `Periode: ${format(availabilityStartDate, 'EEEE, d MMMM yyyy', { locale: id })} - ${format(availabilityEndDate, 'EEEE, d MMMM yyyy', { locale: id })}`,
      ].join('\n');
    }

    lines.push('Slot bisa berubah sewaktu-waktu sesuai booking yang masuk.');

    return lines.join('\n');
  }, [
    availabilityCards,
    availabilityRangeDays,
    availabilityEndDate,
    availabilityStartDate,
    branchAvailabilityLabel,
    selectedBranchId,
  ]);

  const hasCopyableAvailability = availabilityCards.some((day) =>
    day.branches.some((branch) =>
      branch.technicians.some((technician) => technician.slots.some((slot) => slot.state === 'empty'))
    )
  );

  const handleCopyAvailability = async () => {
    if (!hasCopyableAvailability) {
      toast.error('Tidak ada slot kosong untuk disalin');
      return;
    }

    await copyToClipboard(availabilityCopyText, {
      successMessage: 'Template slot kosong berhasil disalin',
      description: `${branchAvailabilityLabel} - ${availabilityPeriodLabel}`,
    });
  };

  // 2. Filter schedule items for current view
  const viewScheduleItems = useMemo(() => {
    return scheduleItems.filter((item) =>
      (selectedBranchId === 'all' || item.branchId === selectedBranchId) &&
      (selectedCSId === 'all' || item.csId === selectedCSId) &&
      (selectedTechId === 'all' || item.technicianId === selectedTechId) &&
      (selectedAdvertiserId === 'all' || item.advertiserId === selectedAdvertiserId)
    );
  }, [scheduleItems, selectedBranchId, selectedCSId, selectedTechId, selectedAdvertiserId]);

  // --- FILTER OPTIONS (Dynamic based on data for current Month) ---
  const { csOptions, techOptions, advertiserOptions, branchOptions } = useMemo(() => {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);

      const monthScheduleItems = scheduleItems.filter(item => {
          if (!item.serviceDate) return false;
          const orderDate = parseISO(item.serviceDate);
          return isValid(orderDate) && orderDate >= start && orderDate <= end;
      });

      const csIds = new Set<string>();
      const techIds = new Set<string>();
      const advertiserIds = new Set<string>();
      const branchIds = new Set<string>();

      monthScheduleItems.forEach(item => {
          if (item.csId) csIds.add(item.csId);
          if (item.technicianId) techIds.add(item.technicianId);
          if (item.advertiserId) advertiserIds.add(item.advertiserId);
          if (item.branchId) branchIds.add(item.branchId);
      });

      // Filter master lists to only include those present in THIS MONTH'S orders
      const filteredCS = activeCS.filter(u => csIds.has(u.id));
      
      // For technicians, we respect the selected Branch filter + data presence in month
      const filteredTechs = users.filter(u => 
          isTechnicianRole(u.role) && 
          u.status === 'active' &&
          techIds.has(u.id) &&
          (selectedBranchId === 'all' || u.branchId === selectedBranchId)
      );

      const filteredAdvertisers = activeAdvertisers.filter(u => advertiserIds.has(u.id));
      const filteredBranches = allBranches.filter(b => branchIds.has(b.id));

      return {
          csOptions: filteredCS,
          techOptions: filteredTechs,
          advertiserOptions: filteredAdvertisers,
          branchOptions: filteredBranches
      };
  }, [scheduleItems, activeCS, activeAdvertisers, activeTechnicians, users, allBranches, selectedBranchId, currentDate]);

  // 3. Calculate Daily Capacity Logic
  const getBranchDayCapacity = (date: Date, branchId: string) => {
    // Techs working on this specific branch
    const branchTechs = users.filter(u => 
        isTechnicianRole(u.role) && 
        u.status === 'active' &&
        u.branchId === branchId
    );
    
    // Filter available techs (not OFF)
    const dateStr = format(date, 'yyyy-MM-dd');
    const availableTechs = branchTechs.filter(t => {
        const schedule = technicianSchedules.find(s => s.userId === t.id && s.date === dateStr);
        // If type is present, they are OFF/sick/leave
        return !schedule;
    });

    const dailyCapacity = availableTechs.length * bookableOperatingSlots.length; 

    // Orders on this specific date AND branch
    const ordersOnDate = viewScheduleItems.filter(item => {
        if (!item.serviceDate) return false;
        if (item.branchId !== branchId) return false;
        const orderDate = parseISO(item.serviceDate);
        return isValid(orderDate) && isSameDay(orderDate, date);
    });

    const activeOrdersOnDate = ordersOnDate.filter(item => !isInactiveScheduleItem(item) && Boolean(getDisplayOperationalSlotTime(item.serviceTime)));

    return {
        used: activeOrdersOnDate.length,
        total: dailyCapacity,
        percentage: dailyCapacity > 0 ? (activeOrdersOnDate.length / dailyCapacity) * 100 : 0,
        orders: ordersOnDate.filter(item => Boolean(getDisplayOperationalSlotTime(item.serviceTime)))
    };
  };

  // 4. Calculate Monthly Stats
  const monthlyStats = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start, end });
    
    // Calculate REAL capacity based on technician availability per day
    const totalCapacity = daysInMonth.reduce((acc, day) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        
        // Count available techs for this day (from the active/filtered list)
        const availableCount = activeTechnicians.filter(t => {
            const isOff = technicianSchedules.some(s => s.userId === t.id && s.date === dateStr);
            return !isOff;
        }).length;
        
        return acc + (availableCount * bookableOperatingSlots.length);
    }, 0);

    // Monthly orders (excluding cancelled for occupancy rate)
    const monthlyActiveOrders = viewScheduleItems.filter(item => {
        if (!item.serviceDate || isInactiveScheduleItem(item)) return false;
        if (!getDisplayOperationalSlotTime(item.serviceTime)) return false;
        const d = parseISO(item.serviceDate);
        return isValid(d) && isSameMonth(d, currentDate);
    });

    const totalOrders = monthlyActiveOrders.length;
    const occupancyRate = totalCapacity > 0 ? (totalOrders / totalCapacity) * 100 : 0;

    return { totalOrders, totalCapacity, occupancyRate };
  }, [currentDate, activeTechnicians, viewScheduleItems, technicianSchedules, bookableOperatingSlots, displayOperatingSlotSet, showLateOperatingSlot]);

  // 5. Calculate Daily Stats (for List Daily View)
  const dailyStats = useMemo(() => {
    // Determine branches to include (all or selected)
    const activeBranchIds = selectedBranchId === 'all' 
        ? branches.map(b => b.id) 
        : [selectedBranchId];
    
    let totalUsed = 0;
    let totalCapacity = 0;

    activeBranchIds.forEach(branchId => {
        // Reuse logic logic by manually calling it (since it's defined in scope but not memoized, it's cheap)
        // We replicate the logic here to avoid dependency issues if getBranchDayCapacity changes signature
        
        // 1. Capacity
        const branchTechs = users.filter(u => 
            isTechnicianRole(u.role) && 
            u.status === 'active' &&
            u.branchId === branchId
        );
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const availableTechs = branchTechs.filter(t => {
            const schedule = technicianSchedules.find(s => s.userId === t.id && s.date === dateStr);
            return !schedule;
        });
        const cap = availableTechs.length * bookableOperatingSlots.length;

        // 2. Used (Active Orders)
        const ordersOnDate = viewScheduleItems.filter(item => {
            if (!item.serviceDate) return false;
            if (item.branchId !== branchId) return false;
            const orderDate = parseISO(item.serviceDate);
            return isValid(orderDate) && isSameDay(orderDate, currentDate);
        });
        const activeOrders = ordersOnDate.filter(item => !isInactiveScheduleItem(item) && Boolean(getDisplayOperationalSlotTime(item.serviceTime)));

        totalUsed += activeOrders.length;
        totalCapacity += cap;
    });

    return {
        totalOrders: totalUsed,
        totalCapacity,
        occupancyRate: totalCapacity > 0 ? (totalUsed / totalCapacity) * 100 : 0
    };
  }, [currentDate, selectedBranchId, branches, users, technicianSchedules, viewScheduleItems, bookableOperatingSlots, displayOperatingSlotSet, showLateOperatingSlot]);

  // --- HANDLERS ---
  const isAvailabilityView = view === 'availability';
  const canOpenInteractiveSchedule = !isAdvertiserUser;
  const canShowAvailabilityView = !isAdvertiserUser;
  const canShowCsFilter = view !== 'availability' && isAdminManagementUser;
  const canShowTechFilter = view !== 'availability' && (isAdminManagementUser || isCsUser);
  const canShowAdvertiserFilter = view !== 'availability' && isAdminManagementUser;
  const canShowMobileFilterToggle = view !== 'availability' && isAdminManagementUser;
  const isMonthScopedView = view === 'month' || (view === 'list' && listDateMode === 'all');
  const availabilityDesktopLabel = availabilityRangeDisplayLabel;
  const availabilityMobileLabel = `${format(availabilityStartDate, 'd MMM', { locale: id })} - ${format(availabilityEndDate, 'd MMM', { locale: id })}`;
  const desktopDateLabel = view === 'availability'
    ? availabilityDesktopLabel
    : format(
        currentDate,
        isMonthScopedView ? 'MMMM yyyy' : 'EEEE, d MMMM yyyy',
        { locale: id }
      );
  const mobileDateLabel = view === 'availability'
    ? availabilityMobileLabel
    : format(currentDate, isMonthScopedView ? 'MMMM' : 'd MMM', { locale: id });
  const datePickerTitle = isMonthScopedView
    ? 'Pilih bulan jadwal'
    : 'Pilih tanggal jadwal';
  const datePickerDescription = isMonthScopedView
    ? 'Pilih salah satu hari untuk pindah ke bulan tersebut.'
    : 'Pilih tanggal untuk melihat timeline atau jadwal harian.';

  const handleOpenAvailabilityView = () => {
    setView('availability');
  };

  const handleSelectAvailabilityPreset = (presetKey: AvailabilityPreset) => {
    const nextRange = createAvailabilityPresetRange(presetKey, todayDate);
    setAvailabilityPreset(presetKey);
    setAvailabilityDateRange(nextRange);
  };

  const handleSelectAvailabilityCalendar = (range?: DateRange) => {
    if (!range?.from && !range?.to) return;

    setAvailabilityDateRange(range);
    setAvailabilityPreset(matchAvailabilityPreset(range, todayDate));
  };

  const handleSelectCalendarDate = (date?: Date) => {
    if (!date) return;
    setCurrentDate(toCalendarDate(date));
    setIsDatePickerOpen(false);
  };

  const handlePrev = () => {
    if (isAvailabilityView) return;
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (view === 'list' && listDateMode === 'all') setCurrentDate(subMonths(currentDate, 1));
    else setCurrentDate(addDays(currentDate, -1));
  };

  const handleNext = () => {
    if (isAvailabilityView) return;
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (view === 'list' && listDateMode === 'all') setCurrentDate(addMonths(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  // --- RENDERERS ---

  const renderMobileStats = () => (
    <div className="grid grid-cols-3 gap-2 mb-2">
        {/* Total Jadwal */}
        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-1.5 mb-1">
                <div className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 dark:text-blue-400">
                    <CheckCircle2 className="w-3 h-3" />
                </div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Jadwal</p>
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{monthlyStats.totalOrders}</h3>
        </div>

        {/* Capacity */}
        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] flex flex-col items-center justify-center text-center">
             <div className="flex items-center gap-1.5 mb-1">
                <div className="w-5 h-5 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                    <User className="w-3 h-3" />
                </div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Kapst</p>
            </div>
            <div className="flex items-baseline gap-0.5">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{monthlyStats.totalCapacity}</h3>
                <span className="text-[10px] font-medium text-slate-400">Slot</span>
            </div>
        </div>

        {/* Occupancy */}
        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-1.5 mb-1">
                 <div className="w-5 h-5 relative flex items-center justify-center">
                     <svg className="w-full h-full transform -rotate-90">
                         <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2.5" fill="transparent" className="text-slate-100 dark:text-slate-800" />
                         <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2.5" fill="transparent" 
                             strokeDasharray={50.26} 
                             strokeDashoffset={50.26 - (50.26 * monthlyStats.occupancyRate) / 100}
                             className={cn("transition-all duration-1000", 
                                 monthlyStats.occupancyRate >= 90 ? "text-red-500" : 
                                 monthlyStats.occupancyRate >= 70 ? "text-amber-500" : "text-emerald-500"
                             )} 
                             strokeLinecap="round"
                         />
                     </svg>
                </div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Terisi</p>
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{Math.round(monthlyStats.occupancyRate)}%</h3>
        </div>
    </div>
  );

  const renderListView = () => {
    const monthlyItems = viewScheduleItems.filter(item => {
        if (!item.serviceDate) return false;
        const d = parseISO(item.serviceDate);
        if (listDateMode === 'daily') {
             return isValid(d) && isSameDay(d, currentDate);
        }
        return isValid(d) && isSameMonth(d, currentDate);
    }).sort((left, right) => {
        const leftValue = new Date(`${left.serviceDate}T${left.serviceTime || '00:00'}`).getTime();
        const rightValue = new Date(`${right.serviceDate}T${right.serviceTime || '00:00'}`).getTime();
        return leftValue - rightValue;
    });

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col flex-1 min-h-0">
             
             {/* Desktop List View */}
             <div className="hidden md:block overflow-y-auto flex-1 no-scrollbar">
                <Table>
                    <TableHeader className="bg-transparent">
                        <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                            <TableHead className="w-[100px] text-xs font-bold text-slate-400 uppercase tracking-wider pl-6">Tanggal</TableHead>
                            <TableHead className="w-[70px] text-xs font-bold text-slate-400 uppercase tracking-wider">Jam</TableHead>
                            <TableHead className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pelanggan</TableHead>
                            <TableHead className="text-xs font-bold text-slate-400 uppercase tracking-wider">Alamat</TableHead>
                            <TableHead className="text-xs font-bold text-slate-400 uppercase tracking-wider w-[120px]">Layanan</TableHead>
                            <TableHead className="text-xs font-bold text-slate-400 uppercase tracking-wider w-[50px] text-center">Unit</TableHead>
                            <TableHead className="text-xs font-bold text-slate-400 uppercase tracking-wider">CS</TableHead>
                            <TableHead className="text-xs font-bold text-slate-400 uppercase tracking-wider">Teknisi</TableHead>
                            <TableHead className="w-[120px] text-xs font-bold text-slate-400 uppercase tracking-wider pr-6 text-right">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {monthlyItems.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-32 text-center text-slate-400 italic">
                                    Tidak ada jadwal pada periode ini.
                                </TableCell>
                            </TableRow>
                        ) : (
                            monthlyItems.map((item) => {
                                const branch = branches.find(b => b.id === item.branchId);
                                const tech = users.find(u => u.id === item.technicianId);
                                const cs = users.find(u => u.id === item.csId);
                                const date = parseISO(item.serviceDate);
                                const statusMeta = getScheduleStatusMeta(item);
                                const scheduleConflictInfo = scheduleConflictByItemKey.get(
                                  getScheduleConflictItemKey(item.source, item.sourceId)
                                );
                                return (
                                    <TableRow key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800 h-20">
                                        <TableCell className="pl-6 align-middle">
                                            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm whitespace-nowrap">
                                                {format(date, 'd MMM', { locale: id })}
                                            </span>
                                        </TableCell>
                                        <TableCell className="align-middle">
                                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                                {item.serviceTime || "00:00"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="align-middle">
                                            <div className="flex flex-col gap-0.5 max-w-[150px]">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate" title={item.customerName}>{item.customerName}</span>
                                                    {item.source === 'booking' && (
                                                        <Badge variant="outline" className="border-violet-200 bg-violet-50 text-[10px] text-violet-700">
                                                            Booking
                                                        </Badge>
                                                    )}
                                                </div>
                                                {scheduleConflictInfo && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 dark:text-red-400">
                                                        <AlertCircle className="h-3 w-3" />
                                                        Bentrok jadwal
                                                    </span>
                                                )}
                                                <span className="text-xs text-slate-400 font-medium">{item.customerPhone}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="align-middle">
                                            <div className="flex items-start gap-1.5 max-w-[200px]">
                                                {item.mapsUrl ? (
                                                   <a 
                                                     href={item.mapsUrl} 
                                                     target="_blank" 
                                                     rel="noreferrer"
                                                     className="shrink-0 text-blue-500 hover:text-blue-600 mt-0.5"
                                                     title="Buka Maps"
                                                   >
                                                      <MapPin className="w-4 h-4" />
                                                   </a>
                                                ) : (
                                                    <MapPin className="w-4 h-4 shrink-0 text-slate-300 mt-0.5" />
                                                )}
                                                <span className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-tight" title={item.address}>
                                                    {item.address || '-'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="align-middle">
                                            <div className="flex flex-col gap-0.5">
                                               <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate" title={item.serviceLabel}>
                                                  {item.serviceLabel}
                                                  <span className="text-xs text-slate-500 font-normal ml-1">({item.units || 1} Unit)</span>
                                               </span>
                                               <span className="text-[10px] text-slate-400">{branch?.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="align-middle text-center">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                {item.units || 1}
                                            </span>
                                        </TableCell>
                                        <TableCell className="align-middle">
                                            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                                                {cs?.name || '-'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="align-middle">
                                            <div className="flex items-center gap-2">
                                                {tech ? (
                                                    <div className="flex items-center gap-2" title={tech.name}>
                                                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-600">
                                                            {tech.avatar ? <img src={tech.avatar} alt={tech.name} className="w-full h-full object-cover" /> : tech.name.substring(0,2).toUpperCase()}
                                                        </div>
                                                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate max-w-[80px]">
                                                            {tech.name.split(' ')[0]}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">Unassigned</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="align-middle pr-6 text-right">
                                            <span className={cn("inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold", statusMeta.pillClass)}>
                                                {statusMeta.label}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile Card View (Enhanced) */}
            <div className="md:hidden flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900">
                {/* renderMobileStats moved to main layout */}
                {listDateMode === 'daily' && (
                     <div className="flex justify-between items-center mb-2 px-1">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            Jadwal {format(currentDate, 'd MMMM yyyy', {locale: id})}
                        </span>
                     </div>
                )}
                {monthlyItems.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 italic">
                        Tidak ada jadwal pada periode ini.
                    </div>
                ) : (
                    monthlyItems.map((item) => {
                        const tech = users.find(u => u.id === item.technicianId);
                        const cs = users.find(u => u.id === item.csId);
                        const date = parseISO(item.serviceDate);
                        const statusMeta = getScheduleStatusMeta(item);
                        const order = item;
                        const scheduleConflictInfo = scheduleConflictByItemKey.get(
                          getScheduleConflictItemKey(item.source, item.sourceId)
                        );
                        
                        return (
                            <div key={item.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm relative overflow-hidden">
                                {/* Top Row: Date, Time, Status */}
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-0 text-[10px] h-6">
                                            {format(date, 'd MMM', { locale: id })} • {order.serviceTime}
                                        </Badge>
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                              "border-0 text-[10px] h-6",
                                              item.source === 'booking'
                                                ? "bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300"
                                                : "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300"
                                            )}
                                        >
                                            {item.source === 'booking' ? 'Booking' : `${item.units || 1} Unit`}
                                        </Badge>
                                    </div>
                                    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", statusMeta.pillClass)}>
                                        {statusMeta.label}
                                    </span>
                                </div>
                                {scheduleConflictInfo && (
                                    <div className="mb-3 inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 dark:text-red-400">
                                        <AlertCircle className="h-3 w-3" />
                                        Bentrok jadwal
                                    </div>
                                )}
                                
                                {/* Customer Info */}
                                <div className="mb-3">
                                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{item.customerName}</h3>
                                    <p className="text-xs text-slate-500 mb-1">
                                        {item.serviceLabel}
                                        <span className="ml-1">({item.units || 1} Unit)</span>
                                    </p>
                                    
                                    {/* Address & Pin */}
                                    <div className="flex items-start gap-1.5 mt-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg">
                                        {item.mapsUrl ? (
                                            <a href={item.mapsUrl} target="_blank" rel="noreferrer" className="text-blue-500 mt-0.5">
                                                <MapPin className="w-3.5 h-3.5" />
                                            </a>
                                        ) : (
                                            <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                                        )}
                                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
                                            {item.address || 'Alamat tidak tersedia'}
                                        </p>
                                    </div>
                                </div>
                                
                                {/* Footer: CS & Tech */}
                                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Teknisi</span>
                                        <div className="flex items-center gap-1.5">
                                            {tech ? (
                                                <>
                                                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600">
                                                        {tech.name.substring(0,1)}
                                                    </div>
                                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{tech.name}</span>
                                                </>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">-</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1 text-right">
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">CS</span>
                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{cs?.name || '-'}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

             <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-500 flex justify-between items-center">
                <span>Menampilkan {monthlyItems.length} jadwal bulan {format(currentDate, 'MMMM yyyy', { locale: id })}</span>
            </div>
        </div>
    );
  };

  const renderDailyView = () => {
    const dateStr = format(currentDate, 'yyyy-MM-dd');

    const dayItems = viewScheduleItems.filter(item => {
        if (!item.serviceDate) return false;
        return isSameDay(parseISO(item.serviceDate), currentDate);
    });

    // Calculate Daily Capacity Stats (Exclude cancelled)
    // Filter out OFF technicians first
    const availableTechs = activeTechnicians.filter(t => {
        return !technicianSchedules.find(s => s.userId === t.id && s.date === dateStr);
    });

    const totalCapacity = availableTechs.length * bookableOperatingSlots.length; 
    const totalUsed = dayItems.filter(item => !isInactiveScheduleItem(item) && Boolean(getDisplayOperationalSlotTime(item.serviceTime))).length;
    const capacityPercentage = totalCapacity > 0 ? (totalUsed / totalCapacity) * 100 : 0;
    const unassignedItems = dayItems.filter(item => !item.technicianId && !isInactiveScheduleItem(item) && Boolean(getDisplayOperationalSlotTime(item.serviceTime)));

    return (
        <div className="flex flex-col flex-1 h-full min-h-0 relative bg-slate-50 dark:bg-slate-950 overflow-hidden">
            
            {/* 1. MAIN SCHEDULER AREA (Full width, scrollable) */}
            <div className="flex-1 w-full relative overflow-auto bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 rounded-t-xl mx-0 md:mx-1 mt-1 pb-24 md:pb-0">
                <div className="min-w-max flex flex-col">
                    
                    {/* A. STICKY HEADER (CORNER + TIME SLOTS) */}
                    <div className="sticky top-0 z-40 flex w-max min-w-full border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-sm">
                        {/* Corner Block (Sticky Left) */}
                        <div className="sticky left-0 z-50 w-[90px] md:w-[300px] shrink-0 border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-center p-2 md:p-4 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                            <div className="hidden md:block">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Kapasitas</span>
                                    <span className={cn("text-xs font-bold", capacityPercentage >= 100 ? "text-red-600" : "text-blue-600")}>{Math.round(capacityPercentage)}%</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className={cn("h-full rounded-full", capacityPercentage >= 100 ? "bg-red-500" : "bg-blue-500")} style={{ width: `${Math.min(capacityPercentage, 100)}%` }} />
                                </div>
                            </div>
                            <div className="md:hidden flex flex-col items-center justify-center h-full gap-0.5">
                                <span className="text-[10px] font-bold text-slate-400 tracking-wider">LOAD</span>
                                <span className={cn("text-sm font-extrabold", capacityPercentage >= 100 ? "text-red-500" : "text-blue-600")}>{Math.round(capacityPercentage)}%</span>
                            </div>
                        </div>

                        {/* Time Slots Header */}
                        <div className="flex">
                            {displayOperatingSlots.map((time) => (
                                <div key={time} className="w-[140px] md:w-[180px] shrink-0 flex items-center justify-center p-3 text-sm font-bold text-slate-600 dark:text-slate-300 border-r border-slate-50 dark:border-slate-800/50">
                                    {time}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* B. BRANCH & TECH ROWS */}
                    {(selectedBranchId === 'all' ? branches : branches.filter(b => b.id === selectedBranchId)).length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <p>Tidak ada data cabang.</p>
                        </div>
                    ) : (
                        (selectedBranchId === 'all' ? branches : branches.filter(b => b.id === selectedBranchId)).map(branch => {
                            const branchTechs = activeTechnicians.filter(t => t.branchId === branch.id);
                            
                            return (
                                <div key={branch.id} className="flex flex-col min-w-max border-b border-slate-50 dark:border-slate-800">
                                    {/* Branch Separator Row (Background spans full width, Content is sticky) */}
                                    <div className="relative z-30 min-w-full bg-slate-50 dark:bg-slate-900/95 border-y border-slate-200 dark:border-slate-800 backdrop-blur-sm">
                                        <div className="sticky left-0 w-full md:w-[320px] px-3 py-2 flex items-center justify-between bg-slate-50 dark:bg-slate-900/95 md:bg-transparent">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">{branch.name}</span>
                                            </div>
                                            <span className="text-[10px] bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-500">{branchTechs.length} Teknisi</span>
                                        </div>
                                    </div>

                                    {branchTechs.length === 0 ? (
                                        <div className="flex w-full border-b border-slate-50 dark:border-slate-800">
                                            <div className="sticky left-0 z-20 w-[90px] md:w-[300px] shrink-0 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800"></div>
                                            <div className="flex-1 p-8 text-center text-xs text-slate-400 italic bg-slate-50/10">Belum ada teknisi</div>
                                        </div>
                                    ) : (
                                        branchTechs.map((tech) => {
                                            const schedule = technicianSchedules.find(s => s.userId === tech.id && s.date === dateStr);
                                            const isOff = !!schedule;
                                            const techOrders = dayItems.filter(item => item.technicianId === tech.id);
                                            const activeTechTimelineItems = techOrders.filter(
                                              (item) => !isInactiveScheduleItem(item) && Boolean(getDisplayOperationalSlotTime(item.serviceTime))
                                            );
                                            const activeTechOrdersCount = activeTechTimelineItems.length;
                                            
                                            return (
                                                <div key={tech.id} className="flex border-b border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-900 group min-w-max">
                                                    
                                                    {/* TECH PROFILE (STICKY LEFT) */}
                                                    <div className={cn(
                                                        "sticky left-0 z-20 w-[90px] md:w-[300px] shrink-0 border-r border-slate-200 dark:border-slate-800 p-2 md:p-4 flex flex-col md:flex-row items-center md:items-start justify-center md:justify-start gap-1.5 md:gap-4 transition-colors shadow-[4px_0_24px_rgba(0,0,0,0.02)]",
                                                        isOff ? "bg-slate-50 dark:bg-slate-900" : "bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800"
                                                    )}>
                                                        <div className={cn(
                                                            "w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center font-bold text-xs md:text-sm overflow-hidden shrink-0 border border-slate-100 shadow-sm",
                                                            isOff ? "opacity-50 grayscale bg-slate-100" : "bg-slate-100 text-slate-700"
                                                        )}>
                                                            {tech.avatar ? <img src={tech.avatar} alt={tech.name} className="w-full h-full object-cover"/> : tech.name.substring(0,2).toUpperCase()}
                                                        </div>
                                                        
                                                        <div className="min-w-0 flex-1 flex flex-col items-center md:items-start text-center md:text-left w-full">
                                                            <div className="w-full px-0.5">
                                                                <p className={cn("font-bold text-[10px] md:text-sm truncate w-full", isOff ? "text-slate-400" : "text-slate-800 dark:text-slate-200")}>
                                                                    {tech.name}
                                                                </p>
                                                            </div>
                                                            
                                                            {isOff ? (
                                                                <span className="text-[9px] font-bold text-red-500 uppercase mt-0.5">OFF</span>
                                                            ) : (
                                                                <>
                                                                    {/* Desktop Stats */}
                                                                    <div className="hidden md:block mt-1 space-y-1">
                                                                        <div className="flex gap-1">
                                                                            {Array.from({length: bookableOperatingSlots.length}).map((_, i) => (
                                                                                <div key={i} className={cn("w-1.5 h-1.5 rounded-full", i < activeTechOrdersCount ? "bg-blue-500" : "bg-slate-200 dark:bg-slate-700")}></div>
                                                                            ))}
                                                                        </div>
                                                                        <p className="text-[10px] text-slate-400">{activeTechOrdersCount} Task</p>
                                                                    </div>
                                                                    
                                                                    {/* Mobile Dot Indicator (Blue Dots Center) */}
                                                                    <div className="md:hidden flex gap-1 mt-1 justify-center">
                                                                        {Array.from({length: Math.min(2, Math.max(1, activeTechOrdersCount))}).map((_, i) => (
                                                                             <div key={i} className={cn("w-1.5 h-1.5 rounded-full", i < activeTechOrdersCount ? "bg-blue-600" : "bg-blue-200")}></div>
                                                                        ))}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                        {/* SLOT GRID */}
                                                    <div className={cn("flex flex-none w-max relative z-0", isOff && "bg-red-50/30 dark:bg-red-900/10")}>
                                                        {isOff && (
                                                            <>
                                                                <div className="absolute inset-0 w-full h-full pointer-events-none z-10" 
                                                                    style={{
                                                                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(239, 68, 68, 0.05) 10px, rgba(239, 68, 68, 0.05) 20px)'
                                                                    }}
                                                                ></div>
                                                                <div className="sticky left-1/2 z-20 h-full w-0 overflow-visible flex items-center justify-center pointer-events-none">
                                                                     <div className="bg-white px-5 py-3 rounded-2xl border border-red-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center gap-3 w-max opacity-80 scale-90">
                                                                        <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                                                                            <AlertCircle className="w-4 h-4" />
                                                                        </div>
                                                                        <div className="text-left">
                                                                            <p className="text-xs font-bold text-slate-800 leading-tight">OFF</p>
                                                                        </div>
                                                                     </div>
                                                                </div>
                                                            </>
                                                        )}
                                                        
                                                        {displayOperatingSlots.map((slotTime) => {
                                                            const slotOrders = activeTechTimelineItems.filter((order) => getOperationalSlotTime(order.serviceTime) === slotTime);
                                                            const isInactiveLateSlot = slotTime === OPTIONAL_OPERATING_SLOT && !showLateOperatingSlot;

                                                            return (
                                                                <div key={slotTime} className={cn(
                                                                    "w-[140px] md:w-[180px] shrink-0 border-r border-slate-100 dark:border-slate-800/50 p-2 relative group/cell min-h-[140px] h-auto flex flex-col gap-2",
                                                                    isOff && "opacity-40 grayscale"
                                                                )}>
                                                                    {slotOrders.length > 0 ? (
                                                                        slotOrders.map((slotOrder, idx) => {
                                                                            const statusMeta = getScheduleStatusMeta(slotOrder);
                                                                            const cs = users.find((user) => user.id === slotOrder.csId);
                                                                            const scheduleConflictInfo = scheduleConflictByItemKey.get(
                                                                              getScheduleConflictItemKey(slotOrder.source, slotOrder.sourceId)
                                                                            );

                                                                            return (
                                                                                <div key={slotOrder.id} className={cn(
                                                                                    "w-full rounded-2xl p-3 flex flex-col relative shadow-sm transition-all hover:shadow-md cursor-pointer border min-h-[110px]",
                                                                                    statusMeta.cardClass,
                                                                                    scheduleConflictInfo && "ring-1 ring-red-300 dark:ring-red-500/60"
                                                                                )}
                                                                                onClick={() => openRouteDialog(slotOrder)}
                                                                                role="button"
                                                                                tabIndex={0}
                                                                                onKeyDown={(event) => {
                                                                                  if (event.key === 'Enter' || event.key === ' ') {
                                                                                    event.preventDefault();
                                                                                    openRouteDialog(slotOrder);
                                                                                  }
                                                                                }}
                                                                                title="Klik untuk buka form rute Google Maps"
                                                                                >
                                                                                    {/* Header: Time & Dot */}
                                                                                    <div className="flex justify-between items-center mb-1">
                                                                                        <span className="text-[10px] font-mono font-medium opacity-60 tracking-wide">{slotOrder.serviceTime}</span>
                                                                                        <div className={cn("w-2 h-2 rounded-full", statusMeta.dotClass)}></div>
                                                                                    </div>

                                                                                    {/* Customer Name */}
                                                                                    <h4 className="text-sm font-bold leading-tight mb-0.5 line-clamp-1">{slotOrder.customerName}</h4>

                                                                                    {/* Service Type & CS */}
                                                                                    <div className="mb-1.5 space-y-0.5 text-slate-500">
                                                                                        <p
                                                                                            className="font-medium line-clamp-2"
                                                                                            style={{ fontSize: '9px', lineHeight: '11px' }}
                                                                                        >
                                                                                            {slotOrder.serviceLabel}
                                                                                        </p>
                                                                                        <p
                                                                                            className="font-medium line-clamp-1"
                                                                                            style={{ fontSize: '9px', lineHeight: '11px' }}
                                                                                        >
                                                                                            CS: {cs?.name || '-'}
                                                                                        </p>
                                                                                    </div>
                                                                                    
                                                                                    {/* Status Badge */}
                                                                                    <div className="mb-2">
                                                                                        <span className={cn(
                                                                                            "text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider",
                                                                                            statusMeta.outlineClass
                                                                                        )}>
                                                                                            {statusMeta.label}
                                                                                        </span>
                                                                                        {scheduleConflictInfo && (
                                                                                            <span className="ml-1 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                                                                                                <AlertCircle className="h-3 w-3" />
                                                                                                Bentrok
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    
                                                                                    {/* Footer: Location */}
                                                                                    <div className="mt-auto flex items-start gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
                                                                                        <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                                                                                        <span className="text-[10px] leading-snug line-clamp-2 font-medium">
                                                                                            {slotOrder.address || 'Lokasi tidak tersedia'}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })
                                                                    ) : !isOff && isInactiveLateSlot ? (
                                                                        <div className="w-full h-full rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                                                                            <span className="text-xs font-semibold">{slotTime}</span>
                                                                            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em]">Nonaktif</span>
                                                                        </div>
                                                                    ) : !isOff && (
                                                                        <div
                                                                            className={cn(
                                                                                "w-full h-full rounded-xl border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center transition-all",
                                                                                canOpenAddProspectFromTimeline
                                                                                    ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                                                                    : "cursor-default"
                                                                            )}
                                                                            onClick={() =>
                                                                                openAddProspectFromTimeline({
                                                                                    source: 'schedule',
                                                                                    scheduleDate: dateStr,
                                                                                    scheduleTime: slotTime,
                                                                                    technicianId: tech.id,
                                                                                    technicianName: tech.name,
                                                                                    branchId: branch.id,
                                                                                    branchName: branch.name,
                                                                                })
                                                                            }
                                                                            role={canOpenAddProspectFromTimeline ? "button" : undefined}
                                                                            tabIndex={canOpenAddProspectFromTimeline ? 0 : -1}
                                                                            onKeyDown={(event) => {
                                                                                if (!canOpenAddProspectFromTimeline) return;
                                                                                if (event.key === 'Enter' || event.key === ' ') {
                                                                                    event.preventDefault();
                                                                                    openAddProspectFromTimeline({
                                                                                        source: 'schedule',
                                                                                        scheduleDate: dateStr,
                                                                                        scheduleTime: slotTime,
                                                                                        technicianId: tech.id,
                                                                                        technicianName: tech.name,
                                                                                        branchId: branch.id,
                                                                                        branchName: branch.name,
                                                                                    });
                                                                                }
                                                                            }}
                                                                            title={canOpenAddProspectFromTimeline ? "Klik untuk tambah prospek di slot ini" : undefined}
                                                                        >
                                                                            <Plus className="w-5 h-5 text-blue-300 mb-1" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* 2. UNASSIGNED ORDERS BOTTOM SHEET (Fixed Overlay) */}
            
            {/* FAB Trigger */}
            <button
                onClick={() => setShowUnassigned(true)}
                className={cn(
                    "fixed bottom-24 right-4 md:bottom-8 md:right-8 z-40 flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-full shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all hover:scale-105 active:scale-95",
                    showUnassigned ? "scale-0 opacity-0 pointer-events-none" : "scale-100 opacity-100"
                )}
            >
                <div className="relative">
                    <LayoutList className="w-5 h-5" />
                    {unassignedItems.length > 0 && (
                        <span className="absolute -top-2 -right-2 min-w-[16px] h-4 bg-red-500 text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-blue-600 px-0.5">
                            {unassignedItems.length}
                        </span>
                    )}
                </div>
                <span className="font-bold text-sm hidden md:inline">Unassigned</span>
            </button>

            {/* Backdrop */}
            {showUnassigned && (
                <div 
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
                    onClick={() => setShowUnassigned(false)}
                ></div>
            )}

            <div className={cn(
                "fixed z-50 bg-white dark:bg-slate-900 flex flex-col transition-transform duration-300 ease-out",
                // Mobile: Bottom Sheet
                "bottom-[74px] left-0 right-0 rounded-t-[32px] border-t border-slate-100 dark:border-slate-800 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] max-h-[85vh]",
                showUnassigned ? "translate-y-0" : "translate-y-[120%]",
                // Desktop: Right Side Sheet
                "md:top-0 md:bottom-0 md:left-auto md:right-0 md:w-[400px] md:h-full md:max-h-none md:rounded-l-2xl md:rounded-tr-none md:border-l md:border-t-0 md:shadow-[-8px_0_30px_rgba(0,0,0,0.15)]",
                // Reset Mobile Transform & Apply Desktop Transform
                "md:translate-y-0",
                showUnassigned ? "md:translate-x-0" : "md:translate-x-full"
            )}>
                
                {/* Drag Handle Indicator (Mobile Only) */}
                <div 
                    className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing md:hidden"
                    onClick={() => setShowUnassigned(!showUnassigned)}
                >
                    <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                </div>

                {/* Header Section */}
                <div className="px-6 pb-2 pt-1 md:pt-6 flex flex-col gap-4 bg-white dark:bg-slate-900 shrink-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">Unassigned Jadwal</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Order dan booking yang belum dapat teknisi</p>
                        </div>
                        <button 
                            onClick={() => setShowUnassigned(false)}
                            className="p-2 -mr-2 text-slate-400 hover:text-slate-600"
                        >
                            <ChevronDown className="w-5 h-5 md:hidden" />
                            {/* Close Icon for Desktop */}
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 hidden md:block"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative w-full">
                         <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                         <input 
                             type="text" 
                             placeholder="Cari jadwal..." 
                             className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                         />
                    </div>
                </div>

                {/* Scrollable List Container */}
                <div className="flex-1 overflow-auto md:overflow-y-auto md:overflow-x-hidden no-scrollbar px-6 pb-8 pt-2 min-h-[180px]">
                    <div className="flex md:flex-col gap-3 h-full items-start">
                        {unassignedItems.length === 0 ? (
                            <div className="w-full flex flex-col items-center justify-center text-slate-400 mt-4 py-12">
                                <CheckCircle2 className="w-8 h-8 mb-2 opacity-20" />
                                <span className="text-xs font-medium">Semua aman! Tidak ada jadwal gantung.</span>
                            </div>
                        ) : (
                            unassignedItems.map(item => (
                                <div key={item.id} className="w-[220px] md:w-full shrink-0 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm hover:border-blue-400 hover:shadow-md cursor-grab active:cursor-grabbing md:cursor-pointer flex flex-col group transition-all relative">
                                    <div>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-bold px-2 py-1 rounded-md">
                                                {format(parseISO(item.serviceDate || new Date().toISOString()), 'dd MMM')}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm line-clamp-1 mb-1">{item.customerName}</h4>
                                        <p className="text-[11px] text-slate-500 truncate font-medium">{item.serviceLabel}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-3 border-t border-slate-50 dark:border-slate-900 mt-2">
                                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                                        <span className="truncate text-slate-500 dark:text-slate-400">{item.address?.split(',')[0]}</span>
                                    </div>
                                    
                                    {/* Quick Assign Overlay (Visible on Hover/Touch) */}
                                    <div className="absolute inset-0 bg-blue-600/90 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 text-white pointer-events-none md:pointer-events-auto">
                                        <p className="text-xs font-bold">Assign to?</p>
                                        <div className="bg-white/20 p-1.5 rounded-full backdrop-blur-sm cursor-pointer">
                                            <Plus className="w-5 h-5" />
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Floating Toggle Button Removed - Duplicate of FAB Trigger */}
        </div>
    );
  };

  const renderMonthlyView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Add padding days for grid alignment
    const startDayOfWeek = getDay(monthStart); // 0 (Sun) - 6 (Sat)
    // Adjust for Monday start (Monday = 1, Sunday = 7 in ISO, but getDay gives Sun=0)
    // Let's assume standard Calendar grid (Sun-Sat or Mon-Sun). Let's use Mon-Sun.
    const paddingDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; 
    const blanks = Array(paddingDays).fill(null);

    const weekDays = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    
    // Determine which branches to show
    const displayBranches = selectedBranchId === 'all' 
        ? branches 
        : branches.filter(b => b.id === selectedBranchId);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            {/* Calendar Header (Desktop Only) */}
            <div className="hidden md:grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                {weekDays.map(d => (
                    <div key={d} className="py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {d}
                    </div>
                ))}
            </div>
            
            {/* Content Area */}
            <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50 dark:bg-slate-950 p-2 md:p-1 pb-20 md:pb-20">
                {/* Mobile View: Vertical List */}
                <div className="md:hidden space-y-3 pb-24">
                    {/* renderMobileStats moved to main layout */}
                    {days.map((date) => {
                        // Calculate stats for this day
                        let dailyUsed = 0;
                        let dailyTotal = 0;
                        
                        const stats = {
                            scheduled: 0, 
                            pending: 0,   
                            done: 0,      
                            cancelled: 0  
                        };
                        const performanceOrdersMap = new Map<string, ScheduleItem>();

                        displayBranches.forEach(b => {
                             const caps = getBranchDayCapacity(date, b.id);
                             dailyUsed += caps.used;
                             dailyTotal += caps.total;
                             
                             caps.orders.forEach(item => {
                                 if (!isInactiveScheduleItem(item)) {
                                     performanceOrdersMap.set(item.id, item);
                                 }
                             });

                             caps.orders.forEach(item => {
                                 const bucket = getScheduleStatusMeta(item).bucket;
                                 if (bucket === 'scheduled') stats.scheduled++;
                                 else if (bucket === 'pending') stats.pending++;
                                 else if (bucket === 'done') stats.done++;
                                 else if (bucket === 'cancelled') stats.cancelled++;
                             });
                        });
                        
                        const csStats: Record<string, number> = {};
                        const advStats: Record<string, number> = {};

                        performanceOrdersMap.forEach(o => {
                            if (o.csId) {
                                const u = users.find(user => user.id === o.csId);
                                const name = u ? u.name : '??';
                                csStats[name] = (csStats[name] || 0) + 1;
                            }
                            if (o.advertiserId) {
                                const u = users.find(user => user.id === o.advertiserId);
                                const name = u ? u.name : '??';
                                advStats[name] = (advStats[name] || 0) + 1;
                            }
                        });

                        const sortedCsStats = Object.entries(csStats).sort((a, b) => b[1] - a[1]);
                        const sortedAdvStats = Object.entries(advStats).sort((a, b) => b[1] - a[1]);
                        const dailyConflictCount = Array.from(performanceOrdersMap.values()).filter((item) =>
                            scheduleConflictByItemKey.has(getScheduleConflictItemKey(item.source, item.sourceId))
                        ).length;

                        // Skip days from other months if needed, or show them. Usually monthly view shows full month.
                        if (!isSameMonth(date, currentDate)) return null;

                        return (
                            <div 
                                key={date.toISOString()} 
                                onClick={() => {
                                    if (!canOpenInteractiveSchedule) return;
                                    setCurrentDate(date);
                                    setView('day');
                                }}
                                className={cn(
                                    "bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm transition-shadow",
                                    canOpenInteractiveSchedule && "cursor-pointer hover:shadow-md"
                                )}
                            >
                                {/* Header: Date & Total */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 text-sm">
                                            {format(date, 'd')}
                                        </div>
                                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                                            {format(date, 'EEEE', { locale: id })}
                                        </span>
                                    </div>
                                    <div className={cn(
                                        "px-2.5 py-1 rounded-full text-xs font-bold",
                                        dailyTotal > 0 && dailyUsed >= dailyTotal ? "bg-red-100 text-red-600" :
                                        dailyTotal > 0 && dailyUsed >= dailyTotal * 0.7 ? "bg-amber-100 text-amber-600" :
                                        "bg-emerald-100 text-emerald-600"
                                    )}>
                                        {dailyUsed}/{dailyTotal}
                                    </div>
                                </div>
                                {dailyConflictCount > 0 && (
                                    <div className="mb-3 inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 dark:text-red-400">
                                        <AlertCircle className="h-3 w-3" />
                                        Bentrok {dailyConflictCount}
                                    </div>
                                )}

                                {/* Branches List */}
                                <div className="flex flex-col gap-1 flex-1 pr-1">
                                    {displayBranches.map(branch => {
                                        const { used, total, percentage } = getBranchDayCapacity(date, branch.id);
                                        
                                        // Skip branches with no capacity if showing ALL
                                        if (selectedBranchId === 'all' && total === 0) return null;

                                        let barColor = "bg-emerald-500";
                                        if (percentage >= 100) barColor = "bg-red-500";
                                        else if (percentage >= 70) barColor = "bg-amber-500";

                                        return (
                                            <div key={branch.id} className="flex flex-col mb-2 last:mb-0">
                                                {/* Header: Kode Cabang & Kapasitas (ex: 4/10) */}
                                                <div className="flex justify-between items-end mb-1">
                                                    <span className="text-[10px] font-medium text-slate-700 dark:text-slate-200 leading-none truncate" title={branch.name}>
                                                        {branch.name}
                                                    </span>
                                                    <span className={cn(
                                                        "text-[10px] font-medium leading-none",
                                                        percentage >= 100 ? "text-red-500" : "text-slate-500 dark:text-slate-400"
                                                    )}>
                                                        {used}/{total}
                                                    </span>
                                                </div>
                                                
                                                {/* Progress Bar */}
                                                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div className={cn("h-full rounded-full", barColor)} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {selectedBranchId === 'all' && displayBranches.every(b => getBranchDayCapacity(date, b.id).total === 0) && (
                                        <div className="text-center py-2 text-xs text-slate-400 italic">Libur / Tidak ada teknisi</div>
                                    )}
                                </div>

                                {/* Performance Summary Section */}
                                {(sortedCsStats.length > 0 || sortedAdvStats.length > 0) && (
                                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-2">
                                        {sortedCsStats.length > 0 && (
                                            <div className="flex flex-col gap-1 text-[9px] leading-tight">
                                                <span className="font-bold text-slate-500 uppercase tracking-wide">CS</span>
                                                <div className="flex flex-col gap-0.5 text-slate-700 dark:text-slate-300 font-medium pl-1">
                                                    {sortedCsStats.map(([name, count]) => (
                                                        <div key={name} className="flex justify-between items-center w-full">
                                                            <span className="truncate pr-1 max-w-[80px]" title={name}>{name}</span>
                                                            <span className="font-bold tabular-nums">{count}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {sortedAdvStats.length > 0 && (
                                            <div className="flex flex-col gap-1 text-[9px] leading-tight">
                                                <span className="font-bold text-slate-500 uppercase tracking-wide">Adv</span>
                                                <div className="flex flex-col gap-0.5 text-slate-700 dark:text-slate-300 font-medium pl-1">
                                                    {sortedAdvStats.map(([name, count]) => (
                                                        <div key={name} className="flex justify-between items-center w-full">
                                                            <span className="truncate pr-1 max-w-[80px]" title={name}>{name}</span>
                                                            <span className="font-bold tabular-nums">{count}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Status Dots Footer (Mini indicators) */}
                                {dailyTotal > 0 && (
                                    <div className="flex gap-1 justify-end pt-1 border-t border-slate-50 dark:border-slate-800 mt-auto">
                                        {stats.pending > 0 && (
                                            <div className="flex items-center gap-0.5 text-[9px] font-medium text-blue-600 bg-blue-50 px-1 py-0.5 rounded-sm" title="Pending">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                {stats.pending}
                                            </div>
                                        )}
                                        {stats.cancelled > 0 && (
                                            <div className="flex items-center gap-0.5 text-[9px] font-medium text-red-600 bg-red-50 px-1 py-0.5 rounded-sm" title="Cancel">
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                                {stats.cancelled}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Desktop View: Grid */}
                <div className="hidden md:grid grid-cols-7 auto-rows-auto gap-1">
                    {blanks.map((_, i) => (
                        <div key={`blank-${i}`} className="bg-transparent" />
                    ))}
                    
                    {days.map((date) => {
                        const isToday = isSameDay(date, new Date());
                        
                        // Hitung total harian dari cabang yang ditampilkan
                        let dailyUsed = 0;
                        let dailyTotal = 0;
                        
                        // Stats accumulator
                        const stats = {
                            scheduled: 0, // processing, waiting, reschedule
                            pending: 0,   // pending
                            done: 0,      // done
                            cancelled: 0  // cancelled
                        };
                        
                        const performanceOrdersMap = new Map<string, ScheduleItem>();

                        displayBranches.forEach(b => {
                             const caps = getBranchDayCapacity(date, b.id);
                             dailyUsed += caps.used;
                             dailyTotal += caps.total;
                             
                             // Collect active orders for performance stats (exclude cancelled)
                             // Deduplicate by ID to ensure strict uniqueness
                             caps.orders.forEach(item => {
                                 if (!isInactiveScheduleItem(item)) {
                                     performanceOrdersMap.set(item.id, item);
                                 }
                             });

                             // Aggregate statuses
                             caps.orders.forEach(item => {
                                 const bucket = getScheduleStatusMeta(item).bucket;
                                 if (bucket === 'scheduled') stats.scheduled++;
                                 else if (bucket === 'pending') stats.pending++;
                                 else if (bucket === 'done') stats.done++;
                                 else if (bucket === 'cancelled') stats.cancelled++;
                             });
                        });
                        
                        // Calculate Performance Stats (CS & Adv)
                        const csStats: Record<string, number> = {};
                        const advStats: Record<string, number> = {};

                        performanceOrdersMap.forEach(o => {
                            if (o.csId) {
                                const u = users.find(user => user.id === o.csId);
                                const name = u ? u.name : '??';
                                csStats[name] = (csStats[name] || 0) + 1;
                            }
                            if (o.advertiserId) {
                                const u = users.find(user => user.id === o.advertiserId);
                                const name = u ? u.name : '??';
                                advStats[name] = (advStats[name] || 0) + 1;
                            }
                        });

                        // Sort stats by count descending
                        const sortedCsStats = Object.entries(csStats).sort((a, b) => b[1] - a[1]);
                        const sortedAdvStats = Object.entries(advStats).sort((a, b) => b[1] - a[1]);
                        const dailyConflictCount = Array.from(performanceOrdersMap.values()).filter((item) =>
                            scheduleConflictByItemKey.has(getScheduleConflictItemKey(item.source, item.sourceId))
                        ).length;

                        const dailyPercent = dailyTotal > 0 ? (dailyUsed / dailyTotal) * 100 : 0;
                        
                        return (
                            <div 
                                key={date.toISOString()} 
                                onClick={() => {
                                    if (!canOpenInteractiveSchedule) return;
                                    setCurrentDate(date);
                                    setView('day');
                                }}
                                className={cn(
                                    "bg-white dark:bg-slate-800 p-2.5 min-h-[140px] rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all flex flex-col gap-1 relative group",
                                    canOpenInteractiveSchedule ? "cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700" : "",
                                    isToday && "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 border-blue-200 dark:border-blue-800"
                                )}
                            >
                                {/* Date Header & Daily Summary */}
                                <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-700 mb-1">
                                    <div className="flex items-center gap-1">
                                        <span className={cn(
                                            "text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-colors",
                                            isToday ? "bg-blue-600 text-white" : "text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700"
                                        )}>
                                            {format(date, 'd')}
                                        </span>
                                    </div>
                                    
                                    {/* Daily Summary Badge (Technician Capacity) - Non-Advertiser */}
                                    {dailyTotal > 0 && !isAdvertiserUser && (
                                        <div className="flex flex-col items-end">
                                            <div className="flex items-center gap-1">
                                                <div className="flex items-center justify-center gap-0.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700/50 font-bold text-xs">
                                                    <span className={cn(
                                                        dailyPercent >= 100 ? "text-red-600" :
                                                        dailyPercent >= 70 ? "text-amber-600" :
                                                        "text-emerald-600"
                                                    )}>
                                                        {dailyUsed}
                                                    </span>
                                                    <span className="text-slate-400 text-[10px] font-medium">/</span>
                                                    <span className="text-slate-600 dark:text-slate-300">
                                                        {dailyTotal}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Total Order Count Badge - Advertiser Only */}
                                    {isAdvertiserUser && dailyTotal > 0 && (
                                        <div className={cn(
                                            "flex items-center justify-center px-3 h-7 rounded-full text-sm font-bold",
                                            dailyPercent >= 100 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                            dailyPercent >= 70 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                                            "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                        )}>
                                            <span>{dailyUsed}</span>
                                            <span className="text-slate-400 dark:text-slate-500 font-medium mx-[1px]">/</span>
                                            <span className="text-slate-400 dark:text-slate-500 font-medium">{dailyTotal}</span>
                                        </div>
                                    )}
                                </div>
                                {dailyConflictCount > 0 && (
                                    <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 dark:text-red-400">
                                        <AlertCircle className="h-3 w-3" />
                                        Bentrok {dailyConflictCount}
                                    </div>
                                )}

                                {/* Content Body: Branch Capacity List (For All Roles) */}
                                <div className="flex flex-col gap-1 flex-1 pr-1">
                                    {displayBranches.map(branch => {
                                        const { used, total, percentage } = getBranchDayCapacity(date, branch.id);
                                        
                                        // Skip branches with no capacity if showing ALL
                                        if (selectedBranchId === 'all' && total === 0) return null;

                                        let barColor = "bg-emerald-500";
                                        if (percentage >= 100) barColor = "bg-red-500";
                                        else if (percentage >= 70) barColor = "bg-amber-500";

                                        return (
                                            <div key={branch.id} className="flex flex-col mb-2 last:mb-0">
                                                {/* Header: Kode Cabang & Kapasitas (ex: 4/10) */}
                                                <div className="flex justify-between items-end mb-1">
                                                    <span className="text-[10px] font-medium text-slate-700 dark:text-slate-200 leading-none truncate" title={branch.name}>
                                                        {branch.name}
                                                    </span>
                                                    <span className={cn(
                                                        "text-[10px] font-medium leading-none",
                                                        percentage >= 100 ? "text-red-500" : "text-slate-500 dark:text-slate-400"
                                                    )}>
                                                        {used}/{total}
                                                    </span>
                                                </div>
                                                
                                                {/* Progress Bar */}
                                                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div className={cn("h-full rounded-full", barColor)} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Performance Summary Section */}
                                {(sortedCsStats.length > 0 || sortedAdvStats.length > 0) && (
                                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-2">
                                        {sortedCsStats.length > 0 && (
                                            <div className="flex flex-col gap-1 text-[9px] leading-tight">
                                                <span className="font-bold text-slate-500 uppercase tracking-wide">CS</span>
                                                <div className="flex flex-col gap-0.5 text-slate-700 dark:text-slate-300 font-medium pl-1">
                                                    {sortedCsStats.map(([name, count]) => (
                                                        <div key={name} className="flex justify-between items-center w-full">
                                                            <span className="truncate pr-1 max-w-[80px]" title={name}>{name}</span>
                                                            <span className="font-bold tabular-nums">{count}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {sortedAdvStats.length > 0 && (
                                            <div className="flex flex-col gap-1 text-[9px] leading-tight">
                                                <span className="font-bold text-slate-500 uppercase tracking-wide">Adv</span>
                                                <div className="flex flex-col gap-0.5 text-slate-700 dark:text-slate-300 font-medium pl-1">
                                                    {sortedAdvStats.map(([name, count]) => (
                                                        <div key={name} className="flex justify-between items-center w-full">
                                                            <span className="truncate pr-1 max-w-[80px]" title={name}>{name}</span>
                                                            <span className="font-bold tabular-nums">{count}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Status Dots Footer (Mini indicators) */}
                                {dailyTotal > 0 && (
                                    <div className="flex gap-1 justify-end pt-1 border-t border-slate-50 dark:border-slate-800 mt-auto">
                                        {stats.pending > 0 && (
                                            <div className="flex items-center gap-0.5 text-[9px] font-medium text-blue-600 bg-blue-50 px-1 py-0.5 rounded-sm" title="Pending">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                {stats.pending}
                                            </div>
                                        )}
                                        {stats.cancelled > 0 && (
                                            <div className="flex items-center gap-0.5 text-[9px] font-medium text-red-600 bg-red-50 px-1 py-0.5 rounded-sm" title="Cancel">
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                                {stats.cancelled}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="p-3 bg-white dark:bg-slate-800 text-xs text-slate-500 flex gap-1 justify-end border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Kosong</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Hampir Penuh</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Penuh</div>
            </div>
        </div>
    );
  };

  const renderAvailabilityView = () => {
    return (
      <div className="flex-1 overflow-y-auto pr-0 font-sans text-xs md:pr-1">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_12px_40px_-20px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xs font-semibold tracking-[0.12em] text-slate-900 uppercase dark:text-slate-100">Kalender Ketersediaan</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-10 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{availabilityRangeDisplayLabel}</p>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleCopyAvailability}
                disabled={!hasCopyableAvailability}
                className="h-10 rounded-2xl border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Slot Kosong
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Teknisi</p>
              <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-100">{availabilitySummary.totalTechnicians}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Aktif</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-900/10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-500">Kosong</p>
              <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{availabilitySummary.totalEmptySlots}</p>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-300/80">Slot</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/40 dark:bg-blue-900/10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">Terisi</p>
              <p className="mt-1 text-xs font-semibold text-blue-700 dark:text-blue-300">{availabilitySummary.totalOccupiedSlots}</p>
              <p className="text-xs text-blue-600/80 dark:text-blue-300/80">Slot</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Off</p>
              <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">{availabilitySummary.totalOffSlots}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Slot</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Slot kosong
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-violet-700 dark:border-violet-900/40 dark:bg-violet-900/10 dark:text-violet-300">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
              Booking prospek
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/10 dark:text-blue-300">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              Order terjadwal
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              Teknisi off
            </span>
            {!showLateOperatingSlot && shouldDisplayLateOperatingSlot && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                Slot nonaktif
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          {availabilityCards.map((day) => (
            <div
              key={day.dateStr}
              className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_12px_40px_-20px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {format(day.date, 'EEEE', { locale: id })}
                  </p>
                  <h3 className="mt-1 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {format(day.date, 'd MMMM yyyy', { locale: id })}
                  </h3>
                </div>

                <div className="text-right">
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">{day.emptyCount} kosong</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {day.occupiedCount} terisi • {day.offCount} off
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {day.branches.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-xs text-slate-400 dark:border-slate-700">
                    Belum ada cabang aktif pada filter ini.
                  </div>
                ) : (
                  day.branches.map((branchSection) => (
                    <div key={branchSection.branch.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            {branchSection.branch.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                            {branchSection.technicians.length} teknisi • {branchSection.emptyCount} slot kosong
                          </p>
                        </div>
                        <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                          {branchSection.occupiedCount} terisi
                        </Badge>
                      </div>

                      <div className="mt-3 space-y-3">
                        {branchSection.technicians.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-center text-xs text-slate-400 dark:border-slate-700">
                            Belum ada teknisi aktif di cabang ini.
                          </div>
                        ) : (
                          branchSection.technicians.map((technician) => (
                            <div key={technician.tech.id} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    {technician.tech.avatar ? (
                                      <img src={technician.tech.avatar} alt={technician.tech.name} className="h-full w-full object-cover" />
                                    ) : (
                                      technician.tech.name.substring(0, 2).toUpperCase()
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                                      {technician.tech.name}
                                    </p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500">
                                      {technician.offSchedule
                                        ? `${technician.offSchedule.type}${technician.offSchedule.reason ? ` • ${technician.offSchedule.reason}` : ''}`
                                        : `${technician.emptyCount} kosong • ${technician.occupiedCount} terisi`}
                                    </p>
                                  </div>
                                </div>

                                {technician.offSchedule ? (
                                  <Badge className="rounded-full bg-red-100 text-xs font-semibold text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300">
                                    {technician.offSchedule.type}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300">
                                    {technician.emptyCount} tersedia
                                  </Badge>
                                )}
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                                {technician.slots.map((slot) => {
                                  const isEmpty = slot.state === 'empty';
                                  const isInactive = slot.state === 'inactive';
                                  const isInteractive = isEmpty && canOpenAddProspectFromTimeline;
                                  const hasScheduleConflict = slot.items.some((item) =>
                                    scheduleConflictByItemKey.has(getScheduleConflictItemKey(item.source, item.sourceId))
                                  );
                                  const slotStatusLabel = slot.state === 'off'
                                    ? technician.offSchedule?.type || 'OFF'
                                    : slot.state === 'inactive'
                                      ? 'Nonaktif'
                                    : slot.state === 'empty'
                                      ? 'Kosong'
                                      : slot.state === 'booking'
                                        ? slot.items.length > 1 ? `${slot.items.length} booking` : 'Booking'
                                        : slot.items.length > 1 ? `${slot.items.length} order` : 'Terisi';

                                  return (
                                    <button
                                      key={slot.slotTime}
                                      type="button"
                                      disabled={!isInteractive}
                                      onClick={() =>
                                        openAddProspectFromTimeline({
                                          source: 'schedule',
                                          scheduleDate: day.dateStr,
                                          scheduleTime: slot.slotTime,
                                          technicianId: technician.tech.id,
                                          technicianName: technician.tech.name,
                                          branchId: branchSection.branch.id,
                                          branchName: branchSection.branch.name,
                                        })
                                      }
                                      className={cn(
                                        "relative flex min-h-[68px] flex-col items-start justify-between rounded-2xl border px-3 py-2 text-left transition-all",
                                        slot.state === 'empty' && isInteractive && "cursor-pointer hover:-translate-y-0.5 hover:shadow-sm",
                                        slot.state === 'empty' && !isInteractive && "cursor-default",
                                        slot.state === 'empty' && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300",
                                        isInactive && "cursor-default border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500",
                                        slot.state === 'booking' && "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-900/10 dark:text-violet-300",
                                        slot.state === 'order' && "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/10 dark:text-blue-300",
                                        slot.state === 'off' && "cursor-default border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
                                        hasScheduleConflict && "ring-1 ring-red-300 dark:ring-red-500/60"
                                      )}
                                      title={
                                        slot.state === 'empty'
                                          ? (isInteractive ? `Klik untuk booking slot ${slot.slotTime}` : `Slot ${slot.slotTime} masih kosong`)
                                          : isInactive
                                            ? `Slot ${slot.slotTime} sedang tidak aktif`
                                          : slot.state === 'off'
                                            ? `Teknisi off: ${technician.offSchedule?.type || 'OFF'}`
                                            : `${slotStatusLabel} pada slot ${slot.slotTime}`
                                      }
                                    >
                                      {slot.items.length > 1 && slot.state !== 'empty' && slot.state !== 'off' && !isInactive && (
                                        <span className="absolute right-2 top-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-white/90 px-1 text-xs font-bold text-slate-600 dark:bg-slate-900/80 dark:text-slate-200">
                                          {slot.items.length}
                                        </span>
                                      )}
                                      <span className="text-xs font-semibold">{slot.slotTime}</span>
                                      <span className="text-xs font-medium opacity-80">{slotStatusLabel}</span>
                                      {hasScheduleConflict && (
                                        <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">
                                          Bentrok
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
    <div className="flex flex-col md:h-full min-h-screen gap-4 p-0 md:p-6 w-full max-w-[1600px] mx-auto md:overflow-hidden bg-slate-50 dark:bg-slate-950">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4">
        
        {/* TOP: Title (Scrolls away on mobile) */}
        <div className="px-4 pt-4 md:px-0 md:pt-0 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-slate-800 dark:text-slate-100">Jadwal & Penugasan</h1>
              <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm">Monitoring kapasitas teknisi untuk pesanan dan booking prospek.</p>
            </div>
            
            <div className="hidden md:flex flex-wrap items-center justify-end gap-2">
                 {!isAdvertiserUser && (
                    <div className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">19:00</span>
                        <Switch
                            checked={showLateOperatingSlot}
                            onCheckedChange={setShowLateOperatingSlot}
                            aria-label="Tampilkan slot jam 19:00"
                        />
                    </div>
                 )}
                 {canShowCsFilter && (
                    <div className="w-[140px]">
                        <Select value={selectedCSId} onValueChange={setSelectedCSId}>
                            <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-9 text-xs rounded-xl">
                                <SelectValue placeholder="Pilih CS" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua CS</SelectItem>
                                {csOptions.map(u => (
                                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                 )}
                 {canShowTechFilter && (
                    <div className="w-[140px]">
                        <Select value={selectedTechId} onValueChange={setSelectedTechId}>
                            <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-9 text-xs rounded-xl">
                                <SelectValue placeholder="Pilih Teknisi" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Teknisi</SelectItem>
                                {techOptions.map(u => (
                                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                 )}
                 {canShowAdvertiserFilter && (
                    <div className="w-[140px]">
                        <Select value={selectedAdvertiserId} onValueChange={setSelectedAdvertiserId}>
                            <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-9 text-xs rounded-xl">
                                <SelectValue placeholder="Pilih Advertiser" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Advertiser</SelectItem>
                                {advertiserOptions.map(u => (
                                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                 )}
            </div>
        </div>

        {/* STICKY BAR: Branch, Search, Month Nav */}
        <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-md md:static md:bg-transparent px-4 pb-3 pt-2 md:p-0 border-b md:border-0 border-slate-200/50 shadow-sm md:shadow-none -mx-0 transition-all">
             <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                
                {/* Row 1: Branch + Month Nav */}
                <div className="flex items-center gap-2 justify-between">
                    {/* Branch Filter - Flexible Width */}
                    <div className="flex-1 md:w-[180px] md:flex-none min-w-0">
                        <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                            <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-9 md:h-10 text-xs md:text-sm rounded-xl shadow-sm w-full">
                                <MapPin className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                                <SelectValue placeholder="Pilih Cabang" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Cabang</SelectItem>
                                {branchFilterOptions.map(b => (
                                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Mobile Only: Simple Month Nav */}
                    <div className="md:hidden shrink-0 flex items-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-1 shadow-sm h-9">
                         <button
                            onClick={handlePrev}
                            disabled={isAvailabilityView}
                            className={cn(
                              "w-7 h-7 flex items-center justify-center rounded-lg text-slate-500",
                              isAvailabilityView ? "cursor-not-allowed opacity-40" : "hover:bg-slate-50"
                            )}
                         >
                            <ChevronLeft className="w-4 h-4" />
                         </button>
                         <button
                            onClick={() => setIsDatePickerOpen(true)}
                            className={cn(
                              "h-7 min-w-[76px] px-2 flex items-center justify-center gap-1 rounded-lg text-slate-700 dark:text-slate-200",
                              "hover:bg-slate-50 dark:hover:bg-slate-700"
                            )}
                         >
                            <span className="text-xs font-bold text-center truncate">{mobileDateLabel}</span>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                         </button>
                         <button
                            onClick={handleNext}
                            disabled={isAvailabilityView}
                            className={cn(
                              "w-7 h-7 flex items-center justify-center rounded-lg text-slate-500",
                              isAvailabilityView ? "cursor-not-allowed opacity-40" : "hover:bg-slate-50"
                            )}
                         >
                            <ChevronRight className="w-4 h-4" />
                         </button>
                    </div>

                    {/* Desktop: View Toggle & Search Container (Hidden on Mobile) */}
                    <div className="hidden md:flex items-center gap-2">
                         {/* View Toggle */}
                        <div className="flex bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
                            <button 
                                onClick={() => { setView('month'); setListDateMode('all'); }}
                                className={cn(
                                    "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                                    view === 'month' ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                                )}
                            >
                                <CalendarIcon className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Kalender</span>
                            </button>
                            {!isAdvertiserUser && (
                                <button 
                                    onClick={handleOpenAvailabilityView}
                                    className={cn(
                                        "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                                        view === 'availability' ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                                    )}
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Ketersediaan</span>
                                </button>
                            )}
                            {!isAdvertiserUser && (
                                <button 
                                    onClick={() => { setView('list'); setListDateMode('all'); }}
                                    className={cn(
                                        "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                                        view === 'list' && listDateMode === 'all' ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                                    )}
                                >
                                    <LayoutList className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">List</span>
                                </button>
                            )}
                             {!isAdvertiserUser && (
                                <button 
                                    onClick={() => { setView('list'); setListDateMode('daily'); }}
                                    className={cn(
                                        "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                                        view === 'list' && listDateMode === 'daily' ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                                    )}
                                >
                                    <Clock className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Harian</span>
                                </button>
                             )}
                             {!isAdvertiserUser && (
                                <button 
                                    onClick={() => setView('day')}
                                    className={cn(
                                        "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                                        view === 'day' ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                                    )}
                                >
                                    <LayoutGrid className="w-3.5 h-3.5" />
                                    <span className="hidden lg:inline">Timeline</span>
                                </button>
                             )}
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="Cari..." 
                                className="h-9 pl-8 pr-3 w-[150px] lg:w-[200px] text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>
                    </div>
                </div>

                {!isAdvertiserUser && (
                    <div className="md:hidden flex justify-end">
                        <div className="flex h-8 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">19:00</span>
                            <Switch
                                checked={showLateOperatingSlot}
                                onCheckedChange={setShowLateOperatingSlot}
                                aria-label="Tampilkan slot jam 19:00"
                            />
                        </div>
                    </div>
                )}

                {/* Row 2: Mobile Toolbar (Filter Toggle | View Toggles | Search) */}
                <div className="flex md:hidden items-center gap-2 justify-between">
                    {/* Filter Toggle Button */}
                    {canShowMobileFilterToggle && (
                        <button 
                            onClick={() => setShowMobileFilters(!showMobileFilters)}
                            className={cn(
                                "flex items-center justify-center w-9 h-9 rounded-xl border transition-all shrink-0 shadow-sm",
                                showMobileFilters 
                                    ? "bg-blue-50 border-blue-200 text-blue-600" 
                                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                            )}
                        >
                            <Filter className="w-4 h-4" />
                        </button>
                    )}

                    {/* View Toggles (Icons Only for Mobile) */}
                    <div className="flex items-center bg-white rounded-xl border border-slate-200 p-1 flex-1 shadow-sm h-9 justify-evenly">
                        <button 
                            onClick={() => { setView('month'); setListDateMode('all'); }} 
                            className={cn(
                                "w-full h-full rounded-lg flex items-center justify-center transition-colors", 
                                view === 'month' ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:bg-slate-50"
                            )}
                            title="Kalender"
                        >
                            <CalendarIcon className="w-4 h-4" />
                        </button>
                        
                        {!isAdvertiserUser && (
                             <>
                                <button 
                                    onClick={handleOpenAvailabilityView} 
                                    className={cn(
                                        "w-full h-full rounded-lg flex items-center justify-center transition-colors", 
                                        view === 'availability' ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:bg-slate-50"
                                    )}
                                    title="Ketersediaan"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                </button>
                                
                                <button 
                                    onClick={() => { setView('list'); setListDateMode('all'); }} 
                                    className={cn(
                                        "w-full h-full rounded-lg flex items-center justify-center transition-colors", 
                                        view === 'list' && listDateMode === 'all' ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:bg-slate-50"
                                    )}
                                    title="List Jadwal"
                                >
                                    <LayoutList className="w-4 h-4" />
                                </button>
                                
                                <button 
                                    onClick={() => { setView('list'); setListDateMode('daily'); }} 
                                    className={cn(
                                        "w-full h-full rounded-lg flex items-center justify-center transition-colors", 
                                        view === 'list' && listDateMode === 'daily' ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:bg-slate-50"
                                    )}
                                    title="Harian"
                                >
                                    <Clock className="w-4 h-4" />
                                </button>
                                
                                <button 
                                    onClick={() => setView('day')} 
                                    className={cn(
                                        "w-full h-full rounded-lg flex items-center justify-center transition-colors", 
                                        view === 'day' ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:bg-slate-50"
                                    )}
                                    title="Timeline"
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </button>
                             </>
                        )}
                    </div>
                    
                    {/* Search */}
                    <div className="relative w-[110px] shrink-0">
                         <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                         <input type="text" placeholder="Cari..." className="h-9 pl-8 pr-2 w-full text-[11px] bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                    </div>
                </div>

                {/* Mobile Filter Drawer (Collapsible) */}
                {view !== 'availability' && showMobileFilters && (
                    <div className="md:hidden grid grid-cols-2 gap-2 pt-1 animate-in slide-in-from-top-2 duration-200">
                         {isAdminManagementUser && (
                            <div className="col-span-2 sm:col-span-1">
                                <Select value={selectedCSId} onValueChange={setSelectedCSId}>
                                    <SelectTrigger className="bg-white border-slate-200 h-9 text-xs rounded-xl shadow-sm">
                                        <SelectValue placeholder="Semua CS" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua CS</SelectItem>
                                        {csOptions.map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                         )}
                         {(isAdminManagementUser || isCsUser) && (
                            <div>
                                <Select value={selectedTechId} onValueChange={setSelectedTechId}>
                                    <SelectTrigger className="bg-white border-slate-200 h-9 text-xs rounded-xl shadow-sm">
                                        <SelectValue placeholder="Semua Teknisi" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua Teknisi</SelectItem>
                                        {techOptions.map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                         )}
                         {isAdminManagementUser && (
                            <div>
                                <Select value={selectedAdvertiserId} onValueChange={setSelectedAdvertiserId}>
                                    <SelectTrigger className="bg-white border-slate-200 h-9 text-xs rounded-xl shadow-sm">
                                        <SelectValue placeholder="Semua Advertiser" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua Advertiser</SelectItem>
                                        {advertiserOptions.map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                         )}
                    </div>
                )}
                
                {/* Right Side: Desktop Month Nav & Info */}
                <div className="hidden md:flex items-center gap-4">
                     <div className="flex items-center gap-1">
                        <button
                          onClick={handlePrev}
                          disabled={isAvailabilityView}
                          className={cn(
                            "p-1 rounded-md text-slate-500 dark:text-slate-400 transition-colors",
                            isAvailabilityView ? "cursor-not-allowed opacity-40" : "hover:bg-slate-100 dark:hover:bg-slate-700"
                          )}
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        
                        <button
                          onClick={() => setIsDatePickerOpen(true)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors",
                            "hover:bg-slate-100 dark:hover:bg-slate-700"
                          )}
                        >
                            <CalendarIcon className="w-4 h-4 text-blue-500" />
                            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                                {desktopDateLabel}
                            </span>
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                        </button>

                        <button
                          onClick={handleNext}
                          disabled={isAvailabilityView}
                          className={cn(
                            "p-1 rounded-md text-slate-500 dark:text-slate-400 transition-colors",
                            isAvailabilityView ? "cursor-not-allowed opacity-40" : "hover:bg-slate-100 dark:hover:bg-slate-700"
                          )}
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                     </div>
                     
                     <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {view === 'availability' && (
                            <span className="hidden sm:inline">
                                {availabilityHeaderInfoLabel}
                            </span>
                        )}
                        {view !== 'availability' && (
                        <span className="hidden sm:inline">
                            {view === 'month' || view === 'list'
                                ? `${selectedBranchId === 'all' ? 'Semua Cabang' : branches.find(b => b.id === selectedBranchId)?.name} • ${activeTechnicians.length} Teknisi`
                                : "Geser timeline untuk melihat jadwal jam"
                            }
                        </span>
                        )}
                        <Popover>
                            <PopoverTrigger asChild>
                                <button className="p-2 sm:p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                    <Eye className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-4 border-none shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] rounded-2xl bg-white dark:bg-slate-800" align="end">
                                <Calendar
                                    mode="single"
                                    selected={currentDate}
                                    month={currentDate}
                                    onSelect={(date) => date && setCurrentDate(date)}
                                    initialFocus
                                    components={{
                                        DayContent: (props) => {
                                            const { date } = props;
                                            const dateStr = format(date, 'yyyy-MM-dd');
                                            const totalOrders = viewScheduleItems.filter(item => 
                                                item.serviceDate && 
                                                item.serviceDate.startsWith(dateStr) && 
                                                !isInactiveScheduleItem(item)
                                            ).length;

                                            return (
                                                <div className="relative w-full h-full flex items-center justify-center">
                                                    <span className="text-sm">{format(date, 'd')}</span>
                                                    {totalOrders > 0 && (
                                                        <span className="absolute top-0 right-0 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-[9px] font-bold text-blue-600 dark:text-blue-400 px-0.5">
                                                            {totalOrders}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        }
                                    }}
                                    classNames={{
                                        nav: "hidden",
                                        caption: "flex justify-center pt-1 relative items-center mb-4",
                                        caption_label: "text-sm font-bold text-slate-900 dark:text-slate-100",
                                        head_cell: "text-slate-400 font-normal text-[0.8rem] w-9",
                                        cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-transparent focus-within:relative focus-within:z-20",
                                        day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full",
                                        day_selected: "bg-transparent text-slate-900 dark:text-slate-100 font-bold hover:bg-slate-100 dark:hover:bg-slate-700",
                                        day_today: "bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100 font-bold",
                                    }}
                                />
                            </PopoverContent>
                        </Popover>
                     </div>
                </div>
             </div>
        </div>

      </div>

      {/* MOBILE STATS (Inserted Here) */}
      {view !== 'availability' && (
      <div className="md:hidden px-4">
          {renderMobileStats()}
      </div>
      )}

      {/* DESKTOP STATS */}
      {(view === 'month' || view === 'list') && (
        <div className="hidden md:grid grid-cols-3 gap-1 mb-2">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.05)] flex items-center justify-between">
                <div>
                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Total Jadwal</p>
                    <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                        {(view === 'list' && listDateMode === 'daily') ? dailyStats.totalOrders : monthlyStats.totalOrders}
                    </h3>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 dark:text-blue-400">
                    <CheckCircle2 className="w-5 h-5" />
                </div>
            </div>
            
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.05)] flex items-center justify-between">
                <div>
                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Target Kapasitas</p>
                    <div className="flex items-baseline gap-1">
                        <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                            {(view === 'list' && listDateMode === 'daily') ? dailyStats.totalCapacity : monthlyStats.totalCapacity}
                        </h3>
                        <span className="text-sm font-medium text-slate-400">Slot</span>
                    </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                    <User className="w-5 h-5" />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.05)] flex items-center justify-between">
                <div>
                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                        Okupansi {(view === 'list' && listDateMode === 'daily') ? 'Hari Ini' : 'Bulan Ini'}
                    </p>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                            {Math.round((view === 'list' && listDateMode === 'daily') ? dailyStats.occupancyRate : monthlyStats.occupancyRate)}%
                        </h3>
                        <span className="text-sm font-medium text-slate-400">Terisi</span>
                    </div>
                </div>
                <div className="w-12 h-12 relative flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-100 dark:text-slate-800" />
                        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" 
                            strokeDasharray={125.66} 
                            strokeDashoffset={125.66 - (125.66 * ((view === 'list' && listDateMode === 'daily') ? dailyStats.occupancyRate : monthlyStats.occupancyRate)) / 100}
                            className={cn("transition-all duration-1000", 
                                ((view === 'list' && listDateMode === 'daily') ? dailyStats.occupancyRate : monthlyStats.occupancyRate) >= 90 ? "text-red-500" : 
                                ((view === 'list' && listDateMode === 'daily') ? dailyStats.occupancyRate : monthlyStats.occupancyRate) >= 70 ? "text-amber-500" : "text-emerald-500"
                            )} 
                        />
                    </svg>
                </div>
            </div>
        </div>
      )}

      {/* Dynamic Content */}
      <div className="flex-1 md:min-h-0 flex flex-col md:overflow-hidden px-4 md:px-0 pb-20 md:pb-0">
        {view === 'month' && renderMonthlyView()}
        {view === 'day' && renderDailyView()}
        {view === 'list' && renderListView()}
        {view === 'availability' && renderAvailabilityView()}
      </div>

    </div>
    <Sheet open={isAddProspectOpen} onOpenChange={handleAddProspectSheetOpenChange}>
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        className={isDesktop
          ? "h-full w-[600px] sm:max-w-[600px] bg-white dark:bg-slate-800 p-0 overflow-hidden border-l border-slate-200 dark:border-slate-700 flex flex-col shadow-2xl"
          : "h-[95vh] w-full bg-white dark:bg-slate-800 p-0 overflow-hidden rounded-t-2xl border-slate-200 dark:border-slate-700 flex flex-col"
        }
      >
        <SheetHeader className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 shrink-0 text-left">
          <SheetTitle className="text-lg font-semibold text-slate-900 dark:text-slate-200">Booking Jadwal Prospek</SheetTitle>
          <SheetDescription className="text-xs text-slate-500 dark:text-slate-400">
            Slot yang dipilih langsung dipakai sebagai jadwal booking prospek baru.
          </SheetDescription>
        </SheetHeader>
        <div className="px-6 py-4 overflow-y-auto flex-1 pb-10 scrollbar-hide">
          {addProspectContextSummary && (
            <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-900">
              {addProspectContextSummary}
            </div>
          )}
          <ProspectBookingForm
            key={`timeline-${leadFormInstanceKey}`}
            lead={bookingDraftLead}
            initialBookingOverrides={initialBookingOverrides}
            availableTimeSlots={bookableOperatingSlots}
            lockSlotSelection
            allowStatusSelection={false}
            editableCustomerFields
            submitLabel="Buat Booking Jadwal"
            onSubmit={handleSubmitBookingFromTimeline}
            onCancel={() => handleAddProspectSheetOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
    <Dialog open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
      <DialogContent
        className={cn(
          "max-w-[calc(100%-1.5rem)] rounded-[28px] border border-slate-200 bg-white p-0 gap-0 overflow-hidden",
          isAvailabilityView ? "sm:max-w-[760px]" : "sm:max-w-[360px]"
        )}
      >
        <div className="border-b border-slate-100 px-5 pt-5 pb-4">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-base font-semibold text-slate-900">
              {isAvailabilityView ? 'Filter Ketersediaan' : datePickerTitle}
            </DialogTitle>
            {!isAvailabilityView && (
              <DialogDescription className="text-xs text-slate-500">
                {datePickerDescription}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
              {isAvailabilityView ? availabilityPeriodLabel : isMonthScopedView ? 'Mode bulanan' : 'Mode harian'}
            </div>
            {!isAvailabilityView && (
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
                onClick={() => handleSelectCalendarDate(new Date())}
              >
                Hari ini
              </Button>
            )}
          </div>
        </div>
        {isAvailabilityView ? (
          <div className="flex flex-col sm:flex-row">
            <div className="flex min-w-[180px] flex-col gap-1 border-b border-slate-100 bg-slate-50/60 p-2 sm:border-b-0 sm:border-r dark:border-slate-800 dark:bg-slate-950/70">
              {AVAILABILITY_PRESET_OPTIONS.map((preset) => (
                <Button
                  key={preset.key}
                  type="button"
                  variant="ghost"
                  className={cn(
                    "h-9 justify-start rounded-xl px-3 text-sm font-normal",
                    availabilityPreset === preset.key
                      ? "bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-300"
                      : "text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  )}
                  onClick={() => handleSelectAvailabilityPreset(preset.key)}
                >
                  {preset.buttonLabel}
                </Button>
              ))}
            </div>
            <div className="bg-white p-2 dark:bg-slate-900">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={availabilityDateRange?.from || availabilityStartDate}
                selected={availabilityDateRange}
                onSelect={handleSelectAvailabilityCalendar}
                numberOfMonths={isDesktop ? 2 : 1}
                locale={id}
                className="pointer-events-auto bg-white dark:bg-slate-900"
              />
            </div>
          </div>
        ) : (
          <div className="p-3 sm:p-4">
            <Calendar
              mode="single"
              selected={currentDate}
              defaultMonth={currentDate}
              onSelect={handleSelectCalendarDate}
              locale={id}
              fixedWeeks
              initialFocus
              className="w-full"
              classNames={{
                months: 'flex w-full flex-col gap-2',
                month: 'flex w-full flex-col gap-4',
                caption: 'flex justify-center pt-1 relative items-center w-full',
                caption_label: 'text-base font-semibold text-slate-900',
                nav: 'flex items-center gap-2',
                nav_button: 'absolute size-8 rounded-xl border border-slate-200 bg-white p-0 text-slate-500 hover:bg-slate-50 hover:text-slate-700 opacity-100 shadow-none',
                nav_button_previous: 'left-0',
                nav_button_next: 'right-0',
                table: 'w-full border-collapse',
                head_row: 'flex w-full',
                head_cell: 'w-10 flex-1 text-[12px] font-medium text-slate-400',
                row: 'mt-1 flex w-full',
                cell: 'relative h-10 flex-1 p-0 text-center text-sm [&:has([aria-selected])]:bg-transparent',
                day: 'h-10 w-10 rounded-xl p-0 font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900',
                day_selected: 'bg-blue-600 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white',
                day_today: 'bg-blue-50 text-blue-600 font-semibold',
                day_outside: 'text-slate-300 aria-selected:text-slate-300',
                day_disabled: 'text-slate-300 opacity-50',
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
    <Dialog open={!!routeItem} onOpenChange={(open) => !open && setRouteItem(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rute Google Maps</DialogTitle>
          <DialogDescription>
            Isi link Maps tujuan. Sistem akan buka Google Maps dengan lokasi card ini sebagai titik asal.
          </DialogDescription>
        </DialogHeader>

        {routeItem && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
              <p className="font-semibold text-slate-900">{routeItem.customerName}</p>
              <p className="mt-1 text-xs text-slate-500">{routeItem.serviceDate} • {routeItem.serviceTime}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                {routeItem.address || 'Alamat asal belum tersedia'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="route-destination-url">Link Maps Tujuan</Label>
              <Input
                id="route-destination-url"
                value={destinationMapsUrl}
                onChange={(event) => setDestinationMapsUrl(event.target.value)}
                placeholder="Tempel link Google Maps tujuan di sini"
              />
              <p className="text-[11px] leading-relaxed text-slate-500">
                Bisa pakai link share Google Maps biasa atau short link seperti `maps.app.goo.gl`.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setRouteItem(null)}>
            Tutup
          </Button>
          <Button type="button" onClick={handleOpenGoogleRoute} disabled={isOpeningRoute || !destinationMapsUrl.trim()}>
            <Route className="mr-2 h-4 w-4" />
            {isOpeningRoute ? 'Membuka...' : 'Buka di Google Maps'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
