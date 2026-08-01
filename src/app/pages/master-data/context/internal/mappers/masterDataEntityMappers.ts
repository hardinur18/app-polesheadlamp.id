import {
  AdAccount,
  AdAccountAssignment,
  AdAccountOwnerAssignment,
  AdSource,
  Affiliate,
  Area,
  Branch,
  CancelReason,
  PaymentMethod,
  Platform,
  RoleItem,
  SubChannel,
  Vendor,
} from '../../../data';

export const mapBranchFromDB = (b: any): Branch => ({
  id: b.id,
  name: b.name,
  code: b.code,
  city: b.city,
  address: b.address,
  radius: b.radius,
  mapsUrl: b.maps_url,
  lat: b.lat,
  lng: b.lng,
  status: b.status,
  openingDate: b.opening_date,
  createdAt: b.created_at,
});

export const mapBranchToDB = (b: Branch) => ({
  id: b.id,
  name: b.name,
  code: b.code,
  city: b.city,
  address: b.address,
  radius: b.radius,
  maps_url: b.mapsUrl,
  lat: b.lat,
  lng: b.lng,
  status: b.status,
  opening_date: b.openingDate?.trim() ? b.openingDate : null,
});

export const mapAreaFromDB = (a: any): Area => ({
  id: a.id,
  name: a.name,
  branchId: a.branch_id,
  status: a.status,
});

export const mapAreaToDB = (a: Area) => ({
  id: a.id,
  name: a.name,
  branch_id: a.branchId,
  status: a.status,
});

export const mapAdAccountFromDB = (a: any): AdAccount => ({
  id: a.id,
  accountName: a.account_name,
  platformId: a.platform_id,
  advertiserId: a.advertiser_id,
  subChannelId: a.sub_channel_id || null,
  status: a.status,
  ppn: a.ppn ?? 0,
  fee: a.fee ?? 0,
});

export const mapAdAccountToDB = (a: AdAccount) => ({
  id: a.id,
  account_name: a.accountName,
  platform_id: a.platformId,
  advertiser_id: a.advertiserId,
  sub_channel_id: a.subChannelId || null,
  status: a.status,
  ppn: a.ppn ?? 0,
  fee: a.fee ?? 0,
});

export const mapAdAccountOwnerAssignmentFromDB = (a: any): AdAccountOwnerAssignment => ({
  id: a.id,
  adAccountId: a.ad_account_id,
  advertiserId: a.advertiser_id,
  startDate: a.start_date,
  endDate: a.end_date,
  status: a.status,
  notes: a.notes || null,
  createdAt: a.created_at,
  updatedAt: a.updated_at,
});

export const mapAdAccountOwnerAssignmentToDB = (a: AdAccountOwnerAssignment) => ({
  id: a.id,
  ad_account_id: a.adAccountId,
  advertiser_id: a.advertiserId,
  start_date: a.startDate,
  end_date: a.endDate || null,
  status: a.status || 'active',
  notes: a.notes || null,
});

export const mapAdAccountAssignmentFromDB = (a: any): AdAccountAssignment => ({
  id: a.id,
  adAccountId: a.ad_account_id,
  csId: a.cs_id,
  subChannelId: a.sub_channel_id,
  startDate: a.start_date,
  endDate: a.end_date,
  status: a.status,
  notes: a.notes || null,
  createdAt: a.created_at,
  updatedAt: a.updated_at,
});

export const mapAdAccountAssignmentToDB = (a: AdAccountAssignment) => ({
  id: a.id,
  ad_account_id: a.adAccountId,
  cs_id: a.csId,
  sub_channel_id: a.subChannelId || null,
  start_date: a.startDate,
  end_date: a.endDate || null,
  status: a.status || 'active',
  notes: a.notes || null,
});

export const mapAdSourceFromDB = (s: any): AdSource => ({
  id: s.id,
  name: s.name,
  adAccountId: s.ad_account_id,
  defaultCsName: s.default_cs_name,
  status: s.status,
});

export const mapAdSourceToDB = (s: AdSource) => ({
  id: s.id,
  name: s.name,
  ad_account_id: s.adAccountId,
  default_cs_name: s.defaultCsName,
  status: s.status,
});

export const mapPaymentFromDB = (p: any): PaymentMethod => ({
  id: p.id,
  bankName: p.bank_name,
  accountNumber: p.account_number,
  accountHolder: p.account_holder,
  status: p.status,
  logoPath: p.logo_path || p.logoPath || null,
});

export const mapPaymentToDB = (p: PaymentMethod) => ({
  id: p.id,
  bank_name: p.bankName,
  account_number: p.accountNumber,
  account_holder: p.accountHolder,
  status: p.status,
  logo_path: p.logoPath || null,
});

export const mapRoleFromDB = (r: any): RoleItem => ({
  id: String(r.id),
  name: r.name,
  description: r.description,
  status: 'active',
});

export const mapRoleToDB = (r: RoleItem) => ({
  id: r.id,
  name: r.name,
  description: r.description,
});

export const mapPlatformFromDB = (p: any): Platform => ({
  id: p.id,
  name: p.name,
  status: p.status,
  logoPath: p.logo_path || p.logoPath || null,
});

export const mapPlatformToDB = (p: Platform) => ({
  id: p.id,
  name: p.name,
  status: p.status,
  logo_path: p.logoPath || null,
});

export const mapSubChannelFromDB = (s: any): SubChannel => ({
  id: s.id,
  name: s.name,
  platformId: s.platform_id,
  status: s.status,
});

export const mapSubChannelToDB = (s: SubChannel) => ({
  id: s.id,
  name: s.name,
  platform_id: s.platformId,
  status: s.status,
});

export const mapAffiliateFromDB = (a: any): Affiliate => ({
  id: a.id,
  name: a.name,
  contactPerson: a.contact_person,
  phone: a.phone,
  address: a.address,
  status: a.status,
  createdAt: a.created_at,
});

export const mapAffiliateToDB = (a: Affiliate) => ({
  id: a.id,
  name: a.name,
  contact_person: a.contactPerson,
  phone: a.phone,
  address: a.address,
  status: a.status,
});

export const mapVendorFromDB = (v: any): Vendor => ({
  id: v.id,
  name: v.name,
  phone: v.phone,
  address: v.address,
  status: v.status,
  createdAt: v.created_at,
});

export const mapVendorToDB = (v: Vendor) => ({
  id: v.id,
  name: v.name,
  phone: v.phone,
  address: v.address,
  status: v.status,
});

export const mapCancelReasonFromDB = (r: any): CancelReason => ({
  id: r.id,
  type: r.type,
  label: r.label,
  sort_order: r.sort_order,
  is_active: r.is_active,
});

export const mapCancelReasonToDB = (r: CancelReason) => ({
  id: r.id,
  type: r.type,
  label: r.label,
  sort_order: r.sort_order,
  is_active: r.is_active,
});
