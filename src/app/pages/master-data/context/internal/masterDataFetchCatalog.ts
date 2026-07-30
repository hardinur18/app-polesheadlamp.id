import type { Dispatch, SetStateAction } from 'react';
import type {
  AdAccount,
  AdAccountAssignment,
  AdAccountOwnerAssignment,
  AdSource,
  Affiliate,
  Area,
  Branch,
  CancelReason,
  DailyAd,
  Lead,
  LeadSpamDailyInput,
  Order,
  PaymentMethod,
  Platform,
  ProspectBooking,
  RoleItem,
  ServiceType,
  SubChannel,
  VehicleType,
  Vendor,
  WATemplate,
} from '../../data';
import {
  mapAdAccountFromDB,
  mapAdAccountAssignmentFromDB,
  mapAdAccountOwnerAssignmentFromDB,
  mapAdSourceFromDB,
  mapAffiliateFromDB,
  mapAreaFromDB,
  mapBranchFromDB,
  mapCancelReasonFromDB,
  mapPaymentFromDB,
  mapPlatformFromDB,
  mapRoleFromDB,
  mapSubChannelFromDB,
  mapVendorFromDB,
} from './mappers/masterDataEntityMappers';
import {
  mapDailyAdFromDB,
  mapLeadSpamDailyInputFromDB,
  mapScheduleFromDB,
  mapWATemplateFromDB,
} from './mappers/miscMappers';
import {
  mapOrderFromDB,
  mapProspectBookingFromDB,
} from './mappers/transactionMappers';

type StateSetter<T> = Dispatch<SetStateAction<T[]>>;

type TechnicianScheduleLike = {
  id: string;
  userId: string;
  date: string;
  type: 'Libur' | 'Sakit' | 'Cuti' | 'Izin';
  reason?: string;
  createdAt: string;
};

export type MasterDataFetchCatalogItem<T = any> = {
  table: string;
  setter: StateSetter<T>;
  mapper?: (rows: any[]) => T[];
};

type CreateMasterDataFetchCatalogParams = {
  setAreas: StateSetter<Area>;
  setBranches: StateSetter<Branch>;
  setServices: StateSetter<ServiceType>;
  setVehicles: StateSetter<VehicleType>;
  setPlatforms: StateSetter<Platform>;
  setSubChannels: StateSetter<SubChannel>;
  setAdAccounts: StateSetter<AdAccount>;
  setAdAccountAssignments: StateSetter<AdAccountAssignment>;
  setAdAccountOwnerAssignments: StateSetter<AdAccountOwnerAssignment>;
  setSources: StateSetter<AdSource>;
  setPayments: StateSetter<PaymentMethod>;
  setRoles: StateSetter<RoleItem>;
  setAffiliates: StateSetter<Affiliate>;
  setVendors: StateSetter<Vendor>;
  setCancelReasons: StateSetter<CancelReason>;
  setLeads: StateSetter<Lead>;
  setProspectBookings: StateSetter<ProspectBooking>;
  setOrders: StateSetter<Order>;
  setWaTemplates: StateSetter<WATemplate>;
  setDailyAds: StateSetter<DailyAd>;
  setLeadSpamDailyInputs: StateSetter<LeadSpamDailyInput>;
  setTechnicianSchedules: StateSetter<TechnicianScheduleLike>;
  setAuditLogs: StateSetter<any>;
  mapLeadRow: (lead: any) => Lead;
};

type MasterDataFetchCatalog = {
  masters: MasterDataFetchCatalogItem[];
  transactional: MasterDataFetchCatalogItem[];
  support: MasterDataFetchCatalogItem[];
};

const mapRowsWith = <T>(mapper: (row: any) => T) => (rows: any[]) => rows.map(mapper);

export const createMasterDataFetchCatalog = ({
  setAreas,
  setBranches,
  setServices,
  setVehicles,
  setPlatforms,
  setSubChannels,
  setAdAccounts,
  setAdAccountAssignments,
  setAdAccountOwnerAssignments,
  setSources,
  setPayments,
  setRoles,
  setAffiliates,
  setVendors,
  setCancelReasons,
  setLeads,
  setProspectBookings,
  setOrders,
  setWaTemplates,
  setDailyAds,
  setLeadSpamDailyInputs,
  setTechnicianSchedules,
  setAuditLogs,
  mapLeadRow,
}: CreateMasterDataFetchCatalogParams): MasterDataFetchCatalog => ({
  masters: [
    { table: 'branches', setter: setBranches, mapper: mapRowsWith(mapBranchFromDB) },
    { table: 'areas', setter: setAreas, mapper: mapRowsWith(mapAreaFromDB) },
    { table: 'services', setter: setServices },
    { table: 'vehicle_types', setter: setVehicles },
    { table: 'ad_platforms', setter: setPlatforms, mapper: mapRowsWith(mapPlatformFromDB) },
    { table: 'ad_sub_channels', setter: setSubChannels, mapper: mapRowsWith(mapSubChannelFromDB) },
    { table: 'ad_accounts', setter: setAdAccounts, mapper: mapRowsWith(mapAdAccountFromDB) },
    { table: 'ad_account_assignments', setter: setAdAccountAssignments, mapper: mapRowsWith(mapAdAccountAssignmentFromDB) },
    { table: 'ad_account_owner_assignments', setter: setAdAccountOwnerAssignments, mapper: mapRowsWith(mapAdAccountOwnerAssignmentFromDB) },
    { table: 'ad_sources', setter: setSources, mapper: mapRowsWith(mapAdSourceFromDB) },
    { table: 'payment_methods', setter: setPayments, mapper: mapRowsWith(mapPaymentFromDB) },
    { table: 'roles', setter: setRoles, mapper: mapRowsWith(mapRoleFromDB) },
    { table: 'affiliates', setter: setAffiliates, mapper: mapRowsWith(mapAffiliateFromDB) },
    { table: 'vendors', setter: setVendors, mapper: mapRowsWith(mapVendorFromDB) },
    { table: 'cancel_reasons', setter: setCancelReasons, mapper: mapRowsWith(mapCancelReasonFromDB) },
  ],
  transactional: [
    { table: 'leads', setter: setLeads, mapper: mapRowsWith(mapLeadRow) },
    { table: 'prospect_bookings', setter: setProspectBookings, mapper: mapRowsWith(mapProspectBookingFromDB) },
    { table: 'orders', setter: setOrders, mapper: mapRowsWith(mapOrderFromDB) },
    { table: 'wa_templates', setter: setWaTemplates, mapper: mapRowsWith(mapWATemplateFromDB) },
    { table: 'daily_ads', setter: setDailyAds, mapper: mapRowsWith(mapDailyAdFromDB) },
    { table: 'lead_spam_daily_inputs', setter: setLeadSpamDailyInputs, mapper: mapRowsWith(mapLeadSpamDailyInputFromDB) },
  ],
  support: [
    { table: 'technician_schedules', setter: setTechnicianSchedules, mapper: mapRowsWith(mapScheduleFromDB) },
    { table: 'audit_logs', setter: setAuditLogs },
  ],
});
