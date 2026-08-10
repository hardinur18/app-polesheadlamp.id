import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, Plus, Phone,
  Edit, Trash2, MoreVertical, User as UserIcon, Check, CheckCircle2, ArrowRightCircle, LayoutList, KanbanSquare, Copy, ExternalLink, CalendarClock, Ban, MessageCircle, ChevronLeft, ChevronRight, Eye, RefreshCw
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogFooter
} from '../components/ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { Tabs, TabsRail, TabsTrigger, TabsViewport } from '../components/ui/tabs';
import { useMasterData } from '@/app/pages/master-data/context';
import { usePermissions } from '@/app/hooks/usePermissions';
import { logActivity } from '@/app/services/auditService';
import {
  isAdminManagementRole,
  isAdvertiserRole,
  isCsRole,
  isOwnerLikeRole,
} from '@/app/data/roleHelpers';
import { Lead, LeadStatus, ProspectBooking, User, WATemplate } from './master-data/data';
import { LeadForm } from './leads/LeadForm';
import { OrderForm } from './orders/OrderForm';
import { Order } from './master-data/data';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/clipboard';
import { PeriodFilterPicker } from '../components/ui/period-filter-picker';
import { DateRange } from 'react-day-picker';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
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
  createDataTableColumns,
  DataTable,
  TableActionCell,
  TableActionHeader,
  TableActionMenu,
  TableActionMenuItem,
  TableText,
} from '../components/ui/data-table';
import { MasterDataTableTitle } from '../components/ui/master-data-table-title';
import {
  MasterDataDialogBody,
  MasterDataFormActions,
  MasterDataFormDialogContent,
  MasterDataFormHeader,
  MasterDataFormGrid,
  MasterDataFormField,
  MasterDataFieldLabel,
} from '../components/ui/master-data-ui';
import { Switch } from '../components/ui/switch';
import {
  formatLeadSocialHandle,
  getLeadSocialPlatformLabel,
  getLeadSocialPrimaryActionLabel,
  normalizeLeadSocialFields,
  resolveLeadSocialPrimaryUrl,
} from './leads/socialContact';
import { ProspectBookingForm } from './leads/ProspectBookingForm';

const WhatsappIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
)

const AUTO_WHATSAPP_LEAD_ORIGIN = 'auto_wa_api';

const isAutoWhatsAppLead = (lead: Pick<Lead, 'origin' | 'lastContact' | 'notes'>) => (
  lead.origin === AUTO_WHATSAPP_LEAD_ORIGIN ||
  lead.lastContact === 'Auto WA API' ||
  Boolean(lead.notes?.toLowerCase().includes('auto wa api'))
);

const AutoWhatsAppLeadBadge = ({ lead, className }: { lead: Lead; className?: string }) => (
  isAutoWhatsAppLead(lead) ? (
    <Badge
      variant="outline"
      className={`h-5 rounded border-emerald-200 bg-emerald-50 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300 ${className || ''}`}
    >
      Auto WA API
    </Badge>
  ) : null
);

const LEAD_TEMPLATE_TITLE_ORDER = [
  'salam pertama',
  'sapaan awal',
  'follow up penawaran',
  'upsell',
  'upsel',
];

const getLeadTemplateOrder = (template: WATemplate) => {
  const title = template.title.trim().toLowerCase();
  const index = LEAD_TEMPLATE_TITLE_ORDER.findIndex((keyword) => title.includes(keyword));
  return index === -1 ? 90 : index;
};

const sortLeadTemplatesForDisplay = (left: WATemplate, right: WATemplate) => {
  const leftOrder = getLeadTemplateOrder(left);
  const rightOrder = getLeadTemplateOrder(right);

  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  return left.title.localeCompare(right.title, 'id-ID', { sensitivity: 'base' });
};

export const Prospek = ({ onNavigate }: { onNavigate?: (page: string) => void }) => {
  const {
    leads,
    prospectBookings,
    platforms,
    subChannels,
    vehicles,
    users,
    addLead,
    updateLead,
    deleteLead,
    addProspectBooking,
    updateProspectBooking,
    currentUser,
    currentRole,
    waTemplates,
    updateWATemplate,
  } = useMasterData();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Lead | null>(null);
  const [leadFormInstanceKey, setLeadFormInstanceKey] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [forwardLead, setForwardLead] = useState<Lead | null>(null);
  const [bookingLead, setBookingLead] = useState<Lead | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [advertiserFilter, setAdvertiserFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [subChannelFilter, setSubChannelFilter] = useState<string>('all');
  const [csFilter, setCsFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date()
  });
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // Pagination & Selection State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSelection, setShowSelection] = useState(false);

  // Bulk Edit State
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkField, setBulkField] = useState<string>('');
  const [bulkValue, setBulkValue] = useState<string>('');

  // WA Template Selection State
  const [selectedWaLead, setSelectedWaLead] = useState<Lead | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);

  const activePlatforms = useMemo(() => platforms.filter(p => p.status === 'active'), [platforms]);
  const activeVehicles = useMemo(() => vehicles.filter(v => v.status === 'active'), [vehicles]);
  const advertiserUsers = useMemo(() => users.filter((u) => isAdvertiserRole(u.role) && u.status === 'active'), [users]);
  const csUsers = useMemo(() => users.filter((u) => isCsRole(u.role) && u.status === 'active'), [users]);
  const isAdvertiserView = isAdvertiserRole(currentRole);
  const isAdminManagementUser = isAdminManagementRole(currentRole);
  const isOwnerLikeUser = isOwnerLikeRole(currentRole);
  const isCsUser = isCsRole(currentRole);

  // --- ROLE BASED DATA VISIBILITY ---
  const roleBasedLeads = useMemo(() => {
    if (!currentUser) return [];
    if (isAdminManagementUser) return leads;
    if (isCsUser) return leads.filter(l => l.csId === currentUser.id);
    if (isAdvertiserView) {
        const subordinateCsIds = users.filter(u => u.parentUserId === currentUser.id).map(u => u.id);
        return leads.filter(l => l.advertiserId === currentUser.id || (l.csId && subordinateCsIds.includes(l.csId)));
    }
    return []; 
  }, [currentUser, isAdminManagementUser, isAdvertiserView, isCsUser, leads, users]);

  // --- DYNAMIC FILTERS (Based on Actual Data) ---
  const availableAdvertisers = useMemo(() => {
      const uniqueIds = new Set(roleBasedLeads.map(l => l.advertiserId).filter(Boolean));
      return users.filter(u => uniqueIds.has(u.id));
  }, [roleBasedLeads, users]);

  const availablePlatforms = useMemo(() => {
      const uniqueIds = new Set(roleBasedLeads.map(l => l.platformId).filter(Boolean));
      return platforms.filter(p => uniqueIds.has(p.id));
  }, [roleBasedLeads, platforms]);

  const availableSubChannels = useMemo(() => {
      const uniqueIds = new Set(roleBasedLeads.map(l => l.subChannelId).filter(Boolean));
      let relevant = subChannels.filter(sc => uniqueIds.has(sc.id));
      if (platformFilter !== 'all') {
          relevant = relevant.filter(sc => sc.platformId === platformFilter);
      }
      return relevant;
  }, [roleBasedLeads, subChannels, platformFilter]);

  const availableCS = useMemo(() => {
      const uniqueIds = new Set(roleBasedLeads.map(l => l.csId).filter(Boolean));
      return users.filter(u => uniqueIds.has(u.id));
  }, [roleBasedLeads, users]);

  // Prospek only shows templates from the Prospek/Leads category.
  const leadTemplates = useMemo(() => {
      return waTemplates
        .filter(t => t.category === 'Leads')
        .sort(sortLeadTemplatesForDisplay);
  }, [waTemplates]);

  const latestBookingByLeadId = useMemo(() => {
    const sortedBookings = [...prospectBookings].sort((left, right) => {
      const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
      const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
      return rightTime - leftTime;
    });

    const map = new Map<string, ProspectBooking>();
    sortedBookings.forEach((booking) => {
      if (!map.has(booking.leadId)) {
        map.set(booking.leadId, booking);
      }
    });
    return map;
  }, [prospectBookings]);

  const activeBookingByLeadId = useMemo(() => {
    const sortedBookings = [...prospectBookings].sort((left, right) => {
      const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
      const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
      return rightTime - leftTime;
    });

    const map = new Map<string, ProspectBooking>();
    sortedBookings.forEach((booking) => {
      const isActive = booking.status !== 'cancelled' && !booking.orderId;
      if (isActive && !map.has(booking.leadId)) {
        map.set(booking.leadId, booking);
      }
    });
    return map;
  }, [prospectBookings]);

  const getPlatformName = (id?: string) => {
    if (!id) return '-';
    return platforms.find(p => p.id === id)?.name || '-';
  };

  const getVehicleName = (id?: string) => {
    if (!id) return '-';
    return vehicles.find(v => v.id === id)?.name || '-';
  };

  const getCSName = (id?: string) => {
    if (!id) return '-';
    return users.find(u => u.id === id)?.name || 'Unknown';
  }

  const getSubChannelName = (id?: string) => {
    if (!id) return '-';
    return subChannels.find(sc => sc.id === id)?.name || '-';
  };

  const getLeadBooking = (leadId: string) => latestBookingByLeadId.get(leadId);
  const getActiveLeadBooking = (leadId: string) => activeBookingByLeadId.get(leadId);

  const getBookingSummary = (leadId: string) => {
    const booking = getLeadBooking(leadId);
    if (!booking?.scheduleDate || !booking?.scheduleTime) return null;
    return `${format(new Date(booking.scheduleDate), 'dd MMM yyyy')} • ${booking.scheduleTime}`;
  };

  const getBookingStatusLabel = (booking?: ProspectBooking | null) => {
    switch (booking?.status) {
      case 'confirmed':
        return 'Confirmed';
      case 'reschedule':
        return 'Reschedule';
      case 'cancelled':
        return 'Cancelled';
      case 'tentative':
      default:
        return 'Tentative';
    }
  };

  const openBookingForm = (lead: Lead) => {
    if (lead.status === 'Closing') {
      toast.info('Prospek yang sudah Closing tidak bisa dibuat booking lagi');
      return;
    }
    setBookingLead(lead);
  };

  const openAddLeadForm = () => {
    setEditingItem(null);
    setLeadFormInstanceKey(prev => prev + 1);
    setIsAddOpen(true);
  };

  const openEditLeadForm = (lead: Lead) => {
    setEditingItem(lead);
    setLeadFormInstanceKey(prev => prev + 1);
    setIsAddOpen(true);
  };

  const handleAddSheetOpenChange = (open: boolean) => {
    setIsAddOpen(open);
    if (!open) {
      setEditingItem(null);
    }
  };

  const getLeadSocialHandle = (lead: Lead) => formatLeadSocialHandle(lead.socialUsername);

  const getLeadSocialUrl = (lead: Lead) => resolveLeadSocialPrimaryUrl(lead);

  const normalizeLeadNotes = (notes?: string) => notes?.replace(/\s+/g, ' ').trim() || '';

  const getLeadNotesPreview = (notes?: string, maxLength = 96) => {
    const normalizedNotes = normalizeLeadNotes(notes);
    if (!normalizedNotes) return '-';
    if (normalizedNotes.length <= maxLength) return normalizedNotes;
    return `${normalizedNotes.slice(0, maxLength).trimEnd()}...`;
  };

  const handleLeadSocialOpen = (lead: Lead) => {
    const targetUrl = getLeadSocialUrl(lead);

    if (!targetUrl) {
      toast.error('Kontak sosial belum lengkap', {
        description: 'Isi username atau link sosial buyer terlebih dahulu.',
      });
      return;
    }

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleLeadSocialCopy = async (lead: Lead) => {
    const handle = getLeadSocialHandle(lead);

    if (!handle) {
      toast.error('Username sosial belum tersedia');
      return;
    }

    await copyToClipboard(handle, {
      successMessage: 'Username sosial berhasil disalin',
      description: getLeadSocialPlatformLabel(lead.socialPlatform) || 'Kontak sosial buyer',
    });
  };

  // --- WA LOGIC ---
  const handleWhatsappClick = (lead: Lead, template?: WATemplate) => {
    const phone = lead.phone.replace(/^0/, '62').replace(/\D/g, '');
    let message = "";

    if (template) {
        message = template.message;
        message = message.replace(/\[Nama\]/g, lead.name);
        const vehicleName = getVehicleName(lead.vehicleId);
        message = message.replace(/\[Mobil\]/g, vehicleName !== '-' ? vehicleName : 'mobil');
        message = message.replace(/\[Order ID\]/g, `\`\`\`${lead.id}\`\`\``);
        
        const newHistory = {
            templateId: template.id,
            templateName: template.title,
            sentAt: new Date().toISOString(),
            sentBy: currentUser?.id
        };
        
        const updatedLead = {
            ...lead,
            templateHistory: [...(lead.templateHistory || []), newHistory],
            lastContact: 'Baru saja'
        };
        
        updateLead(updatedLead);
        setDetailLead((current) => (current?.id === lead.id ? updatedLead : current));
        setSelectedWaLead((current) => (current?.id === lead.id ? updatedLead : current));

        // Increment usage count
        updateWATemplate({ 
            ...template, 
            usage_count: (template.usage_count || 0) + 1 
        });
    }

    const url = `https://wa.me/${phone}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
    window.open(url, '_blank');
  };

  const isTemplateUsed = (lead: Lead, templateId: string) => {
      return lead.templateHistory?.some(h => h.templateId === templateId);
  };

  const getTemplateUsageCount = (lead: Lead, templateId: string) => (
    lead.templateHistory?.filter((history) => history.templateId === templateId).length || 0
  );

  const getLatestTemplateHistory = (lead: Lead, templateId: string) => (
    [...(lead.templateHistory || [])]
      .filter((history) => history.templateId === templateId)
      .sort((left, right) => new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime())[0]
  );

  const formatTemplateSentAt = (sentAt?: string) => {
    if (!sentAt) return '';
    try {
      return new Date(sentAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return sentAt;
    }
  };

  const getTemplateSenderName = (sentBy?: string) => {
    if (!sentBy) return '-';
    return users.find((user) => user.id === sentBy)?.name || '-';
  };

  const visibleFollowUpTemplates = leadTemplates.slice(0, 4);
  const hiddenFollowUpTemplateCount = Math.max(leadTemplates.length - visibleFollowUpTemplates.length, 0);
  const canSendLeadTemplate = !isAdvertiserView && (isAdminManagementUser || isCsUser || isOwnerLikeUser);

  // --- PERMISSION LOGIC ---
  const canEditLead = (lead: Lead) => {
    if (!hasPermission('leads.edit')) return false;
    if (lead.status === 'Closing' && !isOwnerLikeUser) return false;
    return roleBasedLeads.some(item => item.id === lead.id);
  };

  const canDeleteLead = (lead: Lead) => {
    if (!hasPermission('leads.delete')) return false;
    if (lead.status === 'Closing' && !isOwnerLikeUser) return false;
    return roleBasedLeads.some(item => item.id === lead.id);
  };
  
  // --- ORDER GENERATION LOGIC ---
  const handleBookingSubmit = async (booking: ProspectBooking) => {
    if (bookingLead?.status === 'Closing') {
      toast.error('Booking tidak bisa disimpan karena prospek sudah Closing');
      setBookingLead(null);
      return;
    }

    const existingBooking = prospectBookings.find(item => item.id === booking.id);

    try {
      if (existingBooking) {
        await updateProspectBooking(booking);
        toast.success('Booking prospek berhasil diperbarui');
      } else {
        await addProspectBooking(booking);
        toast.success('Booking prospek berhasil dibuat');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Booking prospek gagal disimpan');
      return;
    }

    if (bookingLead) {
      if (booking.status === 'cancelled') {
        if (bookingLead.status === 'Booking') {
          await updateLead({ ...bookingLead, status: 'Pending' });
        }
      } else if (bookingLead.status !== 'Booking') {
        await updateLead({ ...bookingLead, status: 'Booking' });
      }
    }

    setBookingLead(null);
  };

  const handleCancelLeadBooking = async (lead: Lead, booking?: ProspectBooking | null) => {
    const targetBooking = booking ?? getActiveLeadBooking(lead.id);

    if (!targetBooking) {
      toast.error('Booking aktif tidak ditemukan');
      return;
    }

    if (targetBooking.status === 'cancelled') {
      toast.info('Booking ini sudah dibatalkan');
      if (bookingLead?.id === lead.id) setBookingLead(null);
      return;
    }

    await updateProspectBooking({
      ...targetBooking,
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    });

    if (lead.status === 'Booking') {
      await updateLead({ ...lead, status: 'Pending' });
    }

    toast.success('Booking prospek dibatalkan dan dihapus dari jadwal');

    if (bookingLead?.id === lead.id) {
      setBookingLead(null);
    }
  };

  const handleOrderSuccess = async (order?: Order) => {
    if (forwardLead) {
       const activeBooking = getActiveLeadBooking(forwardLead.id);

       if (activeBooking && order?.id) {
         await updateProspectBooking({
           ...activeBooking,
           orderId: order.id,
           status: activeBooking.status === 'cancelled' ? 'cancelled' : 'confirmed',
           updatedAt: new Date().toISOString(),
         });
       }

       await updateLead({ ...forwardLead, status: 'Closing' });

       setForwardLead(null);
       if (onNavigate) {
           onNavigate('orders');
       }
    }
  };

  const activeForwardBooking = forwardLead ? getActiveLeadBooking(forwardLead.id) : undefined;
  const selectedLeadBooking = bookingLead ? getActiveLeadBooking(bookingLead.id) : undefined;

  // --- FILTERING BASE (All filters EXCEPT Status) ---
  const filteredLeadsBase = useMemo(() => {
    return roleBasedLeads.filter(item => {
      const platformName = getPlatformName(item.platformId);
      const vehicleName = getVehicleName(item.vehicleId);
      const csName = getCSName(item.csId);
      const socialHandle = getLeadSocialHandle(item);
      const socialPlatformLabel = getLeadSocialPlatformLabel(item.socialPlatform);
      const socialSearchableLink = [item.socialProfileUrl, item.socialChatUrl].filter(Boolean).join(' ');
      const originLabel = isAutoWhatsAppLead(item) ? 'auto wa api whatsapp otomatis' : '';

      const matchesSearch = 
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.phone.toLowerCase().includes(search.toLowerCase()) ||
        platformName.toLowerCase().includes(search.toLowerCase()) ||
        vehicleName.toLowerCase().includes(search.toLowerCase()) ||
        csName.toLowerCase().includes(search.toLowerCase()) ||
        socialHandle.toLowerCase().includes(search.toLowerCase()) ||
        socialPlatformLabel.toLowerCase().includes(search.toLowerCase()) ||
        socialSearchableLink.toLowerCase().includes(search.toLowerCase()) ||
        originLabel.includes(search.toLowerCase());
      
      const matchesAdvertiser = advertiserFilter === 'all' || item.advertiserId === advertiserFilter;
      const matchesPlatform = platformFilter === 'all' || item.platformId === platformFilter;
      const matchesSubChannel = subChannelFilter === 'all' || item.subChannelId === subChannelFilter;
      const matchesCS = csFilter === 'all' || item.csId === csFilter;

      let matchesDate = true;
      if (dateRange?.from) {
        const itemDate = new Date(item.timestamp);
        const start = startOfDay(dateRange.from);
        const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        matchesDate = isWithinInterval(itemDate, { start, end });
      }

      return matchesSearch && matchesAdvertiser && matchesPlatform && matchesSubChannel && matchesDate && matchesCS;
    });
  }, [roleBasedLeads, search, advertiserFilter, platformFilter, subChannelFilter, csFilter, dateRange, platforms, vehicles, users]);

  // --- FINAL FILTERED DATA (Includes Status) ---
  const filteredData = useMemo(() => {
      return filteredLeadsBase.filter(item => {
           return statusFilter === 'all' || item.status === statusFilter;
      });
  }, [filteredLeadsBase, statusFilter]);

  // Reset page when filters change
  useEffect(() => {
      setCurrentPage(1);
      setSelectedIds(new Set());
  }, [filteredData]);

  useEffect(() => {
      if (!showSelection) {
          setSelectedIds(new Set());
      }
  }, [showSelection]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedLeads = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const selectedOnPageCount = useMemo(() => {
      return paginatedLeads.filter((lead) => selectedIds.has(lead.id)).length;
  }, [paginatedLeads, selectedIds]);

  const allPageSelected = paginatedLeads.length > 0 && selectedOnPageCount === paginatedLeads.length;

  const isDefaultDateRange = Boolean(
      dateRange?.from &&
      !dateRange?.to &&
      startOfDay(dateRange.from).getTime() === startOfDay(new Date()).getTime()
  ) || Boolean(
      dateRange?.from &&
      dateRange?.to &&
      startOfDay(dateRange.from).getTime() === startOfDay(new Date()).getTime() &&
      startOfDay(dateRange.to).getTime() === startOfDay(new Date()).getTime()
  );

  const hasActiveFilters = Boolean(
      search ||
      statusFilter !== 'all' ||
      advertiserFilter !== 'all' ||
      platformFilter !== 'all' ||
      subChannelFilter !== 'all' ||
      csFilter !== 'all' ||
      !isDefaultDateRange
  );

  const resetFilters = () => {
      setSearch('');
      setStatusFilter('all');
      setAdvertiserFilter('all');
      setCsFilter('all');
      setPlatformFilter('all');
      setSubChannelFilter('all');
      setDateRange({ from: new Date(), to: new Date() });
  };

  const handleSelectAll = (checked: boolean) => {
      if (checked) {
          const newSelected = new Set(selectedIds);
          paginatedLeads.forEach(l => newSelected.add(l.id));
          setSelectedIds(newSelected);
      } else {
          const newSelected = new Set(selectedIds);
          paginatedLeads.forEach(l => newSelected.delete(l.id));
          setSelectedIds(newSelected);
      }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
      const newSelected = new Set(selectedIds);
      if (checked) newSelected.add(id);
      else newSelected.delete(id);
      setSelectedIds(newSelected);
  };

  const [isMassDeleteOpen, setIsMassDeleteOpen] = useState(false);

  const handleMassDelete = () => {
      setIsMassDeleteOpen(true);
  };

  const confirmMassDelete = async () => {
      const ids = Array.from(selectedIds);
      const results = await Promise.allSettled(ids.map(id => deleteLead(id, { silent: true })));
      const successCount = results.filter(result => result.status === 'fulfilled').length;
      const failedIds = ids.filter((_, index) => results[index].status === 'rejected');

      setSelectedIds(new Set(failedIds));

      if (successCount > 0) {
        toast.success(`${successCount} prospek berhasil dihapus`);
        if (currentUser) {
          logActivity(
            { id: currentUser.id, name: currentUser.name, role: currentUser.role },
            'DELETE',
            'Prospek',
            `Menghapus ${successCount} prospek secara massal`,
            '',
            { count: successCount }
          );
        }
      }

      if (failedIds.length > 0) {
        toast.error(`Gagal menghapus ${failedIds.length} prospek`);
      }

      setIsMassDeleteOpen(false);
  };

  const handleBulkUpdate = async () => {
      if (!bulkField || !bulkValue) {
          toast.error("Mohon pilih field dan nilai yang akan diupdate");
          return;
      }
      
      const toastId = toast.loading(`Mengupdate ${selectedIds.size} prospek...`);
      
      try {
        let successCount = 0;
        const selectedLeads = leads.filter(l => selectedIds.has(l.id));
        
        for (const lead of selectedLeads) {
             const updates: any = {};
             if (bulkField === 'status') updates.status = bulkValue;
             else if (bulkField === 'csId') updates.csId = bulkValue;
             else if (bulkField === 'advertiserId') updates.advertiserId = bulkValue;
             else if (bulkField === 'platformId') updates.platformId = bulkValue;
             else if (bulkField === 'vehicleId') updates.vehicleId = bulkValue;

             // @ts-ignore
             await updateLead({ ...lead, ...updates });
             successCount++;
        }
        
        toast.dismiss(toastId);
        toast.success(`${successCount} prospek berhasil diperbarui`);
        if (currentUser) {
          logActivity(
            { id: currentUser.id, name: currentUser.name, role: currentUser.role },
            'UPDATE',
            'Prospek',
            `Memperbarui ${successCount} prospek secara massal`,
            '',
            { count: successCount, field: bulkField }
          );
        }
        setIsBulkEditOpen(false);
        setBulkField('');
        setBulkValue('');
        setSelectedIds(new Set());
      } catch (error) {
        console.error(error);
        toast.error("Terjadi kesalahan saat update massal");
      }
  };

  // Statistics
  const stats = useMemo(() => {
    // User requested stats to reflect ALL filters including Status
    const data = filteredData;
    const total = data.length;
    const pending = data.filter(l => l.status === 'Pending').length;
    const closing = data.filter(l => l.status === 'Closing').length;
    const autoWhatsApp = data.filter(isAutoWhatsAppLead).length;
    const conversionRate = total > 0 ? ((closing / total) * 100).toFixed(1) : '0.0';
    return { total, pending, closing, autoWhatsApp, conversionRate };
  }, [filteredData]);

  // Access Control
  if (!hasPermission('leads.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-center p-8">
        <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-full mb-4">
           <svg className="w-12 h-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
           </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Akses Ditolak</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md">
          Anda tidak memiliki izin untuk mengakses halaman Prospek.
        </p>
      </div>
    );
  }

  const handleSubmit = (formData: any) => {
    // Sanitize foreign keys: convert "none_*" and empty strings to undefined
    if (formData.advertiserId === "none_advertiser" || formData.advertiserId === "") formData.advertiserId = undefined;
    if (formData.platformId === "none_platform" || formData.platformId === "") formData.platformId = undefined;
    if (formData.subChannelId === "none_subchannel" || formData.subChannelId === "") formData.subChannelId = undefined;
    if (formData.vehicleId === "none_vehicle" || formData.vehicleId === "") formData.vehicleId = undefined;
    if (formData.csId === "none_cs" || formData.csId === "") formData.csId = undefined;

    const normalizedSocialFields = normalizeLeadSocialFields(formData);
    Object.assign(formData, normalizedSocialFields);

    if (editingItem) {
      updateLead({ ...editingItem, ...formData });
      toast.success("Prospek berhasil diperbarui");
      if (currentUser) {
        logActivity(
          { id: currentUser.id, name: currentUser.name, role: currentUser.role },
          'UPDATE',
          'Prospek',
          `Memperbarui prospek: ${formData.name || editingItem.name}`,
          editingItem.id,
          { status: formData.status }
        );
      }
    } else {
      // Generate 7-char random ID (Uppercase + Numbers)
      const generateShortId = () => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let result = '';
          for (let i = 0; i < 7; i++) {
              result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
      };

      const newItem: Lead = {
        id: generateShortId(),
        timestamp: new Date().toISOString(), 
        lastContact: 'Baru saja',
        ...formData
      };
      console.log("Submitting new lead:", newItem); // Debug log
      try {
          addLead(newItem);
          toast.success("Prospek berhasil ditambahkan");
          if (currentUser) {
            logActivity(
              { id: currentUser.id, name: currentUser.name, role: currentUser.role },
              'CREATE',
              'Prospek',
              `Menambahkan prospek baru: ${newItem.name}`,
              newItem.id,
              { platform: formData.platformId }
            );
          }
      } catch (err) {
          console.error("Error submitting lead:", err);
          toast.error("Gagal menambahkan prospek");
      }
    }
    setIsAddOpen(false);
    setEditingItem(null);
  };

  const confirmDelete = async () => {
    if (deleteId) {
      const leadToDelete = leads.find(l => l.id === deleteId);
      try {
        await deleteLead(deleteId, { silent: true });
        toast.success("Prospek berhasil dihapus");
        if (currentUser && leadToDelete) {
          logActivity(
            { id: currentUser.id, name: currentUser.name, role: currentUser.role },
            'DELETE',
            'Prospek',
            `Menghapus prospek: ${leadToDelete.name}`,
            deleteId
          );
        }
        setDeleteId(null);
      } catch (error: any) {
        toast.error(`Gagal menghapus prospek: ${error.message || 'Terjadi kesalahan'}`);
      }
    }
  };

  const getStatusBadgeVariant = (status: LeadStatus) => {
    switch (status) {
      case 'Pending': return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case 'Follow Up': return "bg-blue-50 text-blue-700 border-blue-200";
      case 'Booking': return "bg-violet-50 text-violet-700 border-violet-200";
      case 'Closing': return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case 'Cancel': return "bg-red-50 text-red-700 border-red-200";
      default: return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  // Kanban Component (Memoized View)
  const kanbanView = useMemo(() => {
    const stages: LeadStatus[] = ['Pending', 'Follow Up', 'Booking', 'Closing', 'Cancel'];

    return (
      <div className="leadKanbanBoard" aria-label="Board follow up prospek">
        {stages.map((stage) => {
          const items = filteredData.filter((item) => item.status === stage);

          return (
            <section key={stage} className="leadKanbanColumn" aria-label={`Kolom ${stage}`}>
              <div className="leadKanbanColumnHeader">
                <div className="leadKanbanColumnTitle">
                  <Badge className={`leadStatusBadge ${getStatusBadgeVariant(stage)}`} variant="outline">
                    {stage}
                  </Badge>
                  <span className="leadKanbanCount">{items.length}</span>
                </div>
              </div>

              <div className="leadKanbanList">
                {items.length === 0 ? (
                  <div className="leadKanbanEmpty">
                    <strong>Belum ada prospek</strong>
                    <span>Tidak ada data pada status ini.</span>
                  </div>
                ) : items.map((item) => {
                  const booking = getLeadBooking(item.id);
                  const activeBooking = getActiveLeadBooking(item.id);
                  const socialHandle = getLeadSocialHandle(item);
                  const socialUrl = getLeadSocialUrl(item);

                  return (
                    <article
                      key={item.id}
                      className="leadKanbanCard"
                      role="button"
                      tabIndex={0}
                      onClick={() => setDetailLead(item)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setDetailLead(item);
                        }
                      }}
                    >
                      <div className="leadKanbanCardHeader">
                        <div className="leadKanbanCardTitle">
                          <div className="leadKanbanNameRow">
                            <h4>{item.name}</h4>
                            <AutoWhatsAppLeadBadge lead={item} className="shrink-0" />
                          </div>
                          {!isAdvertiserView && <span className="leadKanbanPhone">{item.phone}</span>}
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="leadKanbanMoreButton"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                            {canEditLead(item) && (
                              <DropdownMenuItem onClick={() => openEditLeadForm(item)}>Edit</DropdownMenuItem>
                            )}
                            {item.status !== 'Closing' && (
                              <DropdownMenuItem onClick={() => openBookingForm(item)}>
                                Booking Jadwal
                              </DropdownMenuItem>
                            )}
                            {item.status !== 'Closing' && activeBooking && (
                              <DropdownMenuItem onClick={() => void handleCancelLeadBooking(item, activeBooking)}>
                                <Ban className="w-4 h-4 mr-2" /> Batalkan Booking
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => { setForwardLead(item); }}>Proses Order</DropdownMenuItem>
                            {canEditLead(item) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel>Ubah Status</DropdownMenuLabel>
                                {stages.filter((targetStage) => targetStage !== stage).map((targetStage) => (
                                  <DropdownMenuItem key={targetStage} onClick={() => updateLead({ ...item, status: targetStage })}>
                                    Pindah ke {targetStage}
                                  </DropdownMenuItem>
                                ))}
                              </>
                            )}
                            {canDeleteLead(item) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setDeleteId(item.id)} className="text-red-600">
                                  <Trash2 className="w-4 h-4 mr-2" /> Hapus
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="leadKanbanMetaGrid">
                        <div className="leadKanbanMetaPill">
                          <span>Sumber</span>
                          <strong>{isAutoWhatsAppLead(item) ? 'WhatsApp' : item.platformId ? getPlatformName(item.platformId) : '-'}</strong>
                        </div>
                        <div className="leadKanbanMetaPill">
                          <span>Mobil</span>
                          <strong>{getVehicleName(item.vehicleId)}</strong>
                        </div>
                      </div>

                      {item.notes && (
                        <p className="leadKanbanNote" title={normalizeLeadNotes(item.notes)}>
                          {getLeadNotesPreview(item.notes, 118)}
                        </p>
                      )}

                      {booking && (
                        <div className="leadKanbanBooking" title={getBookingSummary(item.id)}>
                          <strong>Booking {getBookingStatusLabel(booking)}</strong>
                          <span>{getBookingSummary(item.id)}</span>
                        </div>
                      )}

                      {!isAdvertiserView && socialHandle && (
                        <div className="leadKanbanSocial">
                          {item.socialPlatform && <span>{getLeadSocialPlatformLabel(item.socialPlatform)}</span>}
                          <strong>{socialHandle}</strong>
                        </div>
                      )}

                      <div className="leadKanbanFooter">
                        <div className="leadKanbanOwner">
                          <UserIcon className="h-3.5 w-3.5" />
                          <span>{getCSName(item.csId)}</span>
                        </div>
                        <time dateTime={item.timestamp}>
                          {new Date(item.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </time>
                      </div>

                      {!isAdvertiserView && (
                        <div className="leadKanbanActions" onClick={(event) => event.stopPropagation()}>
                          <div className="leadKanbanFollowUps" aria-label="Template follow up">
                            {visibleFollowUpTemplates.length > 0 ? visibleFollowUpTemplates.map((template) => {
                              const usageCount = getTemplateUsageCount(item, template.id);
                              const latestHistory = getLatestTemplateHistory(item, template.id);
                              const isUsed = usageCount > 0;
                              const tooltipText = isUsed
                                ? `${template.title} sudah dipakai ${usageCount}x${latestHistory ? ` · ${formatTemplateSentAt(latestHistory.sentAt)}` : ''}`
                                : `${template.title} belum dipakai`;

                              return (
                                <Tooltip key={template.id}>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className={`leadFollowUpButton ${isUsed ? 'isUsed' : ''}`}
                                      disabled={!canSendLeadTemplate}
                                      onClick={() => {
                                        if (!canSendLeadTemplate) return;
                                        handleWhatsappClick(item, template);
                                      }}
                                      aria-label={tooltipText}
                                    >
                                      {isUsed ? <CheckCircle2 className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="leadFollowUpTooltip">
                                    <div>
                                      <strong>{template.title}</strong>
                                      <span>{isUsed ? `Dipakai ${usageCount}x` : 'Belum dipakai'}</span>
                                      {latestHistory && <small>{formatTemplateSentAt(latestHistory.sentAt)} · {getTemplateSenderName(latestHistory.sentBy)}</small>}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            }) : (
                              <span className="leadFollowUpEmpty">-</span>
                            )}
                            {hiddenFollowUpTemplateCount > 0 && (
                              <button
                                type="button"
                                className="leadFollowUpMore"
                                disabled={!canSendLeadTemplate}
                                onClick={() => {
                                  if (!canSendLeadTemplate) return;
                                  setSelectedWaLead(item);
                                }}
                                aria-label={`Lihat ${hiddenFollowUpTemplateCount} template lain`}
                              >
                                +{hiddenFollowUpTemplateCount}
                              </button>
                            )}
                          </div>

                          <div className="leadKanbanQuickActions">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="leadKanbanQuickButton"
                              onClick={() => setSelectedWaLead(item)}
                              aria-label="Buka template WhatsApp"
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                            {socialUrl && (
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="leadKanbanQuickButton"
                                onClick={() => handleLeadSocialOpen(item)}
                                aria-label={getLeadSocialPrimaryActionLabel(item)}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                            {socialHandle && (
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="leadKanbanQuickButton"
                                onClick={() => void handleLeadSocialCopy(item)}
                                aria-label="Salin kontak sosial"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    );
  }, [filteredData, updateLead, getStatusBadgeVariant, isAdvertiserView, visibleFollowUpTemplates, hiddenFollowUpTemplateCount, canSendLeadTemplate]);

  return (
    <OperationalPageShell>
      <div className="flex flex-col space-y-4">
        <OperationalPageHeader
          eyebrow="Operasional"
          icon={UserIcon}
          title="Kotak Masuk Prospek"
          subtitle="Kelola leads, follow up, booking awal, dan konversi menjadi pesanan."
          actions={
            <div className="leadHeaderActions">
                 {hasPermission('leads.create') && (
                  <>
                    <Button
                      size="sm"
                      aria-label="Tambah prospek"
                      className="leadAddIconButton"
                      onClick={() => {
                        openAddLeadForm();
                      }}
                    >
                      <Plus className="h-5 w-5" />
                    </Button>

                    <Button
                      className="leadAddButton"
                      icon={<Plus className="h-4 w-4" />}
                      onClick={() => {
                        openAddLeadForm();
                      }}
                    >
                      Tambah Prospek
                    </Button>
                  </>
                 )}
            </div>
          }
        />

        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'list' | 'kanban')} className="masterDataTabsShell leadViewTabsShell">
          <TabsViewport>
            <TabsRail className="masterDataTabs leadViewTabs">
              <TabsTrigger value="list" className="masterDataTab leadViewTab">
                <LayoutList className="h-4 w-4" />
              <span>List Prospek</span>
              </TabsTrigger>
              <TabsTrigger value="kanban" className="masterDataTab leadViewTab">
                <KanbanSquare className="h-4 w-4" />
                <span>Board Follow Up</span>
              </TabsTrigger>
            </TabsRail>
          </TabsViewport>
        </Tabs>

        {/* Stats Cards */}
        <OperationalKpiGrid>
          <OperationalKpiCard label="Total" value={stats.total} icon={UserIcon} />
          <OperationalKpiCard label="Pending" value={stats.pending} icon={CalendarClock} tone="amber" />
          <OperationalKpiCard label="Closing" value={stats.closing} icon={CheckCircle2} tone="emerald" />
          <OperationalKpiCard label="Auto WA" value={stats.autoWhatsApp} icon={MessageCircle} tone="emerald" />
          <OperationalKpiCard label="Conversion Rate" value={`${stats.conversionRate}%`} icon={ArrowRightCircle} tone="blue" />
        </OperationalKpiGrid>


        <OperationalFilterPanel className="leadFilterPanel">
          <div className="leadFilterGrid">
            <div className="leadFilterDate leadFilterItem">
              <PeriodFilterPicker
                date={dateRange}
                setDate={setDateRange}
                className="leadPeriodPicker"
                contentClassName="leadPeriodPopover"
                triggerLabelMode="compact"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="leadFilterControl leadFilterItem">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                {['Pending', 'Follow Up', 'Booking', 'Closing', 'Cancel'].map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={platformFilter} onValueChange={(val) => {
              setPlatformFilter(val);
              setSubChannelFilter('all');
            }}>
              <SelectTrigger className="leadFilterControl leadFilterItem">
                <SelectValue placeholder="Semua Sumber" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Sumber</SelectItem>
                {availablePlatforms.map(platform => (
                  <SelectItem key={platform.id} value={platform.id}>{platform.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={subChannelFilter} onValueChange={setSubChannelFilter}>
              <SelectTrigger className="leadFilterControl leadFilterItem">
                <SelectValue placeholder="Semua Sub Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Sub Channel</SelectItem>
                {availableSubChannels.map(sc => (
                  <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(isAdminManagementUser || isAdvertiserView) && (
              <Select value={csFilter} onValueChange={setCsFilter}>
                <SelectTrigger className="leadFilterControl leadFilterItem">
                  <SelectValue placeholder="Semua CS" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua CS</SelectItem>
                  {availableCS.map((user) => (
                    <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {!isAdvertiserView && (
              <Select value={advertiserFilter} onValueChange={setAdvertiserFilter}>
                <SelectTrigger className="leadFilterControl leadFilterItem">
                  <SelectValue placeholder="Semua Advertiser" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Advertiser</SelectItem>
                  {availableAdvertisers.map(user => (
                    <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="leadSearchBox leadFilterItem">
              <Search className="leadSearchIcon" />
              <Input
                placeholder="Cari nama, nomor, platform, atau catatan..."
                className="leadSearchInput"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Button
              type="button"
              variant="outline"
              className="leadResetButton"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
            >
              <RefreshCw className="h-4 w-4" />
              <span>Reset</span>
            </Button>
          </div>
        </OperationalFilterPanel>

        {/* Content Card */}
        {viewMode === 'list' ? (
          <OperationalTableCard className="leadTableCard">
            <div className="leadTableHeader">
              <MasterDataTableTitle title="Data Prospek" count={filteredData.length} icon={UserIcon} />
              <div className="leadTableHeaderActions">
                {showSelection && selectedIds.size > 0 && hasPermission('leads.edit') && (
                  <Button type="button" variant="outline" className="leadBulkButton" onClick={() => setIsBulkEditOpen(true)}>
                    <Edit className="h-4 w-4" />
                    <span>Edit Massal</span>
                  </Button>
                )}
                {showSelection && selectedIds.size > 0 && hasPermission('leads.delete') && (
                  <Button type="button" variant="danger" className="leadBulkDangerButton" onClick={handleMassDelete}>
                    <Trash2 className="h-4 w-4" />
                    <span>Hapus Massal</span>
                  </Button>
                )}
                <label className="leadSelectionSwitch">
                  <Switch checked={showSelection} onCheckedChange={setShowSelection} />
                  <span>Pilih baris</span>
                </label>
              </div>
            </div>

            {showSelection && (
              <div className="leadSelectionToolbar">
                <div>
                  <strong>{selectedIds.size} dipilih</strong>
                  <span>{paginatedLeads.length} data aktif di halaman ini</span>
                </div>
                <div className="leadSelectionToolbarActions">
                  <Button type="button" variant="outline" onClick={() => handleSelectAll(true)}>
                    Pilih semua
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setSelectedIds(new Set())} disabled={selectedIds.size === 0}>
                    Bersihkan
                  </Button>
                </div>
              </div>
            )}

            <DataTable
              className="leadDataTable"
              columns={createDataTableColumns([
                showSelection && { preset: 'checkbox', width: 48, minWidth: 48 },
                { preset: 'number', width: 56, minWidth: 56 },
                { preset: 'date', width: 'clamp(124px, 9vw, 148px)', minWidth: 124 },
                { preset: 'name', width: 'clamp(210px, 16vw, 270px)', minWidth: 210 },
                { preset: 'text', width: 'clamp(174px, 12vw, 220px)', minWidth: 174 },
                { preset: 'text', width: 'clamp(156px, 11vw, 204px)', minWidth: 156 },
                { preset: 'text', width: 'clamp(180px, 13vw, 230px)', minWidth: 180 },
                { preset: 'description', width: 'clamp(222px, 16vw, 286px)', minWidth: 222 },
                { preset: 'status', width: 150, minWidth: 150 },
                { preset: 'compact', width: 176, minWidth: 176, className: 'leadFollowUpColumn' },
                !isAdvertiserView && { preset: 'action', width: 64, minWidth: 64 },
              ])}
              rowMinHeight={84}
              cellY={16}
              textMax={260}
            >
              <table>
                <thead>
                  <tr>
                    {showSelection && (
                      <th className="leadSelectCell">
                        <Checkbox
                          className="leadSoftCheckbox"
                          checked={allPageSelected}
                          onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                        />
                      </th>
                    )}
                    <th>No</th>
                    <th>Waktu</th>
                    <th>Prospek</th>
                    <th>CS / Staff</th>
                    <th>Sumber</th>
                    <th>Mobil</th>
                    <th>Catatan</th>
                    <th>Status</th>
                    <th>Follow Up</th>
                    {!isAdvertiserView && <TableActionHeader />}
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeads.length === 0 ? (
                    <tr>
                      <td colSpan={isAdvertiserView ? (showSelection ? 10 : 9) : (showSelection ? 11 : 10)}>
                        <OperationalEmptyState
                          icon={UserIcon}
                          title="Tidak ada data prospek ditemukan"
                          description="Coba ubah filter, tanggal, atau kata kunci pencarian."
                        />
                      </td>
                    </tr>
                  ) : (
                    paginatedLeads.map((item, index) => {
                      const booking = getLeadBooking(item.id);
                      const socialHandle = getLeadSocialHandle(item);
                      const platformLabel = isAutoWhatsAppLead(item) ? 'WhatsApp' : item.platformId ? getPlatformName(item.platformId) : '-';
                      const subChannelLabel = isAutoWhatsAppLead(item) && !item.subChannelId ? 'Auto API' : getSubChannelName(item.subChannelId);
                      const rowNumber = (currentPage - 1) * itemsPerPage + index + 1;

                      return (
                        <tr
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          className={`leadClickableRow ${selectedIds.has(item.id) ? 'isSelected' : ''}`}
                          onClick={() => setDetailLead(item)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setDetailLead(item);
                            }
                          }}
                        >
                          {showSelection && (
                            <td className="leadSelectCell" onClick={(event) => event.stopPropagation()}>
                              <Checkbox
                                className="leadSoftCheckbox"
                                checked={selectedIds.has(item.id)}
                                onCheckedChange={(checked) => handleSelectRow(item.id, checked as boolean)}
                              />
                            </td>
                          )}
                          <td className="leadNoCell">{rowNumber}</td>
                          <td>
                            <TableText
                              primary={new Date(item.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                              secondary={new Date(item.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            />
                          </td>
                          <td>
                            <div className="leadNameCell">
                              <TableText
                                primary={item.name}
                                secondary={!isAdvertiserView ? item.phone : undefined}
                                title={`${item.name} - ${item.phone}`}
                              />
                              <div className="leadInlineMeta">
                                <AutoWhatsAppLeadBadge lead={item} />
                                {!isAdvertiserView && socialHandle && (
                                  <span title={socialHandle}>
                                    {item.socialPlatform ? getLeadSocialPlatformLabel(item.socialPlatform) : 'Sosial'}: {socialHandle}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <TableText
                              primary={item.csId ? getCSName(item.csId) : '-'}
                              secondary={item.advertiserId ? users.find((user) => user.id === item.advertiserId)?.name : undefined}
                            />
                          </td>
                          <td>
                            <TableText primary={platformLabel} secondary={subChannelLabel} />
                          </td>
                          <td>
                            <TableText primary={getVehicleName(item.vehicleId)} />
                          </td>
                          <td>
                            <TableText
                              primary={getLeadNotesPreview(item.notes, 82)}
                              secondary={item.lastContact ? `Kontak: ${item.lastContact}` : 'Belum ada kontak'}
                              title={normalizeLeadNotes(item.notes)}
                            />
                          </td>
                          <td>
                            <div className="leadStatusStack">
                              <Badge variant="outline" className={`leadStatusBadge ${getStatusBadgeVariant(item.status)}`}>
                                {item.status}
                              </Badge>
                              {booking && (
                                <span className="leadBookingMeta" title={getBookingSummary(item.id)}>
                                  Booking {getBookingStatusLabel(booking)} · {getBookingSummary(item.id)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td onClick={(event) => event.stopPropagation()}>
                            <div className="leadFollowUpCell" aria-label="Template follow up">
                              {visibleFollowUpTemplates.length > 0 ? visibleFollowUpTemplates.map((template) => {
                                const usageCount = getTemplateUsageCount(item, template.id);
                                const latestHistory = getLatestTemplateHistory(item, template.id);
                                const isUsed = usageCount > 0;
                                const tooltipText = isUsed
                                  ? `${template.title} sudah dipakai ${usageCount}x${latestHistory ? ` · ${formatTemplateSentAt(latestHistory.sentAt)}` : ''}`
                                  : `${template.title} belum dipakai`;

                                return (
                                  <Tooltip key={template.id}>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        className={`leadFollowUpButton ${isUsed ? 'isUsed' : ''}`}
                                        disabled={!canSendLeadTemplate}
                                        onClick={() => {
                                          if (!canSendLeadTemplate) return;
                                          handleWhatsappClick(item, template);
                                        }}
                                        aria-label={tooltipText}
                                      >
                                        {isUsed ? <CheckCircle2 className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="leadFollowUpTooltip">
                                      <div>
                                        <strong>{template.title}</strong>
                                        <span>{isUsed ? `Dipakai ${usageCount}x` : 'Belum dipakai'}</span>
                                        {latestHistory && <small>{formatTemplateSentAt(latestHistory.sentAt)} · {getTemplateSenderName(latestHistory.sentBy)}</small>}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              }) : (
                                <span className="leadFollowUpEmpty">-</span>
                              )}
                              {hiddenFollowUpTemplateCount > 0 && (
                                <button
                                  type="button"
                                  className="leadFollowUpMore"
                                  disabled={!canSendLeadTemplate}
                                  onClick={() => {
                                    if (!canSendLeadTemplate) return;
                                    setSelectedWaLead(item);
                                  }}
                                  aria-label={`Lihat ${hiddenFollowUpTemplateCount} template lain`}
                                >
                                  +{hiddenFollowUpTemplateCount}
                                </button>
                              )}
                            </div>
                          </td>
                          {!isAdvertiserView && (
                            <TableActionCell onClick={(event) => event.stopPropagation()}>
                              <TableActionMenu contentClassName="w-56">
                                <TableActionMenuItem icon={Eye} onClick={() => setDetailLead(item)}>
                                  Detail
                                </TableActionMenuItem>
                                {canSendLeadTemplate && (
                                  <TableActionMenuItem icon={Phone} onClick={() => setSelectedWaLead(item)}>
                                    Template WA
                                  </TableActionMenuItem>
                                )}
                                {getLeadSocialUrl(item) && (
                                  <TableActionMenuItem icon={ExternalLink} onClick={() => handleLeadSocialOpen(item)}>
                                    {getLeadSocialPrimaryActionLabel(item)}
                                  </TableActionMenuItem>
                                )}
                                {socialHandle && (
                                  <TableActionMenuItem icon={Copy} onClick={() => void handleLeadSocialCopy(item)}>
                                    Salin Username
                                  </TableActionMenuItem>
                                )}
                                {canEditLead(item) && (
                                  <TableActionMenuItem icon={Edit} onClick={() => openEditLeadForm(item)}>
                                    Edit
                                  </TableActionMenuItem>
                                )}
                                {item.status !== 'Closing' && (
                                  <TableActionMenuItem icon={CalendarClock} onClick={() => openBookingForm(item)}>
                                    Booking Jadwal
                                  </TableActionMenuItem>
                                )}
                                {item.status !== 'Closing' && getActiveLeadBooking(item.id) && (
                                  <TableActionMenuItem icon={Ban} onClick={() => void handleCancelLeadBooking(item, getActiveLeadBooking(item.id))}>
                                    Batalkan Booking
                                  </TableActionMenuItem>
                                )}
                                {item.status !== 'Closing' && (
                                  <TableActionMenuItem icon={ArrowRightCircle} onClick={() => setForwardLead(item)}>
                                    Proses Order
                                  </TableActionMenuItem>
                                )}
                                {canDeleteLead(item) && (
                                  <TableActionMenuItem danger icon={Trash2} onClick={() => setDeleteId(item.id)}>
                                    Hapus
                                  </TableActionMenuItem>
                                )}
                              </TableActionMenu>
                            </TableActionCell>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </DataTable>

            <div className="leadPaginationBar">
              <span>
                Menampilkan {paginatedLeads.length ? (currentPage - 1) * itemsPerPage + 1 : 0}-
                {Math.min(currentPage * itemsPerPage, filteredData.length)} dari {filteredData.length} data, maks. 50 baris per halaman
              </span>
              <div className="leadPaginationActions">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <strong>{totalPages === 0 ? 0 : currentPage} / {totalPages || 0}</strong>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </OperationalTableCard>
        ) : (
            /* KANBAN VIEW */
            kanbanView
        )}
      </div>

      <Dialog open={isBulkEditOpen} onOpenChange={setIsBulkEditOpen}>
        <MasterDataFormDialogContent size="default" className="leadBulkDialog">
          <MasterDataFormHeader
            icon={Edit}
            title={`Edit Massal (${selectedIds.size} Prospek)`}
            description="Pilih satu kolom untuk diperbarui ke semua prospek yang sedang dipilih."
          />
          <form
            className="masterDataForm"
            onSubmit={(event) => {
              event.preventDefault();
              void handleBulkUpdate();
            }}
          >
            <MasterDataDialogBody compact>
              <MasterDataFormGrid>
                <MasterDataFormField span="full">
                  <MasterDataFieldLabel required>Pilih Kolom</MasterDataFieldLabel>
                  <Select value={bulkField} onValueChange={(val) => { setBulkField(val); setBulkValue(''); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kolom yang akan diedit" />
                    </SelectTrigger>
                    <SelectContent className="z-[250]">
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="csId">CS / Staff</SelectItem>
                      <SelectItem value="advertiserId">Advertiser</SelectItem>
                      <SelectItem value="platformId">Sumber</SelectItem>
                      <SelectItem value="vehicleId">Kendaraan</SelectItem>
                    </SelectContent>
                  </Select>
                </MasterDataFormField>

                {bulkField && (
                  <MasterDataFormField span="full">
                    <MasterDataFieldLabel required>Nilai Baru</MasterDataFieldLabel>
                    {bulkField === 'status' ? (
                      <Select value={bulkValue} onValueChange={setBulkValue}>
                        <SelectTrigger><SelectValue placeholder="Pilih status" /></SelectTrigger>
                        <SelectContent className="z-[250]">
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Follow Up">Follow Up</SelectItem>
                          <SelectItem value="Booking">Booking</SelectItem>
                          <SelectItem value="Closing">Closing</SelectItem>
                          <SelectItem value="Cancel">Cancel</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : bulkField === 'csId' ? (
                      <Select value={bulkValue} onValueChange={setBulkValue}>
                        <SelectTrigger><SelectValue placeholder="Pilih CS" /></SelectTrigger>
                        <SelectContent className="z-[250]">
                          {csUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : bulkField === 'advertiserId' ? (
                      <Select value={bulkValue} onValueChange={setBulkValue}>
                        <SelectTrigger><SelectValue placeholder="Pilih advertiser" /></SelectTrigger>
                        <SelectContent className="z-[250]">
                          {advertiserUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : bulkField === 'platformId' ? (
                      <Select value={bulkValue} onValueChange={setBulkValue}>
                        <SelectTrigger><SelectValue placeholder="Pilih sumber" /></SelectTrigger>
                        <SelectContent className="z-[250]">
                          {activePlatforms.map((platform) => (
                            <SelectItem key={platform.id} value={platform.id}>{platform.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : bulkField === 'vehicleId' ? (
                      <Select value={bulkValue} onValueChange={setBulkValue}>
                        <SelectTrigger><SelectValue placeholder="Pilih kendaraan" /></SelectTrigger>
                        <SelectContent className="z-[250]">
                          {activeVehicles.map((vehicle) => (
                            <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                  </MasterDataFormField>
                )}
              </MasterDataFormGrid>
            </MasterDataDialogBody>
            <MasterDataFormActions
              onCancel={() => setIsBulkEditOpen(false)}
              saveLabel="Simpan Perubahan"
              submitDisabled={!bulkField || !bulkValue}
            />
          </form>
        </MasterDataFormDialogContent>
      </Dialog>

      <Dialog open={isAddOpen} onOpenChange={handleAddSheetOpenChange}>
        <MasterDataFormDialogContent size="wide" className="leadFormDialog">
          <MasterDataFormHeader
            icon={UserIcon}
            title={editingItem ? 'Edit Prospek' : 'Tambah Prospek Baru'}
            description={`Isi data untuk ${editingItem ? 'memperbarui' : 'menambahkan'} prospek.`}
          />
          <LeadForm
            key={editingItem ? `edit-${editingItem.id}` : `new-${leadFormInstanceKey}`}
            item={editingItem}
            platforms={activePlatforms}
            vehicles={activeVehicles}
            csUsers={csUsers}
            advertiserUsers={advertiserUsers}
            currentUser={currentUser}
            onSubmit={handleSubmit}
            onCancel={() => setIsAddOpen(false)}
          />
        </MasterDataFormDialogContent>
      </Dialog>

      <Dialog open={!!bookingLead} onOpenChange={(open) => !open && setBookingLead(null)}>
        <MasterDataFormDialogContent size="wide" className="leadFormDialog">
          <MasterDataFormHeader
            icon={CalendarClock}
            title={selectedLeadBooking ? 'Edit Booking Prospek' : 'Booking Jadwal Prospek'}
            description="Simpan booking awal dari prospek tanpa melengkapi data pesanan penuh."
          />
          {bookingLead && (
            <ProspectBookingForm
              lead={bookingLead}
              booking={selectedLeadBooking}
              onSubmit={handleBookingSubmit}
              onCancelBooking={(booking) => void handleCancelLeadBooking(bookingLead, booking)}
              onCancel={() => setBookingLead(null)}
            />
          )}
        </MasterDataFormDialogContent>
      </Dialog>

      <Dialog open={!!detailLead} onOpenChange={(open) => !open && setDetailLead(null)}>
        <MasterDataFormDialogContent size="wide" className="leadDetailDialog">
          <MasterDataFormHeader
            icon={UserIcon}
            title="Detail Prospek"
            description="Ringkasan data prospek, sumber, status, dan booking."
          />
          {detailLead && (
            <MasterDataDialogBody compact>
              <div className="leadDetailHero">
                <div>
                  <h3>{detailLead.name}</h3>
                  <p>{isAdvertiserView ? 'Kontak disembunyikan' : detailLead.phone}</p>
                </div>
                <Badge variant="outline" className={`leadStatusBadge ${getStatusBadgeVariant(detailLead.status)}`}>
                  {detailLead.status}
                </Badge>
              </div>
              <div className="leadDetailGrid">
                <div className="leadDetailItem">
                  <span>Waktu</span>
                  <strong>{new Date(detailLead.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</strong>
                </div>
                <div className="leadDetailItem">
                  <span>CS / Staff</span>
                  <strong>{detailLead.csId ? getCSName(detailLead.csId) : '-'}</strong>
                </div>
                <div className="leadDetailItem">
                  <span>Sumber</span>
                  <strong>
                    {isAutoWhatsAppLead(detailLead) ? 'WhatsApp' : detailLead.platformId ? getPlatformName(detailLead.platformId) : '-'}
                  </strong>
                </div>
                <div className="leadDetailItem">
                  <span>Sub Channel</span>
                  <strong>{isAutoWhatsAppLead(detailLead) && !detailLead.subChannelId ? 'Auto API' : getSubChannelName(detailLead.subChannelId)}</strong>
                </div>
                <div className="leadDetailItem">
                  <span>Mobil</span>
                  <strong>{getVehicleName(detailLead.vehicleId)}</strong>
                </div>
                <div className="leadDetailItem">
                  <span>Kontak Terakhir</span>
                  <strong>{detailLead.lastContact || '-'}</strong>
                </div>
                <div className="leadDetailItem spanFull">
                  <span>Catatan</span>
                  <strong>{normalizeLeadNotes(detailLead.notes) || '-'}</strong>
                </div>
                {getLeadBooking(detailLead.id) && (
                  <div className="leadDetailItem spanFull">
                    <span>Booking</span>
                    <strong>
                      {getBookingStatusLabel(getLeadBooking(detailLead.id))} · {getBookingSummary(detailLead.id)}
                    </strong>
                  </div>
                )}
              </div>
              <section className="leadFollowUpHistory">
                <div className="leadFollowUpHistoryHeader">
                  <div>
                    <span>Follow Up</span>
                    <strong>Riwayat Template</strong>
                  </div>
                  <Badge variant="outline" className="leadFollowUpHistoryCount">
                    {detailLead.templateHistory?.length || 0} aktivitas
                  </Badge>
                </div>
                {(detailLead.templateHistory?.length || 0) > 0 ? (
                  <div className="leadFollowUpHistoryList">
                    {[...(detailLead.templateHistory || [])]
                      .sort((left, right) => new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime())
                      .map((history, historyIndex) => (
                        <div key={`${history.templateId}-${history.sentAt}-${historyIndex}`} className="leadFollowUpHistoryItem">
                          <span className="leadFollowUpHistoryIcon">
                            <CheckCircle2 className="h-4 w-4" />
                          </span>
                          <div>
                            <strong>{history.templateName}</strong>
                            <span>{formatTemplateSentAt(history.sentAt)} · {getTemplateSenderName(history.sentBy)}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="leadFollowUpHistoryEmpty">
                    <MessageCircle className="h-4 w-4" />
                    <span>Belum ada template follow up yang dipakai.</span>
                  </div>
                )}
              </section>
            </MasterDataDialogBody>
          )}
          <DialogFooter className="masterDataFormActions">
            <Button type="button" variant="outline" onClick={() => setDetailLead(null)}>
              Tutup
            </Button>
            {!isAdvertiserView && detailLead && canEditLead(detailLead) && (
              <Button
                type="button"
                icon={<Edit className="h-4 w-4" />}
                onClick={() => {
                  const lead = detailLead;
                  setDetailLead(null);
                  openEditLeadForm(lead);
                }}
              >
                Edit Prospek
              </Button>
            )}
          </DialogFooter>
        </MasterDataFormDialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-white dark:bg-slate-800 dark:border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-slate-200">Hapus Prospek</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-slate-400">
              Apakah anda yakin ingin menghapus data prospek ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => void confirmDelete()}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mass Delete Confirmation */}
      <AlertDialog open={isMassDeleteOpen} onOpenChange={setIsMassDeleteOpen}>
        <AlertDialogContent className="bg-white dark:bg-slate-800 dark:border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-slate-200">Konfirmasi Hapus Massal</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-slate-400">
              Apakah Anda yakin ingin menghapus {selectedIds.size} prospek yang dipilih? 
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => void confirmMassDelete()}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Forward to Order Modal */}
      {forwardLead && (
         <OrderForm 
            isOpen={!!forwardLead}
            onClose={() => setForwardLead(null)}
            prefillData={{
                customerName: forwardLead.name,
                customerPhone: forwardLead.phone,
                vehicleId: forwardLead.vehicleId || '',
                platformId: forwardLead.platformId || '',
                subChannelId: forwardLead.subChannelId || '',
                advertiserId: forwardLead.advertiserId || '',
                csId: activeForwardBooking?.csId || forwardLead.csId || '',
                leadId: forwardLead.id,
                leadDate: forwardLead.timestamp.split('T')[0],
                status: 'pending',
                paymentStatus: 'Unpaid',
                paymentValidation: 'Pending',
                serviceDate: activeForwardBooking?.scheduleDate || '',
                serviceTime: activeForwardBooking?.scheduleTime || '',
                branchId: activeForwardBooking?.branchId || '',
                areaId: activeForwardBooking?.areaId || '',
                mapsUrl: activeForwardBooking?.mapsUrl || '',
                address: activeForwardBooking?.address || '',
                technicianId: activeForwardBooking?.technicianId || '',
                serviceId: activeForwardBooking?.serviceId || '',
                notes: [forwardLead.notes, activeForwardBooking?.notes].filter(Boolean).join('\n\n')
            }}
            onSuccess={(order) => handleOrderSuccess(order)}
         />
      )}
      {/* WA Template Selection Dialog */}
      <Dialog open={!!selectedWaLead} onOpenChange={(open) => !open && setSelectedWaLead(null)}>
        <MasterDataFormDialogContent size="default" className="leadTemplateDialog">
            <MasterDataFormHeader
              icon={Phone}
              title="Pilih Template Pesan"
              description={<>Kirim pesan WhatsApp ke <strong>{selectedWaLead?.name}</strong>.</>}
            />
            <MasterDataDialogBody compact className="leadTemplateBody">
                <Button 
                    variant="outline" 
                    className="leadTemplateBlankButton"
                    onClick={() => {
                        if (selectedWaLead) {
                            handleWhatsappClick(selectedWaLead);
                            setSelectedWaLead(null);
                        }
                    }}
                >
                    <div className="leadTemplateOptionInner">
                        <span className="leadTemplateIcon isWhatsapp">
                          <Phone className="h-4 w-4" />
                        </span>
                        <span>
                          <strong>Chat Tanpa Template</strong>
                          <small>Buka chat WhatsApp kosong</small>
                        </span>
                    </div>
                </Button>
                
                <div className="leadTemplateDivider">
                   <span>Template Tersedia</span>
                </div>
                
                {leadTemplates.length > 0 ? leadTemplates.map(template => (
                    <Button
                        key={template.id}
                        variant="ghost"
                        className={`leadTemplateItem ${selectedWaLead && isTemplateUsed(selectedWaLead, template.id) ? 'isUsed' : ''}`}
                        onClick={() => {
                             if (selectedWaLead) {
                                 handleWhatsappClick(selectedWaLead, template);
                                 setSelectedWaLead(null);
                             }
                        }}
                    >
                         <div className="leadTemplateOptionInner">
                             <span className="leadTemplateIcon">
                               <MessageCircle className="h-4 w-4" />
                             </span>
                             <span className="leadTemplateCopy">
                                 <span className="leadTemplateNameRow">
                                    <strong>{template.title}</strong>
                                    {selectedWaLead && isTemplateUsed(selectedWaLead, template.id) && (
                                        <Badge variant="secondary" className="leadTemplateUsedBadge">
                                            Dikirim {selectedWaLead.templateHistory?.filter(h => h.templateId === template.id).length}x
                                        </Badge>
                                    )}
                                 </span>
                                 <small>{template.message}</small>
                             </span>
                         </div>
                    </Button>
                )) : (
                    <div className="leadTemplateEmpty">
                        <MessageCircle className="h-5 w-5" />
                        <span>Belum ada template tersedia</span>
                    </div>
                )}
            </MasterDataDialogBody>
        </MasterDataFormDialogContent>
      </Dialog>
    </OperationalPageShell>
  );
};
