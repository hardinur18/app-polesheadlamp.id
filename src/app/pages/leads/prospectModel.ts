import { format } from 'date-fns';
import type { Lead, LeadStatus, ProspectBooking, WATemplate } from '../master-data/data';

export const AUTO_WHATSAPP_LEAD_ORIGIN = 'auto_wa_api';
export const ALL_FILTER = 'all';
export const LEAD_PAGE_SIZE_OPTIONS = [50, 100, 300, 500] as const;
export const MANDATORY_PLATFORM_NAMES = ['repeat order', 'organik'];
export const EDITABLE_LEAD_STATUS_OPTIONS: LeadStatus[] = ['Pending', 'Follow Up', 'Booking', 'Cancel'];

export const toLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const uniqueById = <T extends { id: string }>(items: T[]) =>
  Array.from(new Map(items.map((item) => [item.id, item])).values());

export const isAutoWhatsAppLead = (lead: Pick<Lead, 'origin' | 'lastContact' | 'notes'>) => (
  lead.origin === AUTO_WHATSAPP_LEAD_ORIGIN ||
  lead.lastContact === 'Auto WA API' ||
  Boolean(lead.notes?.toLowerCase().includes('auto wa api'))
);

const sortBookingsByLatestUpdate = (bookings: ProspectBooking[]) =>
  [...bookings].sort((left, right) => {
    const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
    const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
    return rightTime - leftTime;
  });

export const buildLatestBookingByLeadId = (bookings: ProspectBooking[]) => {
  const map = new Map<string, ProspectBooking>();
  sortBookingsByLatestUpdate(bookings).forEach((booking) => {
    if (!map.has(booking.leadId)) {
      map.set(booking.leadId, booking);
    }
  });
  return map;
};

export const buildActiveBookingByLeadId = (bookings: ProspectBooking[]) => {
  const map = new Map<string, ProspectBooking>();
  sortBookingsByLatestUpdate(bookings).forEach((booking) => {
    const isActive = booking.status !== 'cancelled' && !booking.orderId;
    if (isActive && !map.has(booking.leadId)) {
      map.set(booking.leadId, booking);
    }
  });
  return map;
};

export const getProspectBookingSummary = (booking?: ProspectBooking | null) => {
  if (!booking?.scheduleDate || !booking?.scheduleTime) return null;
  return `${format(new Date(booking.scheduleDate), 'dd MMM yyyy')} - ${booking.scheduleTime}`;
};

export const formatProspectBookingDate = (booking?: ProspectBooking | null) => {
  if (!booking?.scheduleDate) return '-';
  return format(new Date(booking.scheduleDate), 'dd MMM yyyy');
};

export const getProspectBookingStatusLabel = (booking?: ProspectBooking | null) => {
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

export const getProspectStatusBadgeClass = (status: LeadStatus) => {
  switch (status) {
    case 'Pending': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'Follow Up': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Booking': return 'bg-violet-50 text-violet-700 border-violet-200';
    case 'Closing': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Cancel': return 'bg-red-50 text-red-700 border-red-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

export const normalizeLeadNotes = (notes?: string) => notes?.replace(/\s+/g, ' ').trim() || '';

export const getLeadNotesPreview = (notes?: string, maxLength = 96) => {
  const normalizedNotes = normalizeLeadNotes(notes);
  if (!normalizedNotes) return '-';
  if (normalizedNotes.length <= maxLength) return normalizedNotes;
  return `${normalizedNotes.slice(0, maxLength).trimEnd()}...`;
};

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

export const sortLeadTemplatesForDisplay = (left: WATemplate, right: WATemplate) => {
  const leftOrder = getLeadTemplateOrder(left);
  const rightOrder = getLeadTemplateOrder(right);

  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  return left.title.localeCompare(right.title, 'id-ID', { sensitivity: 'base' });
};
