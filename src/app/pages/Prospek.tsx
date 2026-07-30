import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Plus, Phone, Settings,
  Edit, Trash2, MoreVertical, User as UserIcon, Lock, Check, CheckCircle2, ArrowRightCircle, LayoutList, KanbanSquare, ListFilter, Copy, ExternalLink, CalendarClock, Ban, MessageCircle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Modal } from '../components/ui/Modal';
import { Label } from "../components/ui/label";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '../components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger, SheetFooter, SheetClose
} from '../components/ui/sheet';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useMasterData } from '@/app/pages/master-data/context';
import { usePermissions } from '@/app/hooks/usePermissions';
import { logActivity } from '@/app/services/auditService';
import {
  isAdminManagementRole,
  isAdvertiserRole,
  isCsRole,
  isOwnerLikeRole,
} from '@/app/data/roleHelpers';
import { useMediaQuery } from '../hooks/use-media-query';
import { Lead, LeadStatus, ProspectBooking, User, WATemplate } from './master-data/data';
import { LeadForm } from './leads/LeadForm';
import { OrderForm } from './orders/OrderForm';
import { Order } from './master-data/data';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/clipboard';
import { DatePickerWithRange } from '../components/ui/date-range-picker';
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
  const isDesktop = useMediaQuery("(min-width: 768px)");

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
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk Edit State
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkField, setBulkField] = useState<string>('');
  const [bulkValue, setBulkValue] = useState<string>('');

  // WA Template Selection State
  const [selectedWaLead, setSelectedWaLead] = useState<Lead | null>(null);

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

  // Filter templates strictly for 'Leads' or 'General'
  const leadTemplates = useMemo(() => {
      return waTemplates.filter(t => t.category === 'Leads' || t.category === 'General' || !t.category);
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

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedLeads = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

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
          <div className="flex gap-4 overflow-x-auto pb-6 px-4 snap-x snap-mandatory">
              {stages.map(stage => {
                  const items = filteredData.filter(i => i.status === stage);
                  return (
                      <div key={stage} className="min-w-[300px] w-[300px] flex-none snap-center flex flex-col bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 h-[calc(100vh-250px)]">
                          {/* Column Header */}
                          <div className={`p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 rounded-t-xl sticky top-0 z-10`}>
                              <div className="flex items-center gap-2">
                                  <Badge className={getStatusBadgeVariant(stage)} variant="outline">{stage}</Badge>
                                  <span className="text-xs text-slate-400 font-medium">({items.length})</span>
                              </div>
                          </div>
                          
                          {/* Items List */}
                          <div className="p-3 space-y-3 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-600">
                              {items.map(item => (
                                  <div key={item.id} className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative">
                                      <div className="flex justify-between items-start mb-2">
                                          <div>
                                              <div className="flex min-w-0 items-center gap-2">
                                                <h4 className="truncate font-semibold text-slate-900 dark:text-slate-100 text-sm">{item.name}</h4>
                                                <AutoWhatsAppLeadBadge lead={item} className="shrink-0" />
                                              </div>
                                              {!isAdvertiserView && (
                                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.phone}</p>
                                              )}
                                          </div>
                                          <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                  <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                      <MoreVertical className="h-3 w-3" />
                                                  </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end">
                                                {canEditLead(item) && (
                                                  <DropdownMenuItem onClick={() => openEditLeadForm(item)}>Edit</DropdownMenuItem>
                                                )}
                                                {item.status !== 'Closing' && (
                                                    <DropdownMenuItem onClick={() => openBookingForm(item)}>
                                                        Booking Jadwal
                                                    </DropdownMenuItem>
                                                )}
                                                {item.status !== 'Closing' && getActiveLeadBooking(item.id) && (
                                                    <DropdownMenuItem onClick={() => void handleCancelLeadBooking(item, getActiveLeadBooking(item.id))}>
                                                        <Ban className="w-4 h-4 mr-2" /> Batalkan Booking
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem onClick={() => { setForwardLead(item); }}>Proses Order</DropdownMenuItem>
                                                {canEditLead(item) && (
                                                  <>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuLabel>Ubah Status</DropdownMenuLabel>
                                                    {stages.filter(s => s !== stage).map(s => (
                                                        <DropdownMenuItem key={s} onClick={() => updateLead({ ...item, status: s })}>
                                                            Move to {s}
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
                                      
                                      <div className="space-y-2 mt-3">
                                          {(item.platformId || isAutoWhatsAppLead(item)) && (
                                              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                                  <AutoWhatsAppLeadBadge lead={item} />
                                                  {item.platformId && (
                                                    <>
                                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-normal">
                                                          {getPlatformName(item.platformId)}
                                                      </Badge>
                                                      <span>• {getVehicleName(item.vehicleId)}</span>
                                                    </>
                                                  )}
                                              </div>
                                          )}
                                          
                                          {item.notes && (
                                              <p
                                                  className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 break-all bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-700"
                                                  title={normalizeLeadNotes(item.notes)}
                                              >
                                                  "{getLeadNotesPreview(item.notes, 110)}"
                                              </p>
                                          )}

                                          {getLeadBooking(item.id) && (
                                              <div className="rounded-lg border border-violet-200 bg-violet-50/80 p-2 text-[11px] text-violet-700">
                                                  <div className="font-semibold">Booking {getBookingStatusLabel(getLeadBooking(item.id))}</div>
                                                  <div>{getBookingSummary(item.id)}</div>
                                              </div>
                                          )}

                                          {!isAdvertiserView && getLeadSocialHandle(item) && (
                                              <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-700 dark:bg-slate-900/40">
                                                  <div className="flex items-center gap-2 text-[11px]">
                                                      {item.socialPlatform && (
                                                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
                                                              {getLeadSocialPlatformLabel(item.socialPlatform)}
                                                          </Badge>
                                                      )}
                                                      <span className="font-medium text-slate-700 dark:text-slate-200">
                                                          {getLeadSocialHandle(item)}
                                                      </span>
                                                  </div>
                                              </div>
                                          )}

                                          <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-100 dark:border-slate-700">
                                              <div className="flex items-center gap-1.5">
                                                 <UserIcon className="w-3 h-3 text-slate-400" />
                                                 <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[80px]">
                                                     {getCSName(item.csId)}
                                                 </span>
                                              </div>
                                              <span className="text-[10px] text-slate-400">
                                                  {new Date(item.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                              </span>
                                          </div>
                                          
                                          {/* Quick Actions */}
                                          {!isAdvertiserView && (
                                          <div className="flex gap-2 pt-2">
                                              <Button 
                                                  size="sm" variant="outline" 
                                                  className="h-7 text-xs border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/30"
                                                  onClick={(e) => { e.stopPropagation(); setSelectedWaLead(item); }}
                                              >
                                                  <Phone className="w-3 h-3 mr-1" /> WA
                                              </Button>
                                              {getLeadSocialUrl(item) && (
                                                  <Button
                                                      size="sm"
                                                      variant="outline"
                                                      className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/30"
                                                      onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleLeadSocialOpen(item);
                                                      }}
                                                  >
                                                      <ExternalLink className="w-3 h-3 mr-1" />
                                                      {getLeadSocialPrimaryActionLabel(item)}
                                                  </Button>
                                              )}
                                              {getLeadSocialHandle(item) && (
                                                  <Button
                                                      size="icon"
                                                      variant="ghost"
                                                      className="h-7 w-7 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                                                      onClick={(e) => {
                                                          e.stopPropagation();
                                                          void handleLeadSocialCopy(item);
                                                      }}
                                                  >
                                                      <Copy className="w-3.5 h-3.5" />
                                                  </Button>
                                              )}
                                          </div>
                                          )}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )
              })}
          </div>
      )
  }, [filteredData, currentUser, updateLead, getPlatformName, getVehicleName, getCSName, getStatusBadgeVariant, isAdvertiserView, latestBookingByLeadId]);

  return (
    <OperationalPageShell>
      <div className="flex flex-col space-y-4">
        <OperationalPageHeader
          eyebrow="Operasional"
          icon={UserIcon}
          title="Kotak Masuk Prospek"
          subtitle="Kelola leads, follow up, booking awal, dan konversi menjadi pesanan."
          actions={
            <div className="flex flex-wrap items-center gap-2">
                 {/* View Toggle */}
                 <div className="flex h-9 flex-shrink-0 items-center rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setViewMode('list')}
                        className={viewMode === 'list' ? "h-7 bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100" : "h-7 text-slate-500 dark:text-slate-400"}
                    >
                        <LayoutList className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">List</span>
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setViewMode('kanban')}
                        className={viewMode === 'kanban' ? "h-7 bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100" : "h-7 text-slate-500 dark:text-slate-400"}
                    >
                        <KanbanSquare className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Board</span>
                    </Button>
                 </div>

                 {/* Add Button */}
                 {hasPermission('leads.create') && (
                  <>
                    {/* Mobile: Icon Only */}
                    <Button 
                      size="sm"
                      className="h-9 w-9 rounded-lg bg-blue-600 p-0 text-white shadow-sm hover:bg-blue-700 md:hidden"
                      onClick={() => {
                        openAddLeadForm();
                      }}
                    >
                      <Plus className="h-5 w-5" />
                    </Button>

                    {/* Desktop: With Text */}
                    <div className="hidden md:block">
                        <Button 
                          className="h-9 bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                          onClick={() => {
                            openAddLeadForm();
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" /> Tambah Prospek
                        </Button>
                    </div>
                  </>
                 )}
            </div>
          }
        />

          {/* Bottom Row (Mobile Only): Date, Status */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide md:hidden">
              <div className="flex-shrink-0">
                <DatePickerWithRange 
                  date={dateRange}
                  setDate={setDateRange}
                  className="w-[200px] h-9 rounded-lg" 
                />
              </div>

              <div className="flex-shrink-0">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-[110px] bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs shadow-sm rounded-lg">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua</SelectItem>
                    {['Pending', 'Follow Up', 'Booking', 'Closing', 'Cancel'].map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
          </div>

        {/* Stats Cards */}
        <OperationalKpiGrid>
          <OperationalKpiCard label="Total" value={stats.total} icon={UserIcon} />
          <OperationalKpiCard label="Pending" value={stats.pending} icon={CalendarClock} tone="amber" />
          <OperationalKpiCard label="Closing" value={stats.closing} icon={CheckCircle2} tone="emerald" />
          <OperationalKpiCard label="Auto WA" value={stats.autoWhatsApp} icon={MessageCircle} tone="emerald" />
          <OperationalKpiCard label="Conversion Rate" value={`${stats.conversionRate}%`} icon={ArrowRightCircle} tone="blue" />
        </OperationalKpiGrid>


        {/* Filter Toolbar - New Compact Design */}
        <OperationalFilterPanel className="flex flex-col gap-4">
            {/* Row 1: Status Filter (Horizontal Scroll Pills) - Desktop Only */}
            <div className="hidden md:flex items-center gap-3 overflow-x-auto w-full pb-2 md:pb-0 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
               {/* Desktop Date Picker */}
               <div className="flex-shrink-0">
                  <DatePickerWithRange 
                    date={dateRange}
                    setDate={setDateRange}
                    className="h-10"
                  />
               </div>
               
               {/* Divider */}
                <div className="mx-2 h-8 w-px bg-slate-200 dark:bg-slate-700" />

               <div className="flex items-center gap-2">
                 <Button 
                  variant={statusFilter === 'all' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => setStatusFilter('all')}
                  className={`h-9 rounded-full px-5 font-medium transition-all ${statusFilter === 'all' ? "bg-slate-900 text-white shadow-md ring-2 ring-slate-100 dark:bg-blue-600 dark:ring-blue-950/80" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"}`}
                >
                  Semua
                </Button>
                 {['Pending', 'Follow Up', 'Booking', 'Closing', 'Cancel'].map(status => (
                    <Button 
                      key={status}
                      variant={statusFilter === status ? 'default' : 'outline'} 
                      size="sm" 
                      onClick={() => setStatusFilter(status)}
                      className={`h-9 rounded-full px-5 font-medium transition-all ${statusFilter === status ? "bg-slate-900 text-white shadow-md ring-2 ring-slate-100 dark:bg-blue-600 dark:ring-blue-950/80" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"}`}
                    >
                      {status}
                    </Button>
                 ))}
               </div>
            </div>

            {/* Row 2: Search & Filter Trigger */}
            <div className="flex gap-3 items-center w-full">
              <div className="relative flex-1 group">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-blue-500 dark:text-slate-400" />
                <Input 
                  placeholder="Cari nama, nomor telepon, atau catatan..." 
                  className="h-10 w-full rounded-lg border-slate-200 bg-white pl-10 text-slate-700 shadow-sm transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              
              <Sheet>
                  <SheetTrigger asChild>
                      <Button variant="outline" className="relative h-10 gap-2 border-slate-200 bg-white px-4 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                          <ListFilter className="w-4 h-4" />
                          <span className="hidden sm:inline">Filter</span>
                          {/* Active Filter Indicator */}
                          {(advertiserFilter !== 'all' || platformFilter !== 'all' || subChannelFilter !== 'all' || csFilter !== 'all' || (dateRange?.from && dateRange.from.getDate() !== new Date().getDate())) && (
                              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                              </span>
                          )}
                      </Button>
                  </SheetTrigger>
                  <SheetContent 
                      side={isDesktop ? "right" : "bottom"} 
                      className={isDesktop 
                          ? "h-full w-[400px] sm:max-w-[400px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-0 shadow-xl"
                          : "h-[85vh] rounded-t-2xl px-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800"
                      }
                  >
                      <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                          <SheetTitle className="text-base font-semibold">Filter Prospek</SheetTitle>
                          <SheetDescription className="text-xs">Tampilkan data spesifik berdasarkan kriteria</SheetDescription>
                      </SheetHeader>
                      <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(85vh-100px)]">
                            {!isAdvertiserView && (
                            <div className="space-y-2">
                                <Label>Advertiser</Label>
                                <Select value={advertiserFilter} onValueChange={setAdvertiserFilter}>
                                    <SelectTrigger className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 dark:text-slate-200 shadow-sm">
                                        <SelectValue placeholder="Pilih Advertiser" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua Advertiser</SelectItem>
                                        {availableAdvertisers.map(user => (
                                        <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            )}

                             {/* CS Filter */}
                            {(isAdminManagementUser || isAdvertiserView) && (
                            <div className="space-y-2">
                                <Label>CS / Staff</Label>
                                <Select value={csFilter} onValueChange={setCsFilter}>
                                    <SelectTrigger className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 dark:text-slate-200 shadow-sm">
                                        <SelectValue placeholder="Pilih CS" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua CS</SelectItem>
                                        {availableCS.map((user) => (
                                            <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            )}

                            <div className="space-y-2">
                                <Label>Sumber (Platform)</Label>
                                <Select value={platformFilter} onValueChange={(val) => {
                                   setPlatformFilter(val);
                                   setSubChannelFilter('all');
                                }}>
                                  <SelectTrigger className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 dark:text-slate-200 shadow-sm">
                                    <SelectValue placeholder="Pilih Sumber" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">Semua Sumber</SelectItem>
                                    {availablePlatforms.map(platform => (
                                      <SelectItem key={platform.id} value={platform.id}>{platform.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Sub Channel</Label>
                                <Select value={subChannelFilter} onValueChange={setSubChannelFilter}>
                                  <SelectTrigger className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 dark:text-slate-200 shadow-sm">
                                    <SelectValue placeholder="Pilih Sub Channel" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">Semua Sub Ch</SelectItem>
                                    {availableSubChannels.map(sc => (
                                      <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                            </div>
                      </div>
                      <SheetFooter className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 sm:justify-between">
                           <Button variant="ghost" onClick={() => {
                               setAdvertiserFilter('all');
                               setCsFilter('all');
                               setPlatformFilter('all');
                               setSubChannelFilter('all');
                               setDateRange({ from: new Date(), to: new Date() });
                           }}>
                               Reset Filter
                           </Button>
                           <SheetClose asChild>
                               <Button>Terapkan</Button>
                           </SheetClose>
                      </SheetFooter>
                  </SheetContent>
              </Sheet>
            </div>
        </OperationalFilterPanel>

        {/* Content Card */}
        {viewMode === 'list' ? (
        <OperationalTableCard>
          
          {/* Mass Action Bar */}
          {selectedIds.size > 0 && (
              <div className="bg-blue-50 border border-blue-100 p-2 px-4 rounded-lg flex items-center justify-between mb-4 animate-in fade-in slide-in-from-top-2 mx-4 md:mx-4 mt-0 md:mt-4">
                  <div className="flex items-center gap-3 text-sm text-blue-700">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-medium">{selectedIds.size} prospek terpilih</span>
                  </div>
                  <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="h-8 text-xs text-slate-500 hover:text-slate-700">
                          Batal
                      </Button>
                      
                      {hasPermission('leads.edit') && (
                      <Button size="sm" variant="outline" onClick={() => setIsBulkEditOpen(true)} className="h-8 text-xs shadow-sm bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900">
                          <Edit className="w-3.5 h-3.5 mr-1.5" />
                          Edit ({selectedIds.size})
                      </Button>
                      )}

                      {hasPermission('leads.delete') && (
                      <Button size="sm" variant="destructive" onClick={handleMassDelete} className="h-8 text-xs shadow-sm">
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          Hapus ({selectedIds.size})
                      </Button>
                      )}
                  </div>
              </div>
          )}

          {/* Data Table (DESKTOP) */}
          <div className="hidden md:block rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm transition-all duration-300">
            <div className="pb-2">
            <Table className="min-w-[1720px] table-fixed">
              <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                <TableRow className="border-b border-slate-100 dark:border-slate-700 hover:bg-transparent">
                  <TableHead className="w-[50px] py-4 pl-4">
                    <Checkbox 
                        className="border-slate-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        checked={paginatedLeads.length > 0 && Array.from(selectedIds).filter(id => paginatedLeads.find(o => o.id === id)).length === paginatedLeads.length}
                        onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                    />
                  </TableHead>
                  <TableHead className="w-[50px] py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">No</TableHead>
                  <TableHead className="w-[110px] py-4 pl-6 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Waktu</TableHead>
                  <TableHead className="w-[240px] py-4 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Nama & Kontak</TableHead>
                  <TableHead className="w-[180px] py-4 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">CS / Staff</TableHead>
                  <TableHead className="w-[220px] py-4 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Sumber | Sub Channel</TableHead>
                  <TableHead className="w-[180px] py-4 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Mobil</TableHead>
                  <TableHead className="w-[320px] py-4 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Catatan</TableHead>
                  <TableHead className="sticky right-[188px] z-10 w-[180px] min-w-[180px] bg-slate-50/95 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-600 shadow-[-4px_0_10px_-6px_rgba(15,23,42,0.08)] backdrop-blur dark:bg-slate-800/95 dark:text-slate-300">Status</TableHead>
                  {!isAdvertiserView && (
                    <TableHead className="sticky right-0 z-20 w-[188px] min-w-[188px] bg-slate-50/95 py-4 pr-6 text-right text-xs font-semibold uppercase tracking-wider text-slate-600 shadow-[-6px_0_12px_-6px_rgba(15,23,42,0.12)] backdrop-blur dark:bg-slate-800/95 dark:text-slate-300">Aksi</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.length === 0 ? (
                   <TableRow>
                     <TableCell colSpan={isAdvertiserView ? 10 : 11}>
                        <OperationalEmptyState
                          icon={UserIcon}
                          title="Tidak ada data prospek ditemukan"
                          description="Coba ubah filter, tanggal, atau kata kunci pencarian."
                        />
                     </TableCell>
                   </TableRow>
                ) : (
                  paginatedLeads.map((item, index) => (
                    <TableRow key={item.id} className={`group border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/80 dark:border-slate-700 dark:hover:bg-slate-800/70 ${selectedIds.has(item.id) ? 'bg-[rgba(59,130,246,0.08)] ring-1 ring-inset ring-blue-500/10 dark:bg-[rgba(37,99,235,0.18)] dark:ring-blue-400/15' : ''}`}>
                      <TableCell className="py-4 pl-4 align-top w-[40px]">
                        <Checkbox 
                            className="border-slate-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            checked={selectedIds.has(item.id)}
                            onCheckedChange={(checked) => handleSelectRow(item.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="w-[50px] py-4 align-top text-center text-sm font-medium text-slate-500 dark:text-slate-300">
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </TableCell>
                      <TableCell className="w-[110px] py-4 pl-6 align-top">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 dark:text-slate-200 text-sm">
                            {new Date(item.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-300">
                            {new Date(item.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="w-[240px] py-4 align-top">
                        <div className="flex min-w-0 flex-col">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-semibold text-slate-900 dark:text-slate-200 text-sm" title={item.name}>{item.name}</span>
                            <AutoWhatsAppLeadBadge lead={item} className="shrink-0" />
                          </div>
                          {!isAdvertiserView && (
                            <div className="mt-0.5 flex items-center text-xs text-slate-500 dark:text-slate-300">
                              <Phone className="w-3 h-3 mr-1" />
                              <span className="truncate" title={item.phone}>{item.phone}</span>
                            </div>
                          )}
                          {!isAdvertiserView && getLeadSocialHandle(item) && (
                            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-700 dark:bg-slate-900/40">
                              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                {item.socialPlatform && (
                                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
                                    {getLeadSocialPlatformLabel(item.socialPlatform)}
                                  </Badge>
                                )}
                                <span className="max-w-full truncate text-xs font-medium text-slate-700 dark:text-slate-200" title={getLeadSocialHandle(item)}>
                                  {getLeadSocialHandle(item)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="w-[180px] py-4 align-top">
                        {item.csId ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center border border-slate-200 dark:border-slate-600">
                              <UserIcon className="w-3 h-3 text-slate-500 dark:text-slate-300" />
                            </div>
                            <span className="truncate text-sm text-slate-700 dark:text-slate-200" title={getCSName(item.csId)}>{getCSName(item.csId)}</span>
                          </div>
                        ) : (
                          <span className="text-xs italic text-slate-400 dark:text-slate-300">Belum assign</span>
                        )}
                      </TableCell>
                      <TableCell className="w-[220px] py-4 align-top">
                         <div className="flex flex-col gap-1.5">
                           <div className="flex items-center gap-2 flex-wrap">
                               <span className="font-medium text-slate-700 dark:text-slate-200 text-sm">
                                  {isAutoWhatsAppLead(item) ? 'WhatsApp' : item.platformId ? getPlatformName(item.platformId) : '-'}
                               </span>
                               <span className="text-slate-300 dark:text-slate-600 text-sm">|</span>
                               <span className="text-sm text-slate-500 dark:text-slate-300">
                                  {isAutoWhatsAppLead(item) && !item.subChannelId ? 'Auto API' : getSubChannelName(item.subChannelId)}
                               </span>
                           </div>
                           <AutoWhatsAppLeadBadge lead={item} />
                         </div>
                      </TableCell>
                      <TableCell className="w-[180px] py-4 text-sm text-slate-700 dark:text-slate-300 align-top">
                        {getVehicleName(item.vehicleId)}
                      </TableCell>
                      <TableCell className="w-[320px] py-4 align-top">
                        <div className="flex max-w-[320px] flex-col">
                          <p
                            className="truncate text-sm text-slate-600 dark:text-slate-200"
                            title={normalizeLeadNotes(item.notes) || undefined}
                          >
                            {getLeadNotesPreview(item.notes)}
                          </p>
                          <span className="mt-1 text-[10px] italic text-slate-400 dark:text-slate-300">
                             Kontak: {item.lastContact || 'Belum ada'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="sticky right-[188px] z-10 w-[180px] min-w-[180px] bg-white py-4 text-center align-top shadow-[-4px_0_10px_-6px_rgba(15,23,42,0.06)] transition-colors group-hover:bg-slate-50/80 dark:bg-slate-900 dark:group-hover:bg-slate-800/80">
                        <div className="flex flex-col items-center gap-1">
                          <Badge 
                            variant="outline"
                            className={`uppercase text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-sm ${getStatusBadgeVariant(item.status)}`}
                          >
                            {item.status}
                          </Badge>
                          {getLeadBooking(item.id) && (
                            <div className="text-center">
                              <div className="text-[10px] font-semibold text-violet-600">
                                Booking {getBookingStatusLabel(getLeadBooking(item.id))}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {getBookingSummary(item.id)}
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      {!isAdvertiserView && (
                      <TableCell className="sticky right-0 z-20 w-[188px] min-w-[188px] bg-white py-4 pr-6 text-right align-top shadow-[-6px_0_12px_-6px_rgba(15,23,42,0.1)] transition-colors group-hover:bg-slate-50/80 dark:bg-slate-900 dark:group-hover:bg-slate-800/80">
                        <div className="flex min-w-max justify-end gap-1">
                          {getLeadSocialUrl(item) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20"
                              title={getLeadSocialPrimaryActionLabel(item)}
                              onClick={() => handleLeadSocialOpen(item)}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                          {getLeadSocialHandle(item) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                              title="Salin username sosial"
                              onClick={() => void handleLeadSocialCopy(item)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          )}
                          <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <div className="relative inline-block">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-[#25D366] hover:text-[#128C7E] hover:bg-green-50 dark:hover:bg-green-900/20 relative">
                                        <WhatsappIcon className="w-5 h-5" />
                                        {(item.templateHistory?.length || 0) > 0 && (
                                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold ring-2 ring-white dark:ring-slate-800">
                                                {item.templateHistory?.length}
                                            </span>
                                        )}
                                    </Button>
                                </div>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="z-50 w-56 border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
                                <DropdownMenuLabel className="dark:text-slate-200">Kirim Pesan WA</DropdownMenuLabel>
                                <DropdownMenuSeparator className="dark:bg-slate-700" />
                                {leadTemplates.length > 0 ? (
                                    <>
                                        {leadTemplates.map(template => (
                                            <DropdownMenuItem 
                                                key={template.id}
                                                className={`cursor-pointer dark:text-slate-300 dark:focus:bg-slate-700 ${isTemplateUsed(item, template.id) ? 'bg-slate-50 dark:bg-slate-800/50' : ''}`}
                                                onClick={() => handleWhatsappClick(item, template)}
                                            >
                                                <div className="flex items-center w-full justify-between gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <span>{template.title}</span>
                                                        {(item.templateHistory?.filter(h => h.templateId === template.id).length || 0) > 0 && (
                                                              <span className="min-w-[1.5rem] rounded-md bg-slate-100 px-1.5 py-0.5 text-center text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                                                                  {item.templateHistory?.filter(h => h.templateId === template.id).length}x
                                                              </span>
                                                        )}
                                                    </div>
                                                    {isTemplateUsed(item, template.id) && <Check className="w-3 h-3 text-green-500 ml-2 flex-shrink-0" />}
                                                </div>
                                            </DropdownMenuItem>
                                        ))}
                                        <DropdownMenuSeparator className="dark:bg-slate-700" />
                                    </>
                                ) : (
                                    <div className="px-2 py-2 text-center text-xs italic text-slate-400 dark:text-slate-300">Belum ada template</div>
                                )}
                                <DropdownMenuItem className="cursor-pointer font-medium text-green-600 dark:text-green-400 dark:focus:bg-slate-700" onClick={() => handleWhatsappClick(item)}>
                                    Chat Tanpa Template
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                          </DropdownMenu>

                          <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xl z-50">
                                {canEditLead(item) && (
                                  <DropdownMenuItem 
                                      onClick={() => openEditLeadForm(item)} 
                                      className="dark:text-slate-200 dark:focus:bg-slate-700 cursor-pointer"
                                  >
                                    <Edit className="w-4 h-4 mr-2" /> Edit
                                  </DropdownMenuItem>
                                )}
                                {item.status !== 'Closing' && (
                                  <DropdownMenuItem onClick={() => openBookingForm(item)} className="text-violet-600 dark:text-violet-300 dark:focus:bg-slate-700 cursor-pointer">
                                    <CalendarClock className="w-4 h-4 mr-2" /> Booking Jadwal
                                  </DropdownMenuItem>
                                )}
                                {item.status !== 'Closing' && getActiveLeadBooking(item.id) && (
                                    <DropdownMenuItem
                                        onClick={() => void handleCancelLeadBooking(item, getActiveLeadBooking(item.id))}
                                        className="text-amber-600 dark:text-amber-400 dark:focus:bg-slate-700 cursor-pointer"
                                    >
                                      <Ban className="w-4 h-4 mr-2" /> Batalkan Booking
                                    </DropdownMenuItem>
                                )}
                                {item.status !== 'Closing' && (
                                    <DropdownMenuItem onClick={() => setForwardLead(item)} className="text-blue-600 dark:text-blue-400 dark:focus:bg-slate-700 cursor-pointer">
                                        <ArrowRightCircle className="w-4 h-4 mr-2" /> Proses Order
                                    </DropdownMenuItem>
                                )}
                                {getLeadSocialHandle(item) && (
                                    <DropdownMenuItem onClick={() => void handleLeadSocialCopy(item)} className="dark:text-slate-200 dark:focus:bg-slate-700 cursor-pointer">
                                        <Copy className="w-4 h-4 mr-2" /> Salin Username Sosial
                                    </DropdownMenuItem>
                                )}
                                {canDeleteLead(item) && (
                                  <>
                                    <DropdownMenuSeparator className="dark:bg-slate-700" />
                                    <DropdownMenuItem 
                                        onClick={() => setDeleteId(item.id)} 
                                        className="text-red-600 dark:text-red-400 dark:focus:bg-slate-700 cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" /> Hapus
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
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
                      <span className="mx-1 text-slate-400 dark:text-slate-500">/</span>
                      <span className="mr-2 text-slate-400 dark:text-slate-400">{totalPages}</span>
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
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-300">Tampilkan:</span>
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

          {/* Mobile Card List (Generic for Table View) */}
          <div className="md:hidden p-4 space-y-3">
             {/* Simplified mobile view per user request */}
             {filteredData.map(item => {
                return (
                <div key={item.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                           <div className="flex min-w-0 items-center gap-2">
                             <h4 className="truncate font-bold text-slate-900 dark:text-slate-100">{item.name}</h4>
                             <AutoWhatsAppLeadBadge lead={item} className="shrink-0" />
                           </div>
                           {!isAdvertiserView && (
                               <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.phone}</p>
                           )}
                        </div>
                        <Badge className={getStatusBadgeVariant(item.status)} variant="outline">{item.status}</Badge>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mb-1">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                           {isAutoWhatsAppLead(item) ? 'WhatsApp' : item.platformId ? getPlatformName(item.platformId) : '-'}
                        </span>
                        <span>|</span>
                        <span>{isAutoWhatsAppLead(item) && !item.subChannelId ? 'Auto API' : getSubChannelName(item.subChannelId)}</span>
                        <AutoWhatsAppLeadBadge lead={item} className="ml-1" />
                    </div>

                    <div className="text-[10px] text-slate-400 dark:text-slate-500">
                        CS: {csUsers.find(u => u.id === item.csId)?.name || '-'}
                    </div>

                    {getLeadBooking(item.id) && (
                        <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50/70 px-2.5 py-2 text-[11px] text-violet-700">
                            <div className="font-semibold">Booking {getBookingStatusLabel(getLeadBooking(item.id))}</div>
                            <div className="text-violet-600/80">{getBookingSummary(item.id)}</div>
                        </div>
                    )}

                    {!isAdvertiserView && getLeadSocialHandle(item) && (
                        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-700 dark:bg-slate-900/40">
                            <div className="flex flex-wrap items-center gap-1.5">
                                {item.socialPlatform && (
                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
                                        {getLeadSocialPlatformLabel(item.socialPlatform)}
                                    </Badge>
                                )}
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                    {getLeadSocialHandle(item)}
                                </span>
                            </div>
                        </div>
                    )}
                    
                    {/* Actions Footer - Completely hidden for Advertiser */}
                    {!isAdvertiserView && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
                             <Button 
                                size="sm" variant="outline" 
                                className="h-8 text-xs border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/30 w-full"
                                onClick={(e) => { e.stopPropagation(); setSelectedWaLead(item); }}
                            >
                                <Phone className="w-3 h-3 mr-1" /> WA
                            </Button>
                            {getLeadSocialUrl(item) && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/30"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleLeadSocialOpen(item);
                                    }}
                                >
                                    <ExternalLink className="w-3 h-3 mr-1" />
                                    {getLeadSocialPrimaryActionLabel(item)}
                                </Button>
                            )}

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                                        <MoreVertical className="w-4 h-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {canEditLead(item) && (
                                      <DropdownMenuItem onClick={() => openEditLeadForm(item)}>
                                          <Edit className="w-4 h-4 mr-2" /> Edit
                                      </DropdownMenuItem>
                                    )}
                                    {item.status !== 'Closing' && (
                                        <DropdownMenuItem onClick={() => openBookingForm(item)}>
                                            <CalendarClock className="w-4 h-4 mr-2" /> Booking Jadwal
                                        </DropdownMenuItem>
                                    )}
                                    {item.status !== 'Closing' && getActiveLeadBooking(item.id) && (
                                        <DropdownMenuItem onClick={() => void handleCancelLeadBooking(item, getActiveLeadBooking(item.id))} className="text-amber-600">
                                            <Ban className="w-4 h-4 mr-2" /> Batalkan Booking
                                        </DropdownMenuItem>
                                    )}
                                    {item.status !== 'Closing' && (
                                        <DropdownMenuItem onClick={() => setForwardLead(item)}>
                                            <ArrowRightCircle className="w-4 h-4 mr-2" /> Proses Order
                                        </DropdownMenuItem>
                                    )}
                                    {getLeadSocialHandle(item) && (
                                        <DropdownMenuItem onClick={() => void handleLeadSocialCopy(item)}>
                                            <Copy className="w-4 h-4 mr-2" /> Salin Username Sosial
                                        </DropdownMenuItem>
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
                    )}
                </div>
                );
             })}
          </div>

           {/* Bulk Edit Modal */}
            <Modal
                title={`Edit Massal (${selectedIds.size} Prospek)`}
                isOpen={isBulkEditOpen}
                onClose={() => setIsBulkEditOpen(false)}
                className="max-w-md"
            >
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Pilih Kolom yang akan diedit</Label>
                        <Select value={bulkField} onValueChange={(val) => { setBulkField(val); setBulkValue(''); }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih Kolom" />
                            </SelectTrigger>
                            <SelectContent className="z-[250]">
                                <SelectItem value="status">Status</SelectItem>
                                <SelectItem value="csId">CS / Staff</SelectItem>
                                <SelectItem value="advertiserId">Advertiser</SelectItem>
                                <SelectItem value="platformId">Sumber (Platform)</SelectItem>
                                <SelectItem value="vehicleId">Kendaraan</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {bulkField && (
                        <div className="space-y-2">
                            <Label>Pilih Nilai Baru</Label>
                            {bulkField === 'status' ? (
                                <Select value={bulkValue} onValueChange={setBulkValue}>
                                    <SelectTrigger><SelectValue placeholder="Pilih Status" /></SelectTrigger>
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
                                        {csUsers.map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : bulkField === 'advertiserId' ? (
                                <Select value={bulkValue} onValueChange={setBulkValue}>
                                    <SelectTrigger><SelectValue placeholder="Pilih Advertiser" /></SelectTrigger>
                                    <SelectContent className="z-[250]">
                                        {advertiserUsers.map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : bulkField === 'platformId' ? (
                                <Select value={bulkValue} onValueChange={setBulkValue}>
                                    <SelectTrigger><SelectValue placeholder="Pilih Sumber" /></SelectTrigger>
                                    <SelectContent className="z-[250]">
                                        {activePlatforms.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : bulkField === 'vehicleId' ? (
                                <Select value={bulkValue} onValueChange={setBulkValue}>
                                    <SelectTrigger><SelectValue placeholder="Pilih Kendaraan" /></SelectTrigger>
                                    <SelectContent className="z-[250]">
                                        {activeVehicles.map(v => (
                                            <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : null}
                        </div>
                    )}
                    
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="ghost" onClick={() => setIsBulkEditOpen(false)}>Batal</Button>
                        <Button onClick={handleBulkUpdate} disabled={!bulkField || !bulkValue}>Simpan Perubahan</Button>
                    </div>
                </div>
            </Modal>
        </OperationalTableCard>
        ) : (
            /* KANBAN VIEW */
            kanbanView
        )}
      </div>

      {/* Add/Edit Sheet (Replaces Modal) */}
      <Sheet open={isAddOpen} onOpenChange={handleAddSheetOpenChange}>
        <SheetContent 
            side={isDesktop ? "right" : "bottom"} 
            className={isDesktop 
                ? "h-full w-[600px] sm:max-w-[600px] bg-slate-50 dark:bg-slate-950 p-0 overflow-hidden border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl"
                : "h-[95vh] w-full bg-slate-50 dark:bg-slate-950 p-0 overflow-hidden rounded-t-2xl border-slate-200 dark:border-slate-800 flex flex-col"
            }
        >
          <SheetHeader className="shrink-0 border-b border-slate-200 bg-white px-6 py-4 text-left dark:border-slate-800 dark:bg-slate-900">
            <SheetTitle className="text-lg font-semibold text-slate-900 dark:text-slate-200">{editingItem ? 'Edit Prospek' : 'Tambah Prospek Baru'}</SheetTitle>
            <SheetDescription className="text-xs text-slate-500 dark:text-slate-400">
              Isi formulir berikut untuk {editingItem ? 'memperbarui data' : 'menambahkan'} prospek baru.
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 py-4 overflow-y-auto flex-1 pb-10 scrollbar-hide">
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
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!bookingLead} onOpenChange={(open) => !open && setBookingLead(null)}>
        <SheetContent
            side={isDesktop ? "right" : "bottom"}
            className={isDesktop
            ? "h-full w-[620px] sm:max-w-[620px] bg-slate-50 dark:bg-slate-950 p-0 overflow-hidden border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl"
            : "h-[95vh] w-full bg-slate-50 dark:bg-slate-950 p-0 overflow-hidden rounded-t-2xl border-slate-200 dark:border-slate-800 flex flex-col"
          }
        >
          <SheetHeader className="shrink-0 border-b border-slate-200 bg-white px-6 py-4 text-left dark:border-slate-800 dark:bg-slate-900">
            <SheetTitle className="text-lg font-semibold text-slate-900 dark:text-slate-200">
              {selectedLeadBooking ? 'Edit Booking Prospek' : 'Booking Jadwal Prospek'}
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500 dark:text-slate-400">
              Simpan booking awal dari prospek tanpa harus melengkapi data pesanan penuh.
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 py-4 overflow-y-auto flex-1 pb-10 scrollbar-hide">
            {bookingLead && (
              <ProspectBookingForm
                lead={bookingLead}
                booking={selectedLeadBooking}
                onSubmit={handleBookingSubmit}
                onCancelBooking={(booking) => void handleCancelLeadBooking(bookingLead, booking)}
                onCancel={() => setBookingLead(null)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

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
      {/* WA Template Selection Sheet */}
      <Sheet open={!!selectedWaLead} onOpenChange={(open) => !open && setSelectedWaLead(null)}>
        <SheetContent 
            side={isDesktop ? "right" : "bottom"} 
            className={isDesktop 
                ? "h-full w-[400px] sm:max-w-[400px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-0 shadow-xl flex flex-col"
                : "max-h-[85vh] rounded-t-2xl px-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col"
            }
        >
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <SheetTitle className="text-base font-semibold">Pilih Template Pesan</SheetTitle>
                <SheetDescription className="text-xs">Kirim pesan WhatsApp ke <span className="font-medium text-slate-900 dark:text-slate-200">{selectedWaLead?.name}</span></SheetDescription>
            </SheetHeader>
            <div className="p-4 space-y-2 overflow-y-auto scrollbar-hide">
                <Button 
                    variant="outline" 
                    className="w-full justify-start text-left h-auto py-3 font-normal border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
                    onClick={() => {
                        if (selectedWaLead) {
                            handleWhatsappClick(selectedWaLead);
                            setSelectedWaLead(null);
                        }
                    }}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                            <Phone className="w-4 h-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="font-semibold text-sm">Chat Tanpa Template</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">Buka chat WhatsApp kosong</span>
                        </div>
                    </div>
                </Button>
                
                <div className="flex items-center gap-2 my-2">
                   <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1"></div>
                   <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Template Tersedia</span>
                   <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1"></div>
                </div>
                
                {leadTemplates.length > 0 ? leadTemplates.map(template => (
                    <Button
                        key={template.id}
                        variant="ghost"
                        className={`w-full justify-start text-left h-auto py-3 px-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg border border-transparent ${selectedWaLead && isTemplateUsed(selectedWaLead, template.id) ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800' : ''}`}
                        onClick={() => {
                             if (selectedWaLead) {
                                 handleWhatsappClick(selectedWaLead, template);
                                 setSelectedWaLead(null);
                             }
                        }}
                    >
                         <div className="flex items-center w-full gap-3">
                             <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                                 <span className="text-xs">📝</span>
                             </div>
                             <div className="flex flex-col flex-1 min-w-0 text-left">
                                 <div className="flex justify-between items-center w-full">
                                    <span className="font-semibold text-sm truncate pr-2 text-slate-900 dark:text-slate-100">{template.title}</span>
                                    {selectedWaLead && isTemplateUsed(selectedWaLead, template.id) && (
                                        <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 h-5 px-1.5 font-normal">
                                            Dikirim {selectedWaLead.templateHistory?.filter(h => h.templateId === template.id).length}x
                                        </Badge>
                                    )}
                                 </div>
                                 <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">{template.message}</span>
                             </div>
                         </div>
                    </Button>
                )) : (
                    <div className="text-center py-8 text-slate-400 text-xs flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl">📭</div>
                        <span>Belum ada template tersedia</span>
                    </div>
                )}
            </div>
        </SheetContent>
      </Sheet>
    </OperationalPageShell>
  );
};
