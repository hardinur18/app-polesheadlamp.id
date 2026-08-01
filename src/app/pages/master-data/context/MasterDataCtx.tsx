import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { getSessionBackedEdgeHeaders } from '../../../services/internal/sessionClientHeaders';
import { buildMakeServerUrl } from '../../../services/internal/functionsBaseUrl';
import { getPreviousDateKey, getTodayDateKey } from '../dateKeys';
import { 
  Area, Branch,
  ServiceType,
  VehicleType,
  Platform,
  AdAccount,
  AdAccountAssignment,
  AdAccountOwnerAssignment,
  AdSource,
  PaymentMethod,
  User,
  Role,
  Lead,
  LeadSpamDailyInput,
  ProspectBooking,
  WATemplate,
  Order,
  DailyAd,
  RoleItem,
  Notification,
  SubChannel,
  Affiliate,
  Vendor,
  CancelReason,
} from '../data';
import { LeadSocialFields } from '../../leads/socialContact';
import { getVehicleNameValidationMessage, normalizeVehicleName } from '../vehicleValidation';
import {
  formatOrderBookingScheduleConflictMessage,
  formatOrderScheduleConflictMessage,
  formatProspectBookingScheduleConflictMessage,
  formatTechnicianUnavailableMessage,
  getOrderScheduleConflicts,
  getOrderProspectBookingScheduleConflicts,
  getProspectBookingScheduleConflicts,
  getTechnicianDaySchedule,
  isInactiveOrderScheduleStatus,
  isInactiveProspectBookingScheduleStatus,
  shouldValidateOrderScheduleOnSave,
  shouldValidateProspectBookingScheduleOnSave,
  shouldValidateProspectBookingTechnicianAvailabilityOnSave,
  shouldValidateTechnicianAvailabilityOnSave,
  validateOrderScheduleFromDB,
  validateProspectBookingScheduleFromDB,
} from '@/app/services/orderScheduleValidation';
import { normalizeOrderTime } from '@/app/services/orderTime';
import {
  mapBranchFromDB,
  mapBranchToDB,
  mapAreaFromDB,
  mapAreaToDB,
  mapAdAccountFromDB,
  mapAdAccountAssignmentFromDB,
  mapAdAccountAssignmentToDB,
  mapAdAccountOwnerAssignmentFromDB,
  mapAdAccountOwnerAssignmentToDB,
  mapAdAccountToDB,
  mapAdSourceFromDB,
  mapAdSourceToDB,
  mapPaymentFromDB,
  mapPaymentToDB,
  mapRoleFromDB,
  mapRoleToDB,
  mapPlatformFromDB,
  mapPlatformToDB,
  mapSubChannelFromDB,
  mapSubChannelToDB,
  mapAffiliateFromDB,
  mapAffiliateToDB,
  mapVendorFromDB,
  mapVendorToDB,
  mapCancelReasonFromDB,
  mapCancelReasonToDB,
} from './internal/mappers/masterDataEntityMappers';
import { mapProfileToUser, mapProfilesToUsers } from './internal/mappers/userMappers';
import {
  mapScheduleFromDB,
  mapScheduleToDB,
  mapWATemplateFromDB,
  mapWATemplateToDB,
  mapDailyAdFromDB,
  mapDailyAdToDB,
  mapLeadSpamDailyInputFromDB,
  mapLeadSpamDailyInputToDB,
} from './internal/mappers/miscMappers';
import {
  mapProspectBookingFromDB,
  mapProspectBookingToDB,
  mapOrderFromDB,
  mapOrderToDB,
} from './internal/mappers/transactionMappers';
import {
  LEAD_SOCIAL_MASTER_TYPE,
  hasLeadSocialData,
  isLeadSocialSchemaError,
  mapLeadFromDB,
  mapLeadToDB,
  mergeLeadSocialFields,
  pickLeadSocialFields,
  stripLeadSocialFields,
} from './internal/mappers/leadMappers';
import {
  deleteLeadSocialContactRecord,
  fetchLeadSocialContactMap,
  upsertLeadSocialContactRecord,
} from './internal/leadSocialAdapter';
import { createMasterDataFetchCatalog } from './internal/masterDataFetchCatalog';

export interface AdvertiserAccessConfig {
  advertiserId: string;
  platformIds: string[];
  subChannelIds: string[];
  csIds: string[];
}

export interface TechnicianSchedule {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  type: 'Libur' | 'Sakit' | 'Cuti' | 'Izin';
  reason?: string;
  createdAt: string;
}

import { toast } from 'sonner';

type MutationOptions = {
  silent?: boolean;
};

const shouldUseLocalProfileFallback =
  import.meta.env.VITE_AUTH_MODE === 'local';

const buildLocalProfileFallbackUser = (session: Session): User => ({
  id: session.user.id || 'local-owner',
  name:
    session.user.user_metadata?.name ||
    session.user.email?.split('@')[0] ||
    'Owner Polesheadlamp',
  email: session.user.email || 'owner@polesheadlamp.id',
  role: 'Owner',
  status: 'active',
  branchId: 'B1',
  joinDate: new Date().toISOString().slice(0, 10),
  phone: '',
});

export type CurrentUserIssue =
  | { code: 'profile_not_found'; message: string }
  | { code: 'profile_inactive'; message: string; status?: string }
  | { code: 'invalid_role'; message: string; role?: string }
  | { code: 'profile_query_error'; message: string }
  | { code: 'profile_timeout'; message: string };

interface MasterDataContextType {
  areas: Area[];
  branches: Branch[];
  activeBranches: Branch[]; // Expose active branches
  services: ServiceType[];
  vehicles: VehicleType[];
  platforms: Platform[];
  subChannels: SubChannel[];
  adAccounts: AdAccount[];
  adAccountAssignments: AdAccountAssignment[];
  adAccountOwnerAssignments: AdAccountOwnerAssignment[];
  sources: AdSource[];
  payments: PaymentMethod[];
  roles: RoleItem[];
  users: User[];
  leads: Lead[];
  leadSpamDailyInputs: LeadSpamDailyInput[];
  prospectBookings: ProspectBooking[];
  waTemplates: WATemplate[];
  orders: Order[];
  dailyAds: DailyAd[];
  notifications: Notification[]; // New
  advertiserConfigs: AdvertiserAccessConfig[];
  affiliates: Affiliate[];
  vendors: Vendor[];
  cancelReasons: CancelReason[];

  technicianSchedules: TechnicianSchedule[];
  addSchedule: (schedule: TechnicianSchedule) => Promise<void>;
  deleteSchedule: (userId: string, date: string) => Promise<void>;

  auditLogs: any[];

  // CRUD Actions
  addUser: (user: User) => void;
  createSystemUser: (data: any) => Promise<void>;
  updateUser: (user: User) => void;
  updateSystemUser: (id: string, data: any) => Promise<void>;
  deleteUser: (id: string) => void;
  deleteSystemUser: (id: string) => Promise<void>;
  resetUserPassword: (id: string, password: string) => Promise<void>;

  addLead: (lead: Lead, options?: MutationOptions) => Promise<Lead | undefined>;
  updateLead: (lead: Lead) => void;
  deleteLead: (id: string, options?: MutationOptions) => Promise<void>;

  addProspectBooking: (booking: ProspectBooking, options?: MutationOptions) => Promise<ProspectBooking | undefined>;
  updateProspectBooking: (booking: ProspectBooking) => Promise<ProspectBooking | undefined>;
  deleteProspectBooking: (id: string) => void;

  addOrder: (order: Order) => Promise<Order | undefined>;
  updateOrder: (order: Order) => Promise<Order | undefined>;
  deleteOrder: (id: string) => void;

  addWATemplate: (template: WATemplate) => void;
  updateWATemplate: (template: WATemplate) => void;
  deleteWATemplate: (id: string) => void;

  addDailyAd: (ad: DailyAd) => void;
  updateDailyAd: (ad: DailyAd) => void;
  deleteDailyAd: (id: string) => void;

  addLeadSpamDailyInput: (item: LeadSpamDailyInput, options?: MutationOptions) => Promise<LeadSpamDailyInput | undefined>;
  updateLeadSpamDailyInput: (item: LeadSpamDailyInput) => Promise<void>;
  deleteLeadSpamDailyInput: (id: string, options?: MutationOptions) => Promise<void>;

  addArea: (area: Area) => void;
  updateArea: (area: Area) => void;
  deleteArea: (id: string) => void;
  
  addBranch: (branch: Branch) => void;
  updateBranch: (branch: Branch) => void;
  deleteBranch: (id: string) => void;

  addService: (service: ServiceType) => void;
  updateService: (service: ServiceType) => void;
  deleteService: (id: string) => void;

  addVehicle: (vehicle: VehicleType) => void;
  updateVehicle: (vehicle: VehicleType) => void;
  deleteVehicle: (id: string) => void;

  addAdAccount: (adAccount: AdAccount) => void;
  updateAdAccount: (adAccount: AdAccount) => void;
  deleteAdAccount: (id: string) => void;
  assignAdAccountCs: (assignment: {
    adAccountId: string;
    csId: string;
    subChannelId?: string | null;
    startDate: string;
    notes?: string | null;
  }) => Promise<void>;
  assignAdAccountOwner: (assignment: {
    adAccountId: string;
    advertiserId: string;
    startDate: string;
    notes?: string | null;
  }) => Promise<void>;
  updateAdAccountOwnerAssignment: (assignment: AdAccountOwnerAssignment) => void;
  deleteAdAccountOwnerAssignment: (id: string) => void;
  updateAdAccountAssignment: (assignment: AdAccountAssignment) => void;
  deleteAdAccountAssignment: (id: string) => void;

  addPlatform: (platform: Platform) => void;
  updatePlatform: (platform: Platform) => void;
  deletePlatform: (id: string) => void;

  addSubChannel: (subChannel: SubChannel) => void;
  updateSubChannel: (subChannel: SubChannel) => void;
  deleteSubChannel: (id: string) => void;

  addSource: (source: AdSource) => void;
  updateSource: (source: AdSource) => void;
  deleteSource: (id: string) => void;

  addPayment: (payment: PaymentMethod) => void;
  updatePayment: (payment: PaymentMethod) => void;
  deletePayment: (id: string) => void;

  addRole: (role: RoleItem) => void;
  updateRole: (role: RoleItem) => void;
  deleteRole: (id: string) => void;

  addAffiliate: (affiliate: Affiliate) => void;
  updateAffiliate: (affiliate: Affiliate) => void;
  deleteAffiliate: (id: string) => void;

  addVendor: (vendor: Vendor) => void;
  updateVendor: (vendor: Vendor) => void;
  deleteVendor: (id: string) => void;

  // Notifications
  markNotificationAsRead: (id: string) => void;
  sendNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => Promise<void>;

  // Global Refresh
  refreshTrigger: number;
  triggerRefresh: () => void;

  // Setters (if needed for local state updates before refresh)
  setAreas: React.Dispatch<React.SetStateAction<Area[]>>;
  
  // Auth / Role Simulation
  currentRole: Role | undefined;
  currentUser: User | undefined;
  isCurrentUserResolved: boolean;
  currentUserIssue: CurrentUserIssue | undefined;
  setCurrentRole: (role: Role) => void;
  setCurrentUser: (user: User) => void;
}

const MasterDataContext = createContext<MasterDataContextType | undefined>(undefined);

export const MasterDataProvider: React.FC<{ children: ReactNode; session?: Session | null }> = ({ children, session }) => {
  // State Definitions
  const [areas, setAreas] = useState<Area[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<ServiceType[]>([]);
  const [vehicles, setVehicles] = useState<VehicleType[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [subChannels, setSubChannels] = useState<SubChannel[]>([]);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [adAccountAssignments, setAdAccountAssignments] = useState<AdAccountAssignment[]>([]);
  const [adAccountOwnerAssignments, setAdAccountOwnerAssignments] = useState<AdAccountOwnerAssignment[]>([]);
  const [sources, setSources] = useState<AdSource[]>([]);
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [cancelReasons, setCancelReasons] = useState<CancelReason[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // Derived active branches for operations
  const activeBranches = React.useMemo(() => {
    return branches.filter(b => b.status === 'active');
  }, [branches]);

  // These might still be mock-heavy if tables don't exist yet, but we'll try to fetch
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadSocialContacts, setLeadSocialContacts] = useState<Record<string, LeadSocialFields>>({});
  const [prospectBookings, setProspectBookings] = useState<ProspectBooking[]>([]);
  const [waTemplates, setWaTemplates] = useState<WATemplate[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [dailyAds, setDailyAds] = useState<DailyAd[]>([]);
  const [leadSpamDailyInputs, setLeadSpamDailyInputs] = useState<LeadSpamDailyInput[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [advertiserConfigs, setAdvertiserConfigs] = useState<AdvertiserAccessConfig[]>([]);
  const [technicianSchedules, setTechnicianSchedules] = useState<TechnicianSchedule[]>([]);
  
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [realUser, setRealUser] = useState<User | undefined>(undefined);
  const [isCurrentUserResolved, setIsCurrentUserResolved] = useState(!session?.user);
  const [currentUserIssue, setCurrentUserIssue] = useState<CurrentUserIssue | undefined>(undefined);
  
  // Global Refresh Trigger
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const leadSocialContactsRef = React.useRef<Record<string, LeadSocialFields>>({});
  const leadSpamDailyInputsUseFallbackRef = React.useRef(false);

  useEffect(() => {
    leadSocialContactsRef.current = leadSocialContacts;
  }, [leadSocialContacts]);

  const isLeadSpamTableMissingError = (error: any) =>
    error?.code === 'PGRST205' ||
    error?.code === '42P01' ||
    String(error?.message || '').includes('lead_spam_daily_inputs') ||
    String(error?.message || '').toLowerCase().includes('schema cache');

  const leadSpamMasterUrl = buildMakeServerUrl('/master/lead_spam_daily_input');

  const fetchLeadSpamDailyInputsFallback = async () => {
    const response = await fetch(leadSpamMasterUrl, {
      headers: await getSessionBackedEdgeHeaders(),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Gagal memuat fallback input spam');
    }

    return (await response.json()) as LeadSpamDailyInput[];
  };

  const upsertLeadSpamDailyInputFallback = async (item: LeadSpamDailyInput) => {
    const now = new Date().toISOString();
    const payload: LeadSpamDailyInput = {
      ...item,
      createdAt: item.createdAt || now,
      updatedAt: now,
    };
    const response = await fetch(leadSpamMasterUrl, {
      method: 'POST',
      headers: await getSessionBackedEdgeHeaders({ includeJsonContentType: true }),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Gagal menyimpan fallback input spam');
    }

    return (await response.json()) as LeadSpamDailyInput;
  };

  const deleteLeadSpamDailyInputFallback = async (id: string) => {
    const response = await fetch(`${leadSpamMasterUrl}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: await getSessionBackedEdgeHeaders(),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Gagal menghapus fallback input spam');
    }
  };

  // Helper to fetch data from a table
  const fetchData = async (table: string, setter: React.Dispatch<React.SetStateAction<any[]>>, mapper?: (data: any[]) => any[]) => {
    const startedAt = performance.now();
    try {
      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      const MAX_RECORDS = 50000; // Safety cap

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        // Try fetching with sort first to ensure stable pagination
        let { data, error } = await supabase
            .from(table)
            .select('*')
            .order('created_at', { ascending: false })
            .range(from, to);
        
        // If sort fails (column might not exist), try without sort
        if (error && error.code === '42703') { // Undefined column
           const retry = await supabase.from(table).select('*').range(from, to);
           data = retry.data;
           error = retry.error;
        }

        if (error) {
          if (table === 'lead_spam_daily_inputs' && isLeadSpamTableMissingError(error)) {
            leadSpamDailyInputsUseFallbackRef.current = true;
            const fallbackRows = await fetchLeadSpamDailyInputsFallback();
            setter(fallbackRows);
            return;
          }
          console.error(`Error fetching ${table} page ${page}:`, error.message);
          break;
        }

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          
          if (data.length < pageSize) {
            hasMore = false; // Reached end
          } else {
            page++;
          }

          if (allData.length >= MAX_RECORDS) {
             console.warn(`Fetch limit reached for ${table} (${MAX_RECORDS} rows)`);
             hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      setter(mapper ? mapper(allData) : allData);
      if (import.meta.env.DEV) {
        console.info('[MasterData] fetched table', {
          table,
          rows: allData.length,
          ms: Math.round(performance.now() - startedAt),
        });
      }
    } catch (e) {
      console.error(`Error fetching ${table}:`, e);
    }
  };

  const isAssignmentSchemaCacheError = (table: string, error: any) =>
    (table === 'ad_account_assignments' || table === 'ad_account_owner_assignments') &&
    String(error?.message || '').toLowerCase().includes('notes') &&
    String(error?.message || '').toLowerCase().includes('schema cache');

  const withoutAssignmentDraftColumns = (payload: any) => {
    if (!payload || typeof payload !== 'object') return payload;
    const { notes: _notes, ...rest } = payload;
    return rest;
  };

  // Generic CRUD Helpers
  const addItem = async (table: string, item: any, setter: React.Dispatch<React.SetStateAction<any[]>>, dbMapper?: (item: any) => any, uiMapper?: (item: any) => any, options?: MutationOptions) => {
    try {
      const payload = dbMapper ? dbMapper(item) : item;
      let { data, error } = await supabase.from(table).insert(payload).select().single();
      if (error && isAssignmentSchemaCacheError(table, error)) {
        const retry = await supabase.from(table).insert(withoutAssignmentDraftColumns(payload)).select().single();
        data = retry.data;
        error = retry.error;
      }
      if (error) throw error;
      if (data) {
         const uiItem = uiMapper ? uiMapper(data) : data;
         setter(prev => {
            if (prev.some(i => i.id === uiItem.id)) return prev;
            return [uiItem, ...prev];
         });
         if (!options?.silent) {
           toast.success("Data berhasil disimpan");
         }
         return uiItem;
      }
    } catch (e: any) {
      if (table === 'lead_spam_daily_inputs' && isLeadSpamTableMissingError(e)) {
        leadSpamDailyInputsUseFallbackRef.current = true;
        const fallbackItem = await upsertLeadSpamDailyInputFallback(item as LeadSpamDailyInput);
        setter(prev => {
          if (prev.some(i => i.id === fallbackItem.id)) {
            return prev.map(i => i.id === fallbackItem.id ? { ...i, ...fallbackItem } : i);
          }
          return [fallbackItem, ...prev];
        });
        if (!options?.silent) {
          toast.success("Data berhasil disimpan");
        }
        return fallbackItem;
      }
      console.error(`Error adding to ${table}:`, e);
      if (!options?.silent) {
        toast.error(`Gagal menyimpan data: ${e.message}`);
      }
      throw e;
    }
  };

  const updateItem = async (table: string, item: any, setter: React.Dispatch<React.SetStateAction<any[]>>, dbMapper?: (item: any) => any, uiMapper?: (item: any) => any) => {
    try {
      const payload = dbMapper ? dbMapper(item) : item;
      let { data, error } = await supabase.from(table).update(payload).eq('id', item.id).select().single();
      if (error && isAssignmentSchemaCacheError(table, error)) {
        const retry = await supabase.from(table).update(withoutAssignmentDraftColumns(payload)).eq('id', item.id).select().single();
        data = retry.data;
        error = retry.error;
      }
      if (error) throw error;
      if (data) {
         const uiItem = uiMapper ? uiMapper(data) : data;
         setter(prev => prev.map(i => i.id === item.id ? { ...i, ...uiItem } : i));
         toast.success("Data berhasil diperbarui");
         return uiItem;
      } else {
         setter(prev => prev.map(i => i.id === item.id ? { ...i, ...item } : i));
         toast.success("Data berhasil diperbarui");
         return item;
      }
    } catch (e: any) {
      if (table === 'lead_spam_daily_inputs' && isLeadSpamTableMissingError(e)) {
        leadSpamDailyInputsUseFallbackRef.current = true;
        const fallbackItem = await upsertLeadSpamDailyInputFallback(item as LeadSpamDailyInput);
        setter(prev => prev.map(i => i.id === item.id ? { ...i, ...fallbackItem } : i));
        toast.success("Data berhasil diperbarui");
        return fallbackItem;
      }
      console.error(`Error updating ${table}:`, e);
      toast.error(`Gagal memperbarui data: ${e.message}`);
      throw e;
    }
  };

  const deleteItem = async (table: string, id: string, setter: React.Dispatch<React.SetStateAction<any[]>>, options?: MutationOptions) => {
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      setter(prev => prev.filter(i => i.id !== id));
      if (!options?.silent) {
        toast.success("Data berhasil dihapus");
      }
    } catch (e: any) {
      if (table === 'lead_spam_daily_inputs' && isLeadSpamTableMissingError(e)) {
        leadSpamDailyInputsUseFallbackRef.current = true;
        await deleteLeadSpamDailyInputFallback(id);
        setter(prev => prev.filter(i => i.id !== id));
        if (!options?.silent) {
          toast.success("Data berhasil dihapus");
        }
        return;
      }
      console.error(`Error deleting from ${table}:`, e);
      if (!options?.silent) {
        toast.error(`Gagal menghapus data: ${e.message}`);
      }
    }
  };

  const fetchLeadSocialContacts = async () => {
    try {
      const socialMap = await fetchLeadSocialContactMap({
        masterType: LEAD_SOCIAL_MASTER_TYPE,
      });

      setLeadSocialContacts(socialMap);
      setLeads(prev => prev.map((lead) => mergeLeadSocialFields(lead, socialMap[lead.id])));
    } catch (error) {
      console.warn('Failed to fetch lead social contacts:', error);
    }
  };

  const upsertLeadSocialContact = async (lead: Lead) => {
    if (!hasLeadSocialData(lead)) {
      return deleteLeadSocialContact(lead.id);
    }

    const saved = await upsertLeadSocialContactRecord({
      masterType: LEAD_SOCIAL_MASTER_TYPE,
    }, lead);
    setLeadSocialContacts(prev => ({ ...prev, [lead.id]: saved }));
    setLeads(prev => prev.map(item => item.id === lead.id ? mergeLeadSocialFields(item, saved) : item));
    return saved;
  };

  const deleteLeadSocialContact = async (leadId: string) => {
    try {
      await deleteLeadSocialContactRecord({
        masterType: LEAD_SOCIAL_MASTER_TYPE,
      }, leadId);
    } catch (error) {
      console.warn(`Failed to delete lead social contact ${leadId}:`, error);
    } finally {
      setLeadSocialContacts(prev => {
        const next = { ...prev };
        delete next[leadId];
        return next;
      });
      setLeads(prev => prev.map(lead => lead.id === leadId ? stripLeadSocialFields(lead) : lead));
    }
  };




  // Sync Current User with Session
  useEffect(() => {
    if (!session?.user) {
      setCurrentUserId('');
      setRealUser(undefined);
      setCurrentUserIssue(undefined);
      setIsCurrentUserResolved(true);
      return;
    }
    
    let isMounted = true;
    const abortController = new AbortController();
    let didProfileSyncTimeout = false;
    setCurrentUserId('');
    setRealUser(undefined);
    setCurrentUserIssue(undefined);
    setIsCurrentUserResolved(false);

    const syncUser = async () => {
      let profileSyncTimeoutId: number | undefined;

      const useLocalFallbackUser = (reason: CurrentUserIssue) => {
        if (!shouldUseLocalProfileFallback) {
          setCurrentUserIssue(reason);
          return false;
        }

        const fallbackUser = buildLocalProfileFallbackUser(session);
        console.warn('[MasterData] Using local v2 profile fallback:', {
          reason: reason.code,
          userId: fallbackUser.id,
          email: fallbackUser.email,
        });
        setCurrentUserIssue(undefined);
        setCurrentUserId(fallbackUser.id);
        setRealUser(fallbackUser);
        setUsers(prev => {
          const exists = prev.some(user => user.id === fallbackUser.id);
          if (exists) return prev.map(user => user.id === fallbackUser.id ? fallbackUser : user);
          return [fallbackUser, ...prev];
        });
        return true;
      };

      try {
        // Add a small delay to prevent race conditions on rapid re-renders
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!isMounted) return;

        const profileQuery = supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .abortSignal(abortController.signal)
          .maybeSingle();

        const profileTimeout = new Promise<{ timedOut: true }>((resolve) => {
          profileSyncTimeoutId = window.setTimeout(() => {
            didProfileSyncTimeout = true;
            abortController.abort();
            resolve({ timedOut: true });
          }, 6000);
        });

        const profileResult = await Promise.race([profileQuery, profileTimeout]);
        
        if (!isMounted) return;

        if ('timedOut' in profileResult) {
          console.warn("[MasterData] Profile fetch timed out");
          useLocalFallbackUser({
            code: 'profile_timeout',
            message: 'Koneksi ke data profil timeout. Coba refresh atau login ulang.',
          });
          return;
        }

        const { data: profile, error } = profileResult;

        if (error) {
          // Ignore abort errors - they're expected on cleanup
          if (error.message?.includes('abort') || error.message?.includes('AbortError')) {
            if (didProfileSyncTimeout) {
              console.warn("[MasterData] Profile fetch timed out");
            } else {
              console.log("[MasterData] Profile fetch aborted (cleanup)");
            }
            return;
          }
          console.error("[MasterData] Profile fetch error:", error.message);
          useLocalFallbackUser({
            code: 'profile_query_error',
            message: error.message || 'Profil login tidak bisa dibaca dari database.',
          });
          return;
        }

        if (!profile) {
          console.warn('[MasterData] Active auth session has no matching profile row:', {
            userId: session.user.id,
            email: session.user.email,
          });
          useLocalFallbackUser({
            code: 'profile_not_found',
            message: 'Sesi browser masih aktif, tetapi akun ini belum punya profil internal di app v2.',
          });
          return;
        }

        console.log(`[MasterData] Syncing user profile - Role: ${profile.role}, Status: ${profile.status}`);

        const normalizedStatus = typeof profile.status === 'string' ? profile.status.trim().toLowerCase() : '';
        if (normalizedStatus === 'inactive') {
          setCurrentUserId(profile.id);
          setRealUser(undefined);
          setUsers(prev => prev.filter(u => u.id !== profile.id));
          setCurrentUserIssue({
            code: 'profile_inactive',
            status: profile.status,
            message: 'Profil akun ini berstatus inactive, jadi akses app ditutup.',
          });
          return;
        }

        const mappedUser = mapProfileToUser({
          ...profile,
          email: session.user.email || profile.email,
          name: profile.name || session.user.email?.split('@')[0] || 'User',
          created_at: profile.created_at || new Date().toISOString(),
        });

        if (!isMounted) return;

        setCurrentUserId(profile.id);

        if (!mappedUser) {
          setRealUser(undefined);
          setUsers(prev => prev.filter(u => u.id !== profile.id));
          setCurrentUserIssue({
            code: 'invalid_role',
            role: profile.role,
            message: `Role "${profile.role || '-'}" belum masuk daftar role app v2.`,
          });
          return;
        }

        setCurrentUserIssue(undefined);
        setRealUser(mappedUser);

        setUsers(prev => {
           const exists = prev.find(u => u.id === mappedUser.id);
           if (exists) return prev.map(u => u.id === mappedUser.id ? mappedUser : u);
           return [mappedUser, ...prev];
        });
      } catch (err: any) {
        // Ignore abort errors
        if (err?.name === 'AbortError' || err?.message?.includes('abort')) {
          if (didProfileSyncTimeout) {
            console.warn("[MasterData] Profile fetch timed out");
          } else {
            console.log("[MasterData] Profile fetch aborted (cleanup)");
          }
          return;
        }
        console.error("[MasterData] Unexpected error syncing user:", err);
        useLocalFallbackUser({
          code: 'profile_query_error',
          message: err?.message || 'Terjadi error saat sinkronisasi profil login.',
        });
      } finally {
        if (profileSyncTimeoutId !== undefined) {
          window.clearTimeout(profileSyncTimeoutId);
        }
        if (isMounted) {
          setIsCurrentUserResolved(true);
        }
      }
    };
    
    syncUser();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [session?.user?.id]); // Only re-run when user ID changes, not entire session object

  // Derived State
  const currentUser = React.useMemo(() => {
     if (realUser && realUser.id === currentUserId) return realUser;
     if (currentUserId) {
        const found = users.find(u => u.id === currentUserId);
        return found;
     }
     return undefined;
  }, [currentUserId, users, realUser]);

  const currentRole = currentUser?.role;

  // Ref to access current user inside realtime callbacks without dependency loop
  const currentUserRef = React.useRef(currentUser);
  useEffect(() => {
      currentUserRef.current = currentUser;
  }, [currentUser]);

  // Role Simulation Helpers
  const setCurrentUser = (user: User) => {
      setCurrentUserId(user.id);
  };

  const setCurrentRole = (role: Role) => {
      if (currentUser) {
          // Update the user's role in the local state to simulate the switch
          const updated = { ...currentUser, role };
          setUsers(prev => prev.map(u => u.id === currentUser.id ? updated : u));
          if (realUser && realUser.id === currentUser.id) {
              setRealUser(updated);
          }
      }
  };

  // ACTIONS IMPLEMENTATION
  
  // -- USERS (Handled differently due to Auth/Edge Functions)
  const addUser = (user: User) => setUsers(prev => [user, ...prev]);
  const updateUser = (user: User) => setUsers(prev => prev.map(item => item.id === user.id ? user : item)); // Local update
  const refetchUsersFromProfiles = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    if (profiles) {
      setUsers(mapProfilesToUsers(profiles));
    }
  };
  
  const createSystemUser = async (data: any) => {
    try {
        const headers = await getSessionBackedEdgeHeaders({ includeJsonContentType: true });
        const response = await fetch(buildMakeServerUrl('/users'), {
            method: 'POST',
            headers,
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to create user');
        }
        await refetchUsersFromProfiles();
        toast.success("User berhasil dibuat");
    } catch (e: any) {
        console.error("Create user error:", e);
        toast.error(`Gagal membuat user: ${e.message}`);
        throw e;
    }
  };

  const updateSystemUser = async (id: string, data: any) => {
    try {
      const startedAt = performance.now();
      const headers = await getSessionBackedEdgeHeaders({ includeJsonContentType: true });
      const headersReadyAt = performance.now();
      const response = await fetch(buildMakeServerUrl(`/users/${id}`), {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });
      const responseReadyAt = performance.now();

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update user');
      }

      const result = await response.json().catch(() => null);
      const updatedUser = result?.profile ? mapProfileToUser(result.profile) : null;
      if (updatedUser) {
        setUsers(prev => {
          const exists = prev.some(user => user.id === updatedUser.id);
          if (exists) return prev.map(user => user.id === updatedUser.id ? updatedUser : user);
          return [updatedUser, ...prev];
        });
      } else {
        void refetchUsersFromProfiles();
      }
      if (import.meta.env.DEV) {
        const finishedAt = performance.now();
        console.info('[Users] updateSystemUser timing', {
          sessionHeadersMs: Math.round(headersReadyAt - startedAt),
          putRequestMs: Math.round(responseReadyAt - headersReadyAt),
          localStateMs: Math.round(finishedAt - responseReadyAt),
          totalMs: Math.round(finishedAt - startedAt),
        });
      }
      toast.success("Data pengguna berhasil diperbarui");
    } catch (e: any) {
      console.error("Update user error:", e);
      toast.error(`Gagal memperbarui user: ${e.message}`);
      throw e;
    }
  };

  const deleteSystemUser = async (id: string) => {
    try {
        const headers = await getSessionBackedEdgeHeaders();
        const response = await fetch(buildMakeServerUrl(`/users/${id}`), {
            method: 'DELETE',
            headers
        });
        if (!response.ok) {
             const err = await response.json();
             throw new Error(err.error || 'Failed to delete user');
        }
        setUsers(prev => prev.filter(u => u.id !== id));
        toast.success("User berhasil dihapus");
    } catch (e: any) {
         console.error("Delete user error:", e);
         toast.error(`Gagal menghapus user: ${e.message}`);
         throw e;
    }
  };
  const deleteUser = (id: string) => deleteSystemUser(id); // Map deleteUser to system delete

  const resetUserPassword = async (id: string, password: string) => {
    try {
      // Ensure we have a valid ID
      if (!id) throw new Error("User ID is required");
      const headers = await getSessionBackedEdgeHeaders({ includeJsonContentType: true });
      
      // STRATEGY: Send User Token in custom header 'x-client-token'
      // And send Public Anon Key in 'Authorization' to pass Gateway checks
      const response = await fetch(buildMakeServerUrl(`/users/${id}/password`), {
          method: 'PUT',
          headers,
          body: JSON.stringify({ password })
      });
      
      if (!response.ok) {
           let errMsg = 'Failed to reset password';
           try {
               const text = await response.text();
               try {
                  const err = JSON.parse(text);
                  errMsg = err.error || err.message || text;
               } catch {
                  errMsg += ` (Status: ${response.status}) ${text.slice(0, 100)}`;
               }
           } catch {
                errMsg += ` (Status: ${response.status})`;
            }
           throw new Error(errMsg);
      }
      
      toast.success("Password berhasil direset");
    } catch (e: any) {
      console.error("Reset password error:", e);
      toast.error(e.message || "Gagal mereset password");
      throw e;
    }
  };

  // Mappers for Snake Case DB <-> Camel Case UI live in ./internal/mappers.

  const prepareVehicleForSave = (item: VehicleType): VehicleType => {
    const name = normalizeVehicleName(item.name);
    const validationMessage = getVehicleNameValidationMessage(name);
    if (validationMessage) {
      throw new Error(validationMessage);
    }

    return {
      ...item,
      id: item.id || crypto.randomUUID(),
      name,
    };
  };

  // -- BRANCHES
  const addBranch = (item: Branch) => addItem('branches', item, setBranches, mapBranchToDB, mapBranchFromDB);
  const updateBranch = (item: Branch) => updateItem('branches', item, setBranches, mapBranchToDB, mapBranchFromDB);
  const deleteBranch = (id: string) => deleteItem('branches', id, setBranches);

  // -- AREAS
  const addArea = (item: Area) => addItem('areas', item, setAreas, mapAreaToDB, mapAreaFromDB);
  const updateArea = (item: Area) => updateItem('areas', item, setAreas, mapAreaToDB, mapAreaFromDB);
  const deleteArea = (id: string) => deleteItem('areas', id, setAreas);

  // -- SERVICES
  const addService = (item: ServiceType) => addItem('services', item, setServices);
  const updateService = (item: ServiceType) => updateItem('services', item, setServices);
  const deleteService = (id: string) => deleteItem('services', id, setServices);

  // -- VEHICLES
  const addVehicle = (item: VehicleType) => addItem('vehicle_types', prepareVehicleForSave(item), setVehicles);
  const updateVehicle = (item: VehicleType) => updateItem('vehicle_types', prepareVehicleForSave(item), setVehicles);
  const deleteVehicle = (id: string) => deleteItem('vehicle_types', id, setVehicles);

  // -- PLATFORMS
  const addPlatform = (item: Platform) => addItem('ad_platforms', item, setPlatforms, mapPlatformToDB, mapPlatformFromDB);
  const updatePlatform = (item: Platform) => updateItem('ad_platforms', item, setPlatforms, mapPlatformToDB, mapPlatformFromDB);
  const deletePlatform = (id: string) => deleteItem('ad_platforms', id, setPlatforms);

  // -- SUB CHANNELS
  const addSubChannel = (item: SubChannel) => addItem('ad_sub_channels', item, setSubChannels, mapSubChannelToDB, mapSubChannelFromDB);
  const updateSubChannel = (item: SubChannel) => updateItem('ad_sub_channels', item, setSubChannels, mapSubChannelToDB, mapSubChannelFromDB);
  const deleteSubChannel = (id: string) => deleteItem('ad_sub_channels', id, setSubChannels);

  // -- AD ACCOUNTS
  const addAdAccount = (item: AdAccount) => addItem('ad_accounts', item, setAdAccounts, mapAdAccountToDB, mapAdAccountFromDB);
  const updateAdAccount = (item: AdAccount) => updateItem('ad_accounts', item, setAdAccounts, mapAdAccountToDB, mapAdAccountFromDB);
  const deleteAdAccount = (id: string) => deleteItem('ad_accounts', id, setAdAccounts);
  const updateAdAccountAssignment = (item: AdAccountAssignment) =>
    updateItem('ad_account_assignments', item, setAdAccountAssignments, mapAdAccountAssignmentToDB, mapAdAccountAssignmentFromDB);
  const deleteAdAccountAssignment = (id: string) => deleteItem('ad_account_assignments', id, setAdAccountAssignments);
  const updateAdAccountOwnerAssignment = (item: AdAccountOwnerAssignment) =>
    updateItem(
      'ad_account_owner_assignments',
      item,
      setAdAccountOwnerAssignments,
      mapAdAccountOwnerAssignmentToDB,
      mapAdAccountOwnerAssignmentFromDB,
    );
  const deleteAdAccountOwnerAssignment = (id: string) =>
    deleteItem('ad_account_owner_assignments', id, setAdAccountOwnerAssignments);

  const closeOverlappingAccountOwnerAssignments = async (
    adAccountId: string,
    normalizedStartDate: string,
  ) => {
    const previousEndDate = getPreviousDateKey(normalizedStartDate);

    const activeAssignments = adAccountOwnerAssignments.filter(
      (assignment) =>
        assignment.adAccountId === adAccountId &&
        assignment.status === 'active' &&
        (!assignment.endDate || assignment.endDate >= normalizedStartDate),
    );

    for (const assignment of activeAssignments) {
      if (assignment.startDate >= normalizedStartDate) {
        await updateItem(
          'ad_account_owner_assignments',
          { ...assignment, status: 'inactive', endDate: assignment.startDate },
          setAdAccountOwnerAssignments,
          mapAdAccountOwnerAssignmentToDB,
          mapAdAccountOwnerAssignmentFromDB,
        );
      } else {
        await updateItem(
          'ad_account_owner_assignments',
          { ...assignment, endDate: previousEndDate },
          setAdAccountOwnerAssignments,
          mapAdAccountOwnerAssignmentToDB,
          mapAdAccountOwnerAssignmentFromDB,
        );
      }
    }
  };

  const assignAdAccountOwner = async ({
    adAccountId,
    advertiserId,
    notes,
    startDate,
  }: {
    adAccountId: string;
    advertiserId: string;
    startDate: string;
    notes?: string | null;
  }) => {
    const normalizedStartDate = startDate || getTodayDateKey();

    try {
      await closeOverlappingAccountOwnerAssignments(adAccountId, normalizedStartDate);

      await addItem(
        'ad_account_owner_assignments',
        {
          id: crypto.randomUUID(),
          adAccountId,
          advertiserId,
          startDate: normalizedStartDate,
          endDate: null,
          status: 'active',
          notes: notes?.trim() || null,
        } satisfies AdAccountOwnerAssignment,
        setAdAccountOwnerAssignments,
        mapAdAccountOwnerAssignmentToDB,
        mapAdAccountOwnerAssignmentFromDB,
      );

      const account = adAccounts.find((item) => item.id === adAccountId);
      if (account && account.advertiserId !== advertiserId) {
        await updateAdAccount({ ...account, advertiserId });
      }
    } catch (error) {
      console.error('Error assigning ad account owner:', error);
      throw error;
    }
  };

  const assignAdAccountCs = async ({
    adAccountId,
    csId,
    notes,
    subChannelId,
    startDate,
  }: {
    adAccountId: string;
    csId: string;
    subChannelId?: string | null;
    startDate: string;
    notes?: string | null;
  }) => {
    const normalizedStartDate = startDate || getTodayDateKey();
    const previousEndDate = getPreviousDateKey(normalizedStartDate);

    try {
      const activeAssignments = adAccountAssignments.filter(
        (assignment) =>
          assignment.adAccountId === adAccountId &&
          assignment.status === 'active' &&
          (!assignment.endDate || assignment.endDate >= normalizedStartDate),
      );

      for (const assignment of activeAssignments) {
        if (assignment.startDate >= normalizedStartDate) {
          await updateItem(
            'ad_account_assignments',
            { ...assignment, status: 'inactive', endDate: assignment.startDate },
            setAdAccountAssignments,
            mapAdAccountAssignmentToDB,
            mapAdAccountAssignmentFromDB,
          );
        } else {
          await updateItem(
            'ad_account_assignments',
            { ...assignment, endDate: previousEndDate },
            setAdAccountAssignments,
            mapAdAccountAssignmentToDB,
            mapAdAccountAssignmentFromDB,
          );
        }
      }

      await addItem(
        'ad_account_assignments',
        {
          id: crypto.randomUUID(),
          adAccountId,
          csId,
          subChannelId: subChannelId || null,
          startDate: normalizedStartDate,
          endDate: null,
          status: 'active',
          notes: notes?.trim() || null,
        } satisfies AdAccountAssignment,
        setAdAccountAssignments,
        mapAdAccountAssignmentToDB,
        mapAdAccountAssignmentFromDB,
      );
    } catch (error) {
      console.error('Error assigning ad account CS:', error);
      throw error;
    }
  };

  // -- SOURCES
  const addSource = (item: AdSource) => addItem('ad_sources', item, setSources, mapAdSourceToDB, mapAdSourceFromDB);
  const updateSource = (item: AdSource) => updateItem('ad_sources', item, setSources, mapAdSourceToDB, mapAdSourceFromDB);
  const deleteSource = (id: string) => deleteItem('ad_sources', id, setSources);

  // -- PAYMENTS
  const addPayment = (item: PaymentMethod) => addItem('payment_methods', item, setPayments, mapPaymentToDB, mapPaymentFromDB);
  const updatePayment = (item: PaymentMethod) => updateItem('payment_methods', item, setPayments, mapPaymentToDB, mapPaymentFromDB);
  const deletePayment = (id: string) => deleteItem('payment_methods', id, setPayments);

  // -- ROLES
  const addRole = (item: RoleItem) => addItem('roles', item, setRoles, mapRoleToDB, mapRoleFromDB);
  const updateRole = (item: RoleItem) => updateItem('roles', item, setRoles, mapRoleToDB, mapRoleFromDB);
  const deleteRole = (id: string) => deleteItem('roles', id, setRoles);

  // -- AFFILIATES
  const addAffiliate = (item: Affiliate) => addItem('affiliates', item, setAffiliates, mapAffiliateToDB, mapAffiliateFromDB);
  const updateAffiliate = (item: Affiliate) => updateItem('affiliates', item, setAffiliates, mapAffiliateToDB, mapAffiliateFromDB);
  const deleteAffiliate = (id: string) => deleteItem('affiliates', id, setAffiliates);

  // -- VENDORS
  const addVendor = (item: Vendor) => addItem('vendors', item, setVendors, mapVendorToDB, mapVendorFromDB);
  const updateVendor = (item: Vendor) => updateItem('vendors', item, setVendors, mapVendorToDB, mapVendorFromDB);
  const deleteVendor = (id: string) => deleteItem('vendors', id, setVendors);

  // -- CANCEL REASONS
  const addCancelReason = (item: CancelReason) => addItem('cancel_reasons', item, setCancelReasons, mapCancelReasonToDB, mapCancelReasonFromDB);
  const updateCancelReason = (item: CancelReason) => updateItem('cancel_reasons', item, setCancelReasons, mapCancelReasonToDB, mapCancelReasonFromDB);
  const deleteCancelReason = (id: string) => deleteItem('cancel_reasons', id, setCancelReasons);

  // -- NOTIFICATIONS
  const sendNotification = async (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => {
    try {
      const payload = {
        id: crypto.randomUUID(), // Local ID
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        relatedId: notification.relatedId,
        isRead: false,
        createdAt: new Date().toISOString()
      };
      
      // Update Local State directly since we don't have a table
      setNotifications(prev => [payload, ...prev]);

      /* 
      // Table insert disabled
      const { data, error } = await supabase.from('notifications').insert(payload).select().single();
      if (error) {
          console.warn("Notification insert failed (Table might be missing):", error.message);
      } 
      */
    } catch (e) {
        console.error("Send notification error:", e);
    }
  };

  const markNotificationAsRead = async (id: string) => {
      // Optimistic
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };
  
  const triggerRefresh = () => {
      setRefreshTrigger(prev => prev + 1);
      toast.info("Memperbarui data...");
  };

  // -- TECHNICIAN SCHEDULES (Direct DB Table)
  const addSchedule = async (schedule: TechnicianSchedule) => {
    try {
        const payload = mapScheduleToDB(schedule);
        const { data, error } = await supabase.from('technician_schedules').insert(payload).select().single();
        
        if (error) throw error;
        
        if (data) {
             const newSchedule = mapScheduleFromDB(data);
             setTechnicianSchedules(prev => [...prev.filter(item => item.id !== newSchedule.id), newSchedule]);
             toast.success("Jadwal libur berhasil disimpan");
        }
    } catch (e: any) {
        console.error("Error adding schedule:", e);
        toast.error("Gagal menyimpan jadwal: " + e.message);
    }
  };

  const deleteSchedule = async (userId: string, date: string) => {
    try {
        const { error } = await supabase.from('technician_schedules').delete().eq('user_id', userId).eq('date', date);
        if (error) throw error;
        
        setTechnicianSchedules(prev => prev.filter(s => !(s.userId === userId && s.date === date)));
        toast.success("Jadwal libur dihapus");
    } catch (e: any) {
        console.error("Error deleting schedule:", e);
        toast.error("Gagal menghapus jadwal");
    }
  };

  // -- LEADS (Direct Supabase Table)
  const addLead = async (item: Lead, options?: MutationOptions) => {
    try {
      let savedLead: Lead | undefined;

      try {
        const payload = mapLeadToDB(item);
        const { data, error } = await supabase.from('leads').insert(payload).select().single();
        if (error) throw error;
        savedLead = data ? mapLeadFromDB(data, leadSocialContactsRef.current[data.id]) : item;
      } catch (error) {
        if (!isLeadSocialSchemaError(error)) {
          throw error;
        }

        const fallbackLead = stripLeadSocialFields(item);
        const payload = mapLeadToDB(fallbackLead);
        const { data, error: fallbackError } = await supabase.from('leads').insert(payload).select().single();
        if (fallbackError) throw fallbackError;
        savedLead = mergeLeadSocialFields(
          data ? mapLeadFromDB(data, leadSocialContactsRef.current[data.id]) : fallbackLead,
          pickLeadSocialFields(item),
        );
      }

      if (savedLead) {
        setLeads(prev => {
          if (prev.some(lead => lead.id === savedLead!.id)) return prev;
          return [savedLead!, ...prev];
        });
      }

      if (hasLeadSocialData(item)) {
        try {
          await upsertLeadSocialContact(savedLead || item);
        } catch (socialError: any) {
          console.error('Error saving lead social contact:', socialError);
          toast.error(`Kontak sosial belum tersimpan: ${socialError.message}`);
        }
      }

      if (!options?.silent) {
        toast.success("Data berhasil disimpan");
      }
      return savedLead;
    } catch (e: any) {
      console.error(`Error adding to leads:`, e);
      if (!options?.silent) {
        toast.error(`Gagal menyimpan data: ${e.message}`);
      }
      throw e;
    }
  };

  const updateLead = async (item: Lead) => {
    try {
      let savedLead: Lead;

      try {
        const payload = mapLeadToDB(item);
        const { data, error } = await supabase.from('leads').update(payload).eq('id', item.id).select().single();
        if (error) throw error;
        savedLead = data ? mapLeadFromDB(data, leadSocialContactsRef.current[data.id]) : item;
      } catch (error) {
        if (!isLeadSocialSchemaError(error)) {
          throw error;
        }

        const fallbackLead = stripLeadSocialFields(item);
        const payload = mapLeadToDB(fallbackLead);
        const { data, error: fallbackError } = await supabase.from('leads').update(payload).eq('id', item.id).select().single();
        if (fallbackError) throw fallbackError;
        savedLead = mergeLeadSocialFields(
          data ? mapLeadFromDB(data, leadSocialContactsRef.current[data.id]) : fallbackLead,
          pickLeadSocialFields(item),
        );
      }

      setLeads(prev => prev.map(lead => lead.id === item.id ? savedLead : lead));

      if (hasLeadSocialData(item)) {
        try {
          await upsertLeadSocialContact(savedLead);
        } catch (socialError: any) {
          console.error('Error updating lead social contact:', socialError);
          toast.error(`Kontak sosial belum tersimpan: ${socialError.message}`);
        }
      } else {
        await deleteLeadSocialContact(item.id);
      }

      toast.success("Data berhasil diperbarui");
    } catch (e: any) {
      console.error(`Error updating leads:`, e);
      toast.error(`Gagal memperbarui data: ${e.message}`);
      throw e;
    }
  };

  const deleteLead = async (id: string, options?: MutationOptions) => {
    try {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
      setLeads(prev => prev.filter(lead => lead.id !== id));
      await deleteLeadSocialContact(id);
      if (!options?.silent) {
        toast.success("Data berhasil dihapus");
      }
    } catch (e: any) {
      console.error(`Error deleting from leads:`, e);
      if (!options?.silent) {
        toast.error(`Gagal menghapus data: ${e.message}`);
      }
      throw e;
    }
  };

  const validateProspectBookingTechnicianAvailabilityBeforeSave = (
    item: ProspectBooking,
    previousBooking?: ProspectBooking,
  ) => {
    if (!shouldValidateProspectBookingTechnicianAvailabilityOnSave(previousBooking, item)) {
      return;
    }

    const technicianSchedule = getTechnicianDaySchedule(
      item.technicianId,
      item.scheduleDate,
      technicianSchedules,
    );

    if (!technicianSchedule) {
      return;
    }

    throw new Error(
      formatTechnicianUnavailableMessage(
        {
          branchId: item.branchId,
          technicianId: item.technicianId,
          serviceDate: item.scheduleDate,
          serviceTime: item.scheduleTime,
        },
        technicianSchedule,
        users,
      ),
    );
  };

  const validateProspectBookingScheduleBeforeSave = (
    item: ProspectBooking,
    previousBooking?: ProspectBooking,
  ) => {
    if (!item.orderId && !isInactiveProspectBookingScheduleStatus(item.status) && !item.technicianId) {
      throw new Error('Teknisi wajib dipilih untuk booking prospek aktif.');
    }

    validateProspectBookingTechnicianAvailabilityBeforeSave(item, previousBooking);

    if (!shouldValidateProspectBookingScheduleOnSave(previousBooking, item)) {
      return;
    }

    const { activeOrderConflicts, activeBookingConflicts } =
      getProspectBookingScheduleConflicts(item, getScheduleBlockingProspectBookings(), orders);
    const activeConflicts = [...activeOrderConflicts, ...activeBookingConflicts];
    if (activeConflicts.length === 0) {
      return;
    }

    throw new Error(
      formatProspectBookingScheduleConflictMessage(item, activeConflicts, users),
    );
  };

  const validateProspectBookingScheduleFreshBeforeSave = async (
    item: ProspectBooking,
    previousBooking?: ProspectBooking,
  ) => {
    if (!shouldValidateProspectBookingScheduleOnSave(previousBooking, item)) {
      return;
    }

    const conflictMessage = await validateProspectBookingScheduleFromDB(item, users, {
      ignoredBookingLeadIds: getIgnoredBookingLeadIds(),
    });
    if (conflictMessage) {
      throw new Error(conflictMessage);
    }
  };

  const addProspectBooking = async (item: ProspectBooking, options?: MutationOptions) => {
    validateProspectBookingScheduleBeforeSave(item);
    await validateProspectBookingScheduleFreshBeforeSave(item);
    return addItem('prospect_bookings', item, setProspectBookings, mapProspectBookingToDB, mapProspectBookingFromDB, options);
  };
  const updateProspectBooking = async (item: ProspectBooking) => {
    const previousBooking = prospectBookings.find((booking) => booking.id === item.id);
    validateProspectBookingScheduleBeforeSave(item, previousBooking);
    await validateProspectBookingScheduleFreshBeforeSave(item, previousBooking);
    return updateItem('prospect_bookings', item, setProspectBookings, mapProspectBookingToDB, mapProspectBookingFromDB);
  };
  const deleteProspectBooking = (id: string) => deleteItem('prospect_bookings', id, setProspectBookings);

  const isNonBlockingScheduleBookingLead = (leadId?: string | null) => {
    if (!leadId) return false;
    const lead = leads.find((item) => item.id === leadId);
    return lead?.status === 'Cancel' || lead?.status === 'Closing';
  };

  const getScheduleBlockingProspectBookings = () =>
    prospectBookings.filter((booking) => !isNonBlockingScheduleBookingLead(booking.leadId));

  const getIgnoredBookingLeadIds = () =>
    new Set(
      leads
        .filter((lead) => lead.status === 'Cancel' || lead.status === 'Closing')
        .map((lead) => lead.id),
    );

  // -- ORDERS (Direct Supabase Table)
  const normalizeScheduleValue = (value?: string | null) => value?.trim() || '';

  const orderMatchesBookingSchedule = (order: Order, booking: ProspectBooking) => (
    normalizeScheduleValue(order.leadId) === normalizeScheduleValue(booking.leadId) &&
    normalizeScheduleValue(order.technicianId) === normalizeScheduleValue(booking.technicianId) &&
    normalizeScheduleValue(order.serviceDate) === normalizeScheduleValue(booking.scheduleDate) &&
    normalizeOrderTime(order.serviceTime) === normalizeOrderTime(booking.scheduleTime)
  );

  const getOrderLifecycleBookings = (order: Order) =>
    prospectBookings.filter((booking) => {
      if (booking.orderId === order.id) return true;
      if (booking.orderId) return false;
      if (!order.leadId || booking.leadId !== order.leadId) return false;
      return orderMatchesBookingSchedule(order, booking);
    });

  const updateProspectBookingLifecycleSilently = async (
    booking: ProspectBooking,
    patch: Partial<Pick<ProspectBooking, 'orderId' | 'status'>>,
  ) => {
    const updatedAt = new Date().toISOString();
    const updatePayload: Record<string, string | null> = {
      updated_at: updatedAt,
    };

    if (patch.orderId !== undefined) {
      updatePayload.order_id = patch.orderId || null;
    }

    if (patch.status) {
      updatePayload.status = patch.status;
    }

    const { data, error } = await supabase
      .from('prospect_bookings')
      .update(updatePayload)
      .eq('id', booking.id)
      .select()
      .single();

    if (error) throw error;

    const updatedBooking = data
      ? mapProspectBookingFromDB(data)
      : { ...booking, ...patch, updatedAt };

    setProspectBookings((prev) =>
      prev.map((item) => item.id === updatedBooking.id ? updatedBooking : item),
    );

    return updatedBooking;
  };

  const updateLeadStatusSilently = async (lead: Lead, status: Lead['status']) => {
    if (lead.status === status) return;

    const { data, error } = await supabase
      .from('leads')
      .update({ status })
      .eq('id', lead.id)
      .select()
      .single();

    if (error) throw error;

    const updatedLead = data
      ? mapLeadFromDB(data, leadSocialContactsRef.current[data.id])
      : { ...lead, status };

    setLeads((prev) =>
      prev.map((item) => item.id === updatedLead.id ? updatedLead : item),
    );
  };

  const syncOrderProspectLifecycle = async (order: Order) => {
    if (!order.leadId) return;

    const relatedLead = leads.find((lead) => lead.id === order.leadId);
    const hasOtherActiveOrderForLead = orders.some((item) =>
      item.id !== order.id &&
      item.leadId === order.leadId &&
      !isInactiveOrderScheduleStatus(item.status)
    );

    if (isInactiveOrderScheduleStatus(order.status)) {
      const nextBookingStatus = order.status === 'cancelled' ? 'cancelled' : 'reschedule';
      const relatedBookings = getOrderLifecycleBookings(order);

      await Promise.all(
        relatedBookings.map((booking) => (
          booking.status === nextBookingStatus
            ? Promise.resolve()
            : updateProspectBookingLifecycleSilently(booking, { status: nextBookingStatus })
        )),
      );

      if (relatedLead && !hasOtherActiveOrderForLead) {
        await updateLeadStatusSilently(
          relatedLead,
          order.status === 'cancelled' ? 'Cancel' : 'Follow Up',
        );
      }
      return;
    }

    const relatedBookings = getOrderLifecycleBookings(order).filter((booking) =>
      !isInactiveProspectBookingScheduleStatus(booking.status) || booking.orderId === order.id
    );

    await Promise.all(
      relatedBookings.map((booking) => (
        booking.orderId === order.id && booking.status === 'confirmed'
          ? Promise.resolve()
          : updateProspectBookingLifecycleSilently(booking, {
              orderId: order.id,
              status: 'confirmed',
            })
      )),
    );

    if (relatedLead) {
      await updateLeadStatusSilently(relatedLead, 'Closing');
    }
  };

  const validateTechnicianAvailabilityBeforeSave = (item: Order, previousOrder?: Order) => {
    if (!shouldValidateTechnicianAvailabilityOnSave(previousOrder, item)) {
      return;
    }

    const technicianSchedule = getTechnicianDaySchedule(
      item.technicianId,
      item.serviceDate,
      technicianSchedules,
    );

    if (!technicianSchedule) {
      return;
    }

    throw new Error(
      formatTechnicianUnavailableMessage(item, technicianSchedule, users),
    );
  };

  const validateOrderScheduleBeforeSave = (item: Order, previousOrder?: Order) => {
    validateTechnicianAvailabilityBeforeSave(item, previousOrder);

    if (!shouldValidateOrderScheduleOnSave(previousOrder, item)) {
      return;
    }

    const { activeConflicts } = getOrderScheduleConflicts(item, orders);
    if (activeConflicts.length > 0) {
      throw new Error(
        formatOrderScheduleConflictMessage(item, activeConflicts, users),
      );
    }

    const activeBookingConflicts = getOrderProspectBookingScheduleConflicts(
      item,
      getScheduleBlockingProspectBookings(),
    );
    if (activeBookingConflicts.length > 0) {
      throw new Error(
        formatOrderBookingScheduleConflictMessage(item, activeBookingConflicts, users),
      );
    }
  };

  const validateOrderScheduleFreshBeforeSave = async (item: Order, previousOrder?: Order) => {
    if (!shouldValidateOrderScheduleOnSave(previousOrder, item)) {
      return;
    }

    const conflictMessage = await validateOrderScheduleFromDB(item, users, {
      ignoredBookingLeadIds: getIgnoredBookingLeadIds(),
    });
    if (conflictMessage) {
      throw new Error(conflictMessage);
    }
  };

  const addOrder = async (item: Order) => {
    validateOrderScheduleBeforeSave(item);
    await validateOrderScheduleFreshBeforeSave(item);
    const savedOrder = await addItem('orders', item, setOrders, mapOrderToDB, mapOrderFromDB);
    try {
      await syncOrderProspectLifecycle((savedOrder || item) as Order);
    } catch (error) {
      console.error('Error syncing new order prospect lifecycle:', error);
      toast.error('Pesanan tersimpan, tapi sinkronisasi prospek/booking gagal. Coba refresh lalu cek prospek terkait.');
    }
    return savedOrder;
  };

  const updateOrder = async (item: Order) => {
    const previousOrder = orders.find((order) => order.id === item.id);
    validateOrderScheduleBeforeSave(item, previousOrder);
    await validateOrderScheduleFreshBeforeSave(item, previousOrder);
    const savedOrder = await updateItem('orders', item, setOrders, mapOrderToDB, mapOrderFromDB);
    try {
      await syncOrderProspectLifecycle((savedOrder || item) as Order);
    } catch (error) {
      console.error('Error syncing order prospect lifecycle:', error);
      toast.error('Status pesanan tersimpan, tapi sinkronisasi prospek/booking gagal. Coba refresh lalu ulangi jika masih belum sesuai.');
    }
    return savedOrder;
  };
  const deleteOrder = (id: string) => deleteItem('orders', id, setOrders);

  // -- WA TEMPLATES (Direct Supabase Table)
  const addWATemplate = (item: WATemplate) => addItem('wa_templates', item, setWaTemplates, mapWATemplateToDB, mapWATemplateFromDB);
  const updateWATemplate = (item: WATemplate) => updateItem('wa_templates', item, setWaTemplates, mapWATemplateToDB, mapWATemplateFromDB);
  const deleteWATemplate = (id: string) => deleteItem('wa_templates', id, setWaTemplates);

  // -- DAILY ADS (Direct Supabase Table)
  const addDailyAd = (item: DailyAd) => addItem('daily_ads', item, setDailyAds, mapDailyAdToDB, mapDailyAdFromDB);
  const updateDailyAd = (item: DailyAd) => updateItem('daily_ads', item, setDailyAds, mapDailyAdToDB, mapDailyAdFromDB);
  const deleteDailyAd = (id: string) => deleteItem('daily_ads', id, setDailyAds);

  // -- LEAD SPAM DAILY INPUTS (Supabase table with server fallback while migration is pending)
  const addLeadSpamDailyInput = async (item: LeadSpamDailyInput, options?: MutationOptions) => {
    if (leadSpamDailyInputsUseFallbackRef.current) {
      try {
        const fallbackItem = await upsertLeadSpamDailyInputFallback(item);
        setLeadSpamDailyInputs(prev => {
          if (prev.some(i => i.id === fallbackItem.id)) {
            return prev.map(i => i.id === fallbackItem.id ? { ...i, ...fallbackItem } : i);
          }
          return [fallbackItem, ...prev];
        });
        if (!options?.silent) {
          toast.success("Data berhasil disimpan");
        }
        return fallbackItem;
      } catch (e: any) {
        console.error('Error adding lead spam fallback:', e);
        if (!options?.silent) {
          toast.error(`Gagal menyimpan data: ${e.message}`);
        }
        throw e;
      }
    }

    return addItem(
      'lead_spam_daily_inputs',
      item,
      setLeadSpamDailyInputs,
      mapLeadSpamDailyInputToDB,
      mapLeadSpamDailyInputFromDB,
      options,
    );
  };

  const updateLeadSpamDailyInput = async (item: LeadSpamDailyInput) => {
    if (leadSpamDailyInputsUseFallbackRef.current) {
      try {
        const fallbackItem = await upsertLeadSpamDailyInputFallback(item);
        setLeadSpamDailyInputs(prev => {
          if (prev.some(i => i.id === fallbackItem.id)) {
            return prev.map(i => i.id === fallbackItem.id ? { ...i, ...fallbackItem } : i);
          }
          return [fallbackItem, ...prev];
        });
        toast.success("Data berhasil diperbarui");
        return;
      } catch (e: any) {
        console.error('Error updating lead spam fallback:', e);
        toast.error(`Gagal memperbarui data: ${e.message}`);
        throw e;
      }
    }

    return updateItem(
      'lead_spam_daily_inputs',
      item,
      setLeadSpamDailyInputs,
      mapLeadSpamDailyInputToDB,
      mapLeadSpamDailyInputFromDB,
    );
  };

  const deleteLeadSpamDailyInput = async (id: string, options?: MutationOptions) => {
    if (leadSpamDailyInputsUseFallbackRef.current) {
      try {
        await deleteLeadSpamDailyInputFallback(id);
        setLeadSpamDailyInputs(prev => prev.filter(i => i.id !== id));
        if (!options?.silent) {
          toast.success("Data berhasil dihapus");
        }
        return;
      } catch (e: any) {
        console.error('Error deleting lead spam fallback:', e);
        if (!options?.silent) {
          toast.error(`Gagal menghapus data: ${e.message}`);
        }
        throw e;
      }
    }

    return deleteItem('lead_spam_daily_inputs', id, setLeadSpamDailyInputs, options);
  };

  // Initial Fetch (Waterfall)
  useEffect(() => {
    const fetchCatalog = createMasterDataFetchCatalog({
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
      mapLeadRow: (lead) => mapLeadFromDB(lead, leadSocialContactsRef.current[lead.id]),
    });

    // 1. Fetch Masters
    fetchCatalog.masters.forEach(({ table, setter, mapper }) => {
      fetchData(table, setter, mapper);
    });
    
    // 2. Fetch Users (Profiles)
    const fetchUsers = async () => {
         const { data: profiles } = await supabase.from('profiles').select('*');
         if (profiles) {
            setUsers(mapProfilesToUsers(profiles));
         }
    };
    fetchUsers();

    // 3. Fetch Configs (Advertiser Access) - FETCH FROM SERVER (KV STORE)
    const fetchConfigs = async () => {
        try {
            const headers = await getSessionBackedEdgeHeaders();
            // NOTE: Using 'access-configs' instead of 'advertiser-configs' to avoid AdBlockers
            const response = await fetch(buildMakeServerUrl('/access-configs'), {
                headers,
            });
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                     // KV store usually returns array of values. 
                     // Ensure structure matches what we expect
                     setAdvertiserConfigs(data.map((d: any) => ({
                        advertiserId: d.advertiserId || d.advertiser_id, // Handle both cases just in case
                        platformIds: d.platformIds || d.platform_ids || [],
                        subChannelIds: d.subChannelIds || d.sub_channel_ids || [],
                        csIds: d.csIds || d.cs_ids || []
                    })));
                }
            }
        } catch (e) {
            console.error("Failed to fetch advertiser configs from server:", e);
        }
    };
    fetchConfigs();

    // 4. Defer heavy operational data so the app shell and admin pages render first.
    // Orders, leads, ads, and audit logs can be large; pulling them during boot slows every route.
    let isCancelled = false;
    const deferredTimers: number[] = [];
    const idleApi = window as unknown as {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idleRequestId: number | undefined;

    const runDeferredOperationalFetches = () => {
      if (isCancelled) return;

      if (import.meta.env.DEV) {
        console.info('[MasterData] starting deferred operational fetches');
      }

      fetchCatalog.transactional.forEach(({ table, setter, mapper }) => {
        fetchData(table, setter, mapper);
      });
      fetchLeadSocialContacts();

      const supportTimer = window.setTimeout(() => {
        if (isCancelled) return;
        fetchCatalog.support.forEach(({ table, setter, mapper }) => {
          fetchData(table, setter, mapper);
        });
      }, 1500);
      deferredTimers.push(supportTimer);
    };

    if (idleApi.requestIdleCallback) {
      idleRequestId = idleApi.requestIdleCallback(runDeferredOperationalFetches, { timeout: 1600 });
    } else {
      deferredTimers.push(window.setTimeout(runDeferredOperationalFetches, 500));
    }

    return () => {
      isCancelled = true;
      if (idleRequestId !== undefined && idleApi.cancelIdleCallback) {
        idleApi.cancelIdleCallback(idleRequestId);
      }
      deferredTimers.forEach((timerId) => window.clearTimeout(timerId));
    };

  }, [refreshTrigger]);

  // --- REALTIME SUBSCRIPTIONS ---
  useEffect(() => {
    // Channel for high-frequency updates (Orders, Leads, Profiles)
    const channel = supabase.channel('realtime_master_data')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'orders' }, 
        (payload) => {
          if (payload.eventType === 'INSERT') {
             const newItem = mapOrderFromDB(payload.new);
             setOrders(prev => [newItem, ...prev.filter(item => item.id !== newItem.id)]);
             
             // 1. Play Sound (Ding!)
             try {
                 const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                 audio.volume = 0.6;
                 audio.play().catch(e => console.warn("Audio autoplay blocked by browser:", e));
             } catch (e) {
                 console.error("Audio error:", e);
             }

             // 2. Add to Notification Bell
             const targetUserId = currentUserRef.current?.id;
             if (targetUserId) {
                 sendNotification({
                    userId: targetUserId,
                    title: 'Pesanan Baru Masuk!',
                    message: `${newItem.customerName} - Rp ${parseInt(String(newItem.price || 0)).toLocaleString('id-ID')}`,
                    type: 'success',
                    relatedId: newItem.id
                 });
             }

             toast.info(`Pesanan Baru: ${newItem.customerName}`);
          } else if (payload.eventType === 'UPDATE') {
             const updatedItem = mapOrderFromDB(payload.new);
             setOrders(prev => {
               const exists = prev.some(item => item.id === updatedItem.id);
               return exists
                 ? prev.map(item => item.id === updatedItem.id ? updatedItem : item)
                 : [updatedItem, ...prev];
             });
          } else if (payload.eventType === 'DELETE') {
             setOrders(prev => prev.filter(item => item.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
             const newItem = mapLeadFromDB(payload.new, leadSocialContactsRef.current[payload.new.id]);
             setLeads(prev => [newItem, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
             const updatedItem = mapLeadFromDB(payload.new, leadSocialContactsRef.current[payload.new.id]);
             setLeads(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
          } else if (payload.eventType === 'DELETE') {
             setLeadSocialContacts(prev => {
               const next = { ...prev };
               delete next[payload.old.id];
               return next;
             });
             setLeads(prev => prev.filter(item => item.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'prospect_bookings' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem = mapProspectBookingFromDB(payload.new);
            setProspectBookings(prev => [newItem, ...prev.filter(item => item.id !== newItem.id)]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedItem = mapProspectBookingFromDB(payload.new);
            setProspectBookings(prev => {
              const exists = prev.some(item => item.id === updatedItem.id);
              return exists
                ? prev.map(item => item.id === updatedItem.id ? updatedItem : item)
                : [updatedItem, ...prev];
            });
          } else if (payload.eventType === 'DELETE') {
            setProspectBookings(prev => prev.filter(item => item.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lead_spam_daily_inputs' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem = mapLeadSpamDailyInputFromDB(payload.new);
            setLeadSpamDailyInputs((prev) => [newItem, ...prev.filter((item) => item.id !== newItem.id)]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedItem = mapLeadSpamDailyInputFromDB(payload.new);
            setLeadSpamDailyInputs((prev) => prev.map((item) => item.id === updatedItem.id ? updatedItem : item));
          } else if (payload.eventType === 'DELETE') {
            setLeadSpamDailyInputs((prev) => prev.filter((item) => item.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'technician_schedules' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem = mapScheduleFromDB(payload.new);
            setTechnicianSchedules(prev => [...prev.filter(item => item.id !== newItem.id), newItem]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedItem = mapScheduleFromDB(payload.new);
            setTechnicianSchedules(prev => {
              const exists = prev.some(item => item.id === updatedItem.id);
              return exists
                ? prev.map(item => item.id === updatedItem.id ? updatedItem : item)
                : [...prev, updatedItem];
            });
          } else if (payload.eventType === 'DELETE') {
            setTechnicianSchedules(prev => prev.filter(item => item.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
           // We only handle UPDATE/INSERT for profiles to keep user list fresh
           // We don't delete users automatically to preserve history/UI consistency until refresh
           if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
             const p = payload.new;
             const updatedUser = mapProfileToUser(p);
             
             setUsers(prev => {
                if (!updatedUser) {
                  return prev.filter(u => u.id !== p.id);
                }

                const exists = prev.find(u => u.id === updatedUser.id);
                if (exists) return prev.map(u => u.id === updatedUser.id ? updatedUser : u);
                return [updatedUser, ...prev];
             });
           }
        }
      )
      .subscribe((status) => {
         if (status === 'SUBSCRIBED') {
             console.log("Realtime Master Data Connected");
         }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Use useMemo to prevent unnecessary re-renders
  const value = React.useMemo(() => ({
    areas, branches, activeBranches, services, vehicles, platforms, subChannels, 
    adAccounts, adAccountAssignments, adAccountOwnerAssignments, sources, payments, roles, users,
    leads, leadSpamDailyInputs, prospectBookings, waTemplates, orders, dailyAds, notifications, advertiserConfigs, affiliates, vendors, cancelReasons,
    technicianSchedules, addSchedule, deleteSchedule,
    auditLogs,

    addUser, createSystemUser, updateUser, updateSystemUser, deleteUser, deleteSystemUser, resetUserPassword,
    addLead, updateLead, deleteLead,
    addProspectBooking, updateProspectBooking, deleteProspectBooking,
    addOrder, updateOrder, deleteOrder,
    addWATemplate, updateWATemplate, deleteWATemplate,
    addDailyAd, updateDailyAd, deleteDailyAd,
    addLeadSpamDailyInput, updateLeadSpamDailyInput, deleteLeadSpamDailyInput,
    addArea, updateArea, deleteArea,
    addBranch, updateBranch, deleteBranch,
    addService, updateService, deleteService,
    addVehicle, updateVehicle, deleteVehicle,
    addAdAccount, updateAdAccount, deleteAdAccount,
    assignAdAccountCs, updateAdAccountAssignment, deleteAdAccountAssignment,
    assignAdAccountOwner, updateAdAccountOwnerAssignment, deleteAdAccountOwnerAssignment,
    addPlatform, updatePlatform, deletePlatform,
    addSubChannel, updateSubChannel, deleteSubChannel,
    addSource, updateSource, deleteSource,
    addPayment, updatePayment, deletePayment,
    addRole, updateRole, deleteRole,
    addAffiliate, updateAffiliate, deleteAffiliate,
    addVendor, updateVendor, deleteVendor,
    addCancelReason, updateCancelReason, deleteCancelReason,
    
    markNotificationAsRead, sendNotification,

    refreshTrigger, triggerRefresh,

    setAreas,
    currentRole, currentUser, isCurrentUserResolved, currentUserIssue, setCurrentRole, setCurrentUser
  }), [
    areas, branches, activeBranches, services, vehicles, platforms, subChannels, 
    adAccounts, adAccountAssignments, adAccountOwnerAssignments, sources, payments, roles, users,
    leads, leadSpamDailyInputs, prospectBookings, waTemplates, orders, dailyAds, notifications, advertiserConfigs, affiliates, vendors, cancelReasons,
    technicianSchedules,
    auditLogs, currentRole, currentUser, isCurrentUserResolved, currentUserIssue, refreshTrigger
  ]);

  return (
    <MasterDataContext.Provider value={value}>
      {children}
    </MasterDataContext.Provider>
  );
};

export const useMasterData = () => {
  const context = useContext(MasterDataContext);
  if (!context) {
    throw new Error('useMasterData must be used within a MasterDataProvider');
  }
  return context;
};
