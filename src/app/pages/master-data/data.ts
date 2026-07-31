export type Role = 'Owner' | 'Super Admin' | 'Admin PIC' | 'CS' | 'Advertiser' | 'Teknisi' | 'Finance';
export type CsAssignmentStatus = 'available' | 'busy' | 'offline';

export interface Platform { id: string; name: string; status: 'active' | 'inactive'; logoPath?: string | null; }
export interface SubChannel { id: string; name: string; platformId: string; status: 'active' | 'inactive'; }
export interface User { 
  id: string; 
  name: string; 
  role: Role; 
  status: 'active' | 'inactive'; 
  email?: string; 
  phone?: string; 
  lastLogin?: string; 
  avatar?: string; 
  avatar_url?: string;
  branchId?: string;
  employmentStatus?: 'permanent' | 'freelance' | 'training'; // New field
  joinDate?: string;
  bankName?: string;
  bankAccountNumber?: string;
  emergencyPhone?: string;
  parentUserId?: string; // Links CS to Advertiser
  csWhatsappNumber?: string;
  csDisplayName?: string;
  csAssignmentStatus?: CsAssignmentStatus;
  csMaxActiveChats?: number;
  csNotes?: string;
}
export interface Branch { 
  id: string; 
  name: string; 
  code?: string; 
  city: string; 
  location?: string;
  address?: string;
  radius?: number; 
  geofence?: string; 
  mapsUrl?: string; 
  lat?: number;
  lng?: number;
  status: 'active' | 'inactive' | 'coming_soon';
  openingDate?: string; // Tanggal Rilis / Buka
  createdAt?: string; 
}
export interface AdAccount { id: string; platformId: string; advertiserId: string; accountName: string; status: 'active' | 'inactive'; ppn?: number; fee?: number; }
export interface AdAccountOwnerAssignment {
  id: string;
  adAccountId: string;
  advertiserId: string;
  startDate: string;
  endDate?: string | null;
  status: 'active' | 'inactive';
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
export interface AdAccountAssignment {
  id: string;
  adAccountId: string;
  csId: string;
  subChannelId?: string | null;
  startDate: string;
  endDate?: string | null;
  status: 'active' | 'inactive';
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
export interface Area { id: string; name: string; branchId: string; status: 'active' | 'inactive'; }
export interface ServiceType { id: string; name: string; category: string; description?: string; price: number; status: 'active' | 'inactive'; }
export interface TechnicianTeam { id: string; name: string; branchId: string; leaderId?: string; memberIds?: string[]; status: 'active' | 'inactive'; }
export interface AdSource { id: string; name: string; adAccountId: string; defaultCsName?: string; status: 'active' | 'inactive'; }
export interface PaymentMethod { id: string; bankName: string; accountNumber: string; accountHolder: string; status: 'active' | 'inactive'; }
export interface VehicleType { id: string; name: string; category: string; status: 'active' | 'inactive'; }
export type LeadStatus = 'Pending' | 'Follow Up' | 'Booking' | 'Closing' | 'Cancel';
export type LeadSocialPlatform = 'instagram' | 'tiktok';
export type ProspectBookingStatus = 'tentative' | 'confirmed' | 'reschedule' | 'cancelled';

export interface TemplateHistory {
  templateId: string;
  templateName: string;
  sentAt: string; // ISO Date
  sentBy?: string; // User ID of who sent it
}

export interface Lead { 
  id: string; 
  name: string; 
  phone: string; 
  platformId?: string; // Changed from sourceId, optional, links to Platform
  subChannelId?: string; // Optional, links to SubChannel
  advertiserId?: string; // New field for Advertiser
  vehicleId?: string; // Changed from vehicleName, optional, links to VehicleType
  csId?: string; // New field for Customer Service / Staff
  serviceId?: string;
  status: LeadStatus; 
  notes?: string; 
  timestamp: string; // ISO date string
  lastContact?: string;
  templateHistory?: TemplateHistory[]; // Track sent templates
  affiliateId?: string; // New field for Affiliate
  socialPlatform?: LeadSocialPlatform;
  socialUsername?: string;
  socialProfileUrl?: string;
  socialChatUrl?: string;
  embedFormId?: string;
  embedFormSubmissionId?: string;
  embedFormSlug?: string;
  embedFormName?: string;
  origin?: string;
  landingPageUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}

export interface ProspectBooking {
  id: string;
  leadId: string;
  orderId?: string;
  customerName: string;
  customerPhone: string;
  scheduleDate: string;
  scheduleTime: string;
  branchId: string;
  areaId?: string;
  address?: string;
  mapsUrl?: string;
  notes?: string;
  status: ProspectBookingStatus;
  csId?: string;
  advertiserId?: string;
  technicianId?: string;
  vehicleId?: string;
  platformId?: string;
  subChannelId?: string;
  serviceId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Order {
  id: string; // Id order
  leadDate?: string; // Tanggal Leads
  customerName: string; // Nama Lengkap Client
  customerPhone: string; // No Whatsapp
  address: string; // Alamat Lengkap
  serviceDate: string; // Tanggal Service
  serviceTime: string; // Jam
  serviceId: string; // Layanan (Link to ServiceType)
  serviceCategory: string; // jenis Layanan
  mapsUrl?: string; // Maps URL
  vehicleId: string; // Tipe Mobil (Link to VehicleType)
  units: number; // Jumlah Unit
  price: number; // Harga
  platformId?: string; // Platform
  subChannelId?: string; // Sub Channel
  csId?: string; // Customer Service
  advertiserId?: string; // Advertiser
  notes?: string; // Catatan
  technicianId?: string; // Teknisi
  branchId: string; // Cabang
  areaId?: string; // Daerah
  status: 'pending' | 'processing' | 'waiting' | 'done' | 'cancelled' | 'reschedule' | 'teknisi_completed' | 'otw' | 'working' | 'qc'; // Status Service
  effectiveStatus?: string;
  rating?: number;
  paymentType?: 'Transfer' | 'Cash'; // Jenis Pembayaran
  paymentMethodId?: string; // Metode Pembayaran & Akun Bank
  income?: number; // Uang Masuk
  paymentStatus: 'Unpaid' | 'Down Payment' | 'Paid'; // Status Pembayaran
  paymentValidation: 'Pending' | 'Valid' | 'Invalid'; // Validasi Payment
  affiliateName?: string; // Affiliate
  lat?: number;
  lng?: number;
  leadId?: string;
  templateHistory?: TemplateHistory[];
  created_at?: string; // Added field for creation timestamp
  photos?: {
    before?: string[];
    after?: string[];
    payment?: string[];
    signature?: string; // URL of the signature image
  };
  // Tracking
  startTravelAt?: string;
  startWorkAt?: string;
  finishedAt?: string;
  payload?: any;
  // Cancel/Reschedule Tracking
  cancelReason?: string;
  cancelReasonNote?: string;
  isFollowedUp?: boolean;
  followedUpBy?: string;
  followedUpAt?: string;
  followUpNote?: string;
}

export type PaymentTransactionStatus =
  | 'pending'
  | 'requires_action'
  | 'paid'
  | 'expired'
  | 'failed'
  | 'cancelled';

export interface PaymentTransaction {
  id: string;
  orderId: string;
  amount: number;
  paymentMethod: 'qris';
  gatewayProvider: 'xendit' | 'mock';
  status: PaymentTransactionStatus;
  providerStatus?: string;
  channelCode?: string;
  referenceId?: string;
  paymentRequestId?: string;
  paymentId?: string;
  qrString?: string;
  qrImageUrl?: string;
  checkoutUrl?: string;
  expiresAt?: string;
  paidAt?: string;
  cancelledAt?: string;
  description?: string;
  metadata?: Record<string, any>;
  providerPayload?: any;
  createdAt?: string;
  updatedAt?: string;
}

// Cancel/Reschedule Reason Lookup
export interface CancelReason {
  id: string;
  type: 'cancel' | 'reschedule';
  label: string;
  sort_order: number;
  is_active: boolean;
}

export interface Notification {
  id: string;
  userId: string; // The user who receives the notification
  title: string;
  message: string;
  isRead: boolean;
  type: 'info' | 'warning' | 'success' | 'error';
  relatedId?: string; // Optional: Link to Order ID or Lead ID
  createdAt: string;
}

export interface Affiliate {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  status: 'Active' | 'Inactive';
  createdAt?: string;
}

export interface Vendor {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  status: 'active' | 'inactive';
  createdAt?: string;
}

export const MOCK_ORDERS: Order[] = [
    {
      id: 'ORD-001',
      leadDate: '2026-01-05',
      customerName: 'Budi Santoso',
      customerPhone: '081234567890',
      address: 'Jl. Sudirman No. 123, Jakarta',
      serviceDate: '2026-01-08',
      serviceTime: '08:00',
      serviceId: 's1', // Nano Burn Coating
      serviceCategory: 'Restoration',
      mapsUrl: 'https://maps.google.com/?q=Jl.+Sudirman+No.+123,+Jakarta',
      vehicleId: 'v1', // Avanza
      price: 350000,
      units: 1,
      platformId: 'p1', // Meta Ads
      csId: 'u4', // Budi (CS)
      notes: 'Mohon datang tepat waktu',
      technicianId: 'u6', // Andi (Teknisi)
      branchId: 'b3', // Jakarta Pusat
      areaId: '4', // Kemayoran
      status: 'pending',
      paymentType: 'Transfer',
      paymentMethodId: 'pm1', // BCA
      paymentStatus: 'Unpaid',
      paymentValidation: 'Pending',
      lat: -6.2088,
      lng: 106.8456,
      affiliateName: 'Bengkel Maju'
    },
    {
      id: 'ORD-002',
      leadDate: '2026-01-06',
      customerName: 'Siti Aminah',
      customerPhone: '081298765432',
      address: 'Jl. Gatot Subroto No. 45, Jakarta',
      serviceDate: '2026-01-08',
      serviceTime: '10:00',
      serviceId: 's2', // Black Housing
      serviceCategory: 'Modification',
      vehicleId: 'v2', // Pajero
      price: 500000,
      units: 1,
      platformId: 'p2', // TikTok Ads
      csId: 'u5', // Siti (CS)
      technicianId: 'u9', // Rudi Teknisi
      branchId: 'b3',
      areaId: '4',
      status: 'processing',
      paymentStatus: 'Down Payment',
      paymentValidation: 'Valid',
      paymentMethodId: 'pm2', // Mandiri
      lat: -6.2258,
      lng: 106.8351,
    },
    {
      id: 'ORD-003',
      leadDate: '2026-01-04',
      customerName: 'Joko Widodo',
      customerPhone: '081356789012',
      address: 'Jl. Thamrin No. 78, Jakarta',
      serviceDate: '2026-01-08',
      serviceTime: '13:00',
      serviceId: 's3', // Lazy Eyes
      serviceCategory: 'Modification',
      vehicleId: 'v3', // Brio
      price: 750000,
      units: 1,
      platformId: 'p1',
      csId: 'u4',
      technicianId: 'u6',
      branchId: 'b3',
      status: 'waiting',
      paymentStatus: 'Paid',
      paymentValidation: 'Valid',
      paymentMethodId: 'pm1',
      lat: -6.1944,
      lng: 106.8229,
    },
    {
      id: 'ORD-004',
      leadDate: '2026-01-07',
      customerName: 'Rina Bogor',
      customerPhone: '081212345678',
      address: 'Jl. Raya Pajajaran No. 20, Bogor',
      serviceDate: '2026-01-08',
      serviceTime: '15:00',
      serviceId: 's1',
      serviceCategory: 'Restoration',
      vehicleId: 'v1',
      price: 350000,
      units: 1,
      platformId: 'p1',
      csId: 'u4',
      technicianId: 'u6',
      branchId: 'b1', // Bogor branch
      status: 'pending',
      paymentStatus: 'Unpaid',
      paymentValidation: 'Pending',
      paymentMethodId: 'pm1',
      lat: -6.5950, // Real Bogor Coords
      lng: 106.8166,
      mapsUrl: 'https://maps.google.com/?q=-6.5950,106.8166'
    },
];

export interface WATemplate {
    id: string;
    title: string;
    message: string;
    category?: 'Leads' | 'Orders' | 'General' | 'Teknisi';
    usage_count?: number; // Tracks how many times this template has been used
}

export interface DailyAd {
  id: string;
  date: string; // YYYY-MM-DD
  advertiserId: string;
  platformId: string;
  subChannelId?: string;
  adAccountId: string;
  csId?: string;
  amountSpent: number;
  leadsDashboard: number;
  ppnAmount?: number; // Snapshot nominal PPN saat input
  feeAmount?: number; // Snapshot nominal Fee saat input
  editCount?: number; // Track how many times this record has been edited
  // Computed for UI
  cpl?: number;
}

export interface LeadSpamDailyInput {
  id: string;
  inputDate: string; // YYYY-MM-DD
  csId: string;
  platformId: string;
  advertiserId: string;
  spamCount: number;
  notes?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const MOCK_DAILY_ADS: DailyAd[] = [];

export const MOCK_WA_TEMPLATES: WATemplate[] = [
    { 
      id: 't1',
      title: 'Sapaan Awal', 
      category: 'Leads',
      message: "Halo Kak [Nama], terima kasih sudah menghubungi Restoration Headlamp Indonesia. Ada yang bisa kami bantu untuk masalah lampu mobilnya?" 
    },
    { 
      id: 't2',
      title: 'Follow Up Penawaran', 
      category: 'Leads',
      message: "Halo Kak [Nama], mau follow up untuk rencana restorasi headlamp mobil [Mobil]-nya. Apakah jadi dijadwalkan minggu ini?" 
    },
    { 
      id: 't3',
      title: 'Konfirmasi Jadwal', 
      category: 'Orders',
      message: "Halo Kak [Nama], kami konfirmasi ulang untuk jadwal pengerjaan tim teknisi kami besok ya. Mohon share location alamat lengkapnya." 
    },
    { 
      id: 't4',
      title: 'Laporan Selesai', 
      category: 'Orders',
      message: "Halo Kak [Nama], pengerjaan restorasi headlamp sudah selesai. Terima kasih sudah mempercayakan RHI!" 
    },
    { 
      id: 't5',
      title: 'Promo Spesial', 
      category: 'General',
      message: "Halo Kak [Nama], RHI lagi ada promo diskon khusus bulan ini untuk paket Nano Burn Coating. Minat booking slotnya?" 
    },
    { 
      id: 't6',
      title: 'Konfirmasi OTW', 
      category: 'Teknisi',
      message: "Halo Kak [Nama], saya teknisi dari RHI sedang menuju ke lokasi. Estimasi sampai dalam 30 menit." 
    },
    { 
      id: 't7',
      title: 'Sudah Sampai', 
      category: 'Teknisi',
      message: "Halo Kak, saya sudah sampai di depan lokasi/rumah ya." 
    },
    { 
      id: 't8',
      title: 'Izin Mulai', 
      category: 'Teknisi',
      message: "Permisi Kak, izin memulai pengerjaan unitnya sekarang ya." 
    },
    { 
      id: 't9',
      title: 'Laporan Selesai (Teknisi)', 
      category: 'Teknisi',
      message: "Pengerjaan sudah selesai Kak. Silakan dicek kembali hasilnya." 
    },
    { 
      id: 't10',
      title: 'Konfirmasi H-1', 
      category: 'Teknisi',
      message: "Selamat siang Kak [Nama], mengonfirmasi jadwal kunjungan teknisi besok jam [Jam] ya." 
    }
];

export const MOCK_LEADS: Lead[] = [
  {
    id: 'l1',
    name: 'Budi Santoso',
    phone: '081234567890',
    platformId: 'p1', // Meta Ads
    advertiserId: 'u1', // Adit
    vehicleId: 'v1', // Avanza
    csId: 'u4', // Budi (CS)
    status: 'Pending',
    notes: 'Ingin polish headlamp + coating',
    timestamp: '2025-01-07T14:30:00Z',
    lastContact: '1 jam lalu',
  },
  {
    id: 'l2',
    name: 'Siti Aminah',
    phone: '081298765432',
    platformId: 'p1', // Meta Ads
    advertiserId: 'u1', // Adit
    vehicleId: 'v1', // Avanza
    csId: 'u5', // Siti (CS)
    status: 'Closing',
    notes: 'Headlamp kusam, perlu pengecekan',
    timestamp: '2025-01-07T10:15:00Z',
    lastContact: '3 jam lalu',
  },
  {
    id: 'l3',
    name: 'Joko Widodo',
    phone: '081356789012',
    platformId: 'p3', // Google Ads
    advertiserId: 'u2', // Fajar
    vehicleId: 'v2', // Pajero
    csId: 'u4', // Budi (CS)
    status: 'Pending',
    notes: 'Tanya harga coating headlamp',
    timestamp: '2025-01-06T16:45:00Z',
    lastContact: '1 hari lalu',
  },
  {
    id: 'l4',
    name: 'Dewi Lestari',
    phone: '081267890123',
    platformId: 'p2', // TikTok Ads
    advertiserId: 'u3', // Rani
    vehicleId: 'v3', // Brio
    csId: 'u5', // Siti (CS)
    status: 'Closing',
    notes: 'Sudah jadi pesanan',
    timestamp: '2025-01-05T09:20:00Z',
    lastContact: '2 hari lalu',
  },
];

// Simple interfaces for generic use
export interface SimpleMasterItem { id: string; name: string; status: 'active' | 'inactive'; description?: string; [key: string]: any; }

export interface SubChannelItem { id: string; name: string; platformId: string; status: 'active' | 'inactive'; }

export interface RoleItem { id: string; name: string; status: 'active' | 'inactive'; description?: string; }

export type MasterTabId =
  | 'branches'
  | 'areas'
  | 'services'
  | 'vehicles'
  | 'platforms'
  | 'ad_accounts'
  | 'sources'
  | 'payments'
  | 'teams'
  | 'staff_status'
  | 'employment'
  | 'banks';

export type MasterDataItem =
  | Branch
  | Area
  | ServiceType
  | VehicleType
  | Platform
  | AdAccount
  | AdSource
  | PaymentMethod
  | TechnicianTeam
  | SimpleMasterItem;

export const MOCK_ROLES: RoleItem[] = [
  { id: 'r1', name: 'Owner', status: 'active' },
  { id: 'r2', name: 'Super Admin', status: 'active' },
  { id: 'r3', name: 'Admin PIC', status: 'active' },
  { id: 'r4', name: 'CS', status: 'active' },
  { id: 'r5', name: 'Advertiser', status: 'active' },
  { id: 'r6', name: 'Teknisi', status: 'active' },
  { id: 'r7', name: 'Finance', status: 'active' },
];

// MOCK DATA
export const MOCK_PLATFORMS: Platform[] = [
  { id: 'p1', name: 'Meta Ads', status: 'active' },
  { id: 'p2', name: 'TikTok Ads', status: 'active' },
  { id: 'p3', name: 'Google Ads', status: 'active' },
  { id: 'p4', name: 'SnackVideo Ads', status: 'active' },
];

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Adit Pramuji', role: 'Advertiser', status: 'active', email: 'adit@rhi.id', phone: '081234567891', lastLogin: '2023-10-25 08:00' },
  { id: 'u2', name: 'Fajar', role: 'Advertiser', status: 'active', email: 'fajar@rhi.id', phone: '081234567892', lastLogin: '2023-10-24 14:00' },
  { id: 'u3', name: 'Rani', role: 'Advertiser', status: 'active', email: 'rani@rhi.id', phone: '081234567893', lastLogin: '2023-10-25 09:15' },
  { id: 'u4', name: 'Budi (CS)', role: 'CS', status: 'active', email: 'budi@rhi.id', phone: '081234567894', csWhatsappNumber: '6281234567894', csDisplayName: 'CS Budi', csAssignmentStatus: 'available', csMaxActiveChats: 25, lastLogin: '2023-10-25 10:30' },
  { id: 'u5', name: 'Siti (CS)', role: 'CS', status: 'active', email: 'siti@rhi.id', phone: '081234567895', csWhatsappNumber: '6281234567895', csDisplayName: 'CS Siti', csAssignmentStatus: 'busy', csMaxActiveChats: 20, lastLogin: '2023-10-24 16:45' },
  { id: 'u6', name: 'Andi (Teknisi)', role: 'Teknisi', status: 'active', email: 'andi@rhi.id', phone: '081234567896', lastLogin: '2023-10-23 08:30', branchId: 'b1' },
  { id: 'u7', name: 'Budi Santoso', role: 'Owner', status: 'active', email: 'owner@rhi.id', phone: '081234567890', lastLogin: '2023-10-25 08:00' },
  { id: 'u8', name: 'Siti Admin', role: 'Super Admin', status: 'active', email: 'admin@rhi.id', phone: '081234567898', lastLogin: '2023-10-25 09:15' },
  { id: 'u9', name: 'Rudi Teknisi', role: 'Teknisi', status: 'active', email: 'tech1@rhi.id', phone: '081234567899', lastLogin: '2023-10-24 14:00', branchId: 'b2' },
  { id: 'u10', name: 'Dewi Finance', role: 'Finance', status: 'active', email: 'finance@rhi.id', phone: '081234567800', lastLogin: '2023-10-25 10:30' },
];

export const ROLE_LIST: Role[] = ['Owner', 'Super Admin', 'Admin PIC', 'Finance', 'CS', 'Advertiser', 'Teknisi'];

// Alias for Advertisers for backward compatibility
export const MOCK_ADVERTISERS = MOCK_USERS.filter(u => u.role === 'Advertiser');

export const MOCK_BRANCHES: Branch[] = [
  { id: 'b1', name: 'Bogor', code: 'BOG-01', city: 'Bogor', address: 'Jl. Raya Bogor KM 42, Cibinong', radius: 25, mapsUrl: 'https://maps.google.com/?q=Bogor', lat: -6.4764, lng: 106.8451, status: 'active', createdAt: '2023-01-01T10:00:00Z' },
  { id: 'b2', name: 'Tangerang', code: 'TNG-01', city: 'Tangerang', address: 'Jl. Daan Mogot KM 20, Tangerang', radius: 30, mapsUrl: 'https://maps.google.com/?q=Tangerang', lat: -6.1731, lng: 106.6300, status: 'active', createdAt: '2023-02-15T14:30:00Z' },
  { id: 'b3', name: 'Jakarta Pusat', code: 'JKT-01', city: 'Jakarta Pusat', address: 'Jl. Kemayoran Gempol, Jakarta Pusat', radius: 15, mapsUrl: 'https://maps.google.com/?q=Jakarta+Pusat', lat: -6.1606, lng: 106.8499, status: 'active', createdAt: '2023-03-20T09:15:00Z' },
  { id: 'b4', name: 'Bekasi', code: 'BKS-01', city: 'Bekasi', address: 'Jl. Ahmad Yani No. 10, Bekasi', radius: 20, mapsUrl: 'https://maps.google.com/?q=Bekasi', lat: -6.2383, lng: 106.9756, status: 'active', createdAt: '2023-04-10T11:45:00Z' },
];

export const INITIAL_AD_ACCOUNTS: AdAccount[] = [
  { id: '1', platformId: 'p1', advertiserId: 'u1', accountName: 'RHI-BM-01', status: 'active', ppn: 11, fee: 2 },
  { id: '2', platformId: 'p1', advertiserId: 'u1', accountName: 'RHI-BM-02', status: 'active', ppn: 11, fee: 1.5 },
  { id: '3', platformId: 'p2', advertiserId: 'u2', accountName: 'RHI-TK-01', status: 'active', ppn: 11, fee: 3 },
  { id: '4', platformId: 'p3', advertiserId: 'u3', accountName: 'RHI-GA-01', status: 'active', ppn: 11, fee: 5 },
];

export const MOCK_AREAS: Area[] = [
  { id: '1', name: 'Cibinong', branchId: 'b1', status: 'active' },
  { id: '2', name: 'Sentul', branchId: 'b1', status: 'active' },
  { id: '3', name: 'BSD City', branchId: 'b2', status: 'active' },
  { id: '4', name: 'Kemayoran', branchId: 'b3', status: 'active' },
  { id: '5', name: 'Jatiasih', branchId: 'b4', status: 'active' },
];

export const MOCK_SERVICES: ServiceType[] = [
  { id: 's1', name: 'Nano Burn Coating', category: 'Restoration', price: 350000, status: 'active' },
  { id: 's2', name: 'Black Housing', category: 'Modification', price: 450000, status: 'active' },
  { id: 's3', name: 'Lazy Eyes', category: 'Modification', price: 600000, status: 'active' },
  { id: 's4', name: 'Cuci Headlamp', category: 'Cleaning', price: 150000, status: 'active' },
];

export const MOCK_VEHICLES: VehicleType[] = [
  { id: 'v1', name: 'Avanza', category: 'medium', status: 'active' },
  { id: 'v2', name: 'Pajero Sport', category: 'large', status: 'active' },
  { id: 'v3', name: 'Brio', category: 'small', status: 'active' },
  { id: 'v4', name: 'Alphard', category: 'luxury', status: 'active' },
];

export const MOCK_TEAMS: TechnicianTeam[] = [
  { id: 't1', name: 'Tim A - Bogor', branchId: 'b1', leaderId: 'u6', status: 'active' },
  { id: 't2', name: 'Tim B - Tangerang', branchId: 'b2', status: 'active' },
];

export const MOCK_SOURCES: AdSource[] = [
  { id: 'src1', name: 'IG - Promo Merdeka', adAccountId: '1', defaultCsName: 'Budi (CS)', status: 'active' },
  { id: 'src2', name: 'FB - Paket Bundling', adAccountId: '2', defaultCsName: 'Siti (CS)', status: 'active' },
];

export const MOCK_PAYMENTS: PaymentMethod[] = [
  { id: 'pm1', bankName: 'BCA', accountNumber: '8730123456', accountHolder: 'PT Restoration Headlamp', status: 'active' },
  { id: 'pm2', bankName: 'Mandiri', accountNumber: '1230009876543', accountHolder: 'PT Restoration Headlamp', status: 'active' },
];

export const MOCK_STAFF_STATUS: SimpleMasterItem[] = [
  { id: 'staff-active', name: 'Aktif', status: 'active' },
  { id: 'staff-inactive', name: 'Non Aktif', status: 'inactive' },
];

export const MOCK_EMPLOYMENT: SimpleMasterItem[] = [
  { id: 'employment-permanent', name: 'Permanent', status: 'active' },
  { id: 'employment-freelance', name: 'Freelance', status: 'active' },
  { id: 'employment-training', name: 'Training', status: 'active' },
];

export const MOCK_BANKS: SimpleMasterItem[] = [
  { id: 'bank-bca', name: 'BCA', status: 'active' },
  { id: 'bank-mandiri', name: 'Mandiri', status: 'active' },
  { id: 'bank-bri', name: 'BRI', status: 'active' },
  { id: 'bank-bni', name: 'BNI', status: 'active' },
];

export const AVAILABLE_TIME_SLOTS = [
  "08:00", "10:00", "12:00", "15:00", "17:00", "19:00"
];

// Legacy Exports for backward compatibility
export const MOCK_AD_ACCOUNTS = INITIAL_AD_ACCOUNTS.map(acc => ({
  ...acc,
  platformName: MOCK_PLATFORMS.find(p => p.id === acc.platformId)?.name || 'Unknown',
  advertiserName: MOCK_USERS.find(u => u.id === acc.advertiserId)?.name || 'Unknown'
}));
