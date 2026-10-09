import type { PermissionKey } from "../../../src/app/data/permissions.ts";

export const OPERATIONAL_EXPENSE_VIEW_PERMISSION: PermissionKey = "operational_expenses.view";
export const OPERATIONAL_EXPENSE_CREATE_PERMISSION: PermissionKey = "operational_expenses.create";
export const OPERATIONAL_EXPENSE_EDIT_PERMISSION: PermissionKey = "operational_expenses.edit";
export const OPERATIONAL_EXPENSE_DELETE_PERMISSION: PermissionKey = "operational_expenses.delete";
export const RECURRING_EXPENSE_VIEW_PERMISSION: PermissionKey = "recurring_expenses.view";
export const RECURRING_EXPENSE_PAY_PERMISSION: PermissionKey = "recurring_expenses.pay";
export const MASTER_DATA_VIEW_PERMISSION: PermissionKey = "master_data.view";
export const MASTER_DATA_CREATE_PERMISSION: PermissionKey = "master_data.create";
export const MASTER_DATA_EDIT_PERMISSION: PermissionKey = "master_data.edit";
export const MASTER_DATA_DELETE_PERMISSION: PermissionKey = "master_data.delete";
export const ADS_MANAGE_PERMISSION: PermissionKey = "ads.manage";
export const MARKETING_MONITORING_VIEW_PERMISSION: PermissionKey = "monitoring.marketing.view";
export const CS_OKR_VIEW_PERMISSION: PermissionKey = "cs_okr.view";
export const CS_OKR_MANAGE_PERMISSION: PermissionKey = "cs_okr.manage";
export const DAILY_REPORT_VIEW_PERMISSION: PermissionKey = "daily_report.view";
export const DAILY_REPORT_CREATE_PERMISSION: PermissionKey = "daily_report.create";
export const DAILY_REPORT_EDIT_PERMISSION: PermissionKey = "daily_report.edit";
export const DAILY_REPORT_DELETE_PERMISSION: PermissionKey = "daily_report.delete";

export const ORDER_READ_PERMISSIONS: PermissionKey[] = ["order.view", "order.view_details", "teknisi.view_mobile"];

export const OPERATIONAL_REFERENCE_READ_PERMISSIONS: PermissionKey[] = [
  "master_data.view",
  "order.view",
  "order.create",
  "order.edit",
  "leads.view",
  "leads.create",
  "schedule.view",
  "technician_schedule.view",
  "monitoring.view",
  "monitoring.activity_view",
  "teknisi.view_mobile",
  DAILY_REPORT_VIEW_PERMISSION,
  "finance_report.view",
  OPERATIONAL_EXPENSE_VIEW_PERMISSION,
  "payroll.view",
];

export const ADS_REFERENCE_READ_PERMISSIONS: PermissionKey[] = [
  "master_data.view",
  "ads.view_daily",
  "ads.view_analytics",
  ADS_MANAGE_PERMISSION,
  MARKETING_MONITORING_VIEW_PERMISSION,
  CS_OKR_VIEW_PERMISSION,
  "leads.view",
  "leads.create",
  "order.view",
  "dashboard.view_advertiser",
  "dashboard.view_cs",
  "dashboard.view_owner",
];

export const USER_REFERENCE_READ_PERMISSIONS: PermissionKey[] = [
  "users.view",
  "role_permissions.view",
  "master_data.view",
  "order.view",
  "order.create",
  "leads.view",
  "schedule.view",
  "technician_schedule.view",
  "monitoring.view",
  "monitoring.activity_view",
  "payroll.view",
  DAILY_REPORT_VIEW_PERMISSION,
  "finance_report.view",
  MARKETING_MONITORING_VIEW_PERMISSION,
  CS_OKR_VIEW_PERMISSION,
  "whatsapp.view",
];

export const MAP_EXPAND_URL_PERMISSIONS: PermissionKey[] = [
  "map.view_route",
  "map.view_global",
  "order.view_details",
  "order.create",
  "order.edit",
  "schedule.view",
  "monitoring.activity_view",
  "teknisi.view_mobile",
];

export type AppDataAccessConfig = {
  table: string;
  read: PermissionKey[];
  create?: PermissionKey[];
  edit?: PermissionKey[];
  delete?: PermissionKey[];
  orderBy?: string;
  ascending?: boolean;
  maxLimit?: number;
  filterableColumns?: string[];
};

export const APP_DATA_ACCESS: Record<string, AppDataAccessConfig> = {
  branches: {
    table: "branches",
    read: OPERATIONAL_REFERENCE_READ_PERMISSIONS,
    create: [MASTER_DATA_CREATE_PERMISSION],
    edit: [MASTER_DATA_EDIT_PERMISSION],
    delete: [MASTER_DATA_DELETE_PERMISSION],
  },
  areas: {
    table: "areas",
    read: OPERATIONAL_REFERENCE_READ_PERMISSIONS,
    create: [MASTER_DATA_CREATE_PERMISSION],
    edit: [MASTER_DATA_EDIT_PERMISSION],
    delete: [MASTER_DATA_DELETE_PERMISSION],
  },
  services: {
    table: "services",
    read: OPERATIONAL_REFERENCE_READ_PERMISSIONS,
    create: [MASTER_DATA_CREATE_PERMISSION],
    edit: [MASTER_DATA_EDIT_PERMISSION],
    delete: [MASTER_DATA_DELETE_PERMISSION],
  },
  vehicle_types: {
    table: "vehicle_types",
    read: OPERATIONAL_REFERENCE_READ_PERMISSIONS,
    create: [MASTER_DATA_CREATE_PERMISSION],
    edit: [MASTER_DATA_EDIT_PERMISSION],
    delete: [MASTER_DATA_DELETE_PERMISSION],
  },
  payment_methods: {
    table: "payment_methods",
    read: [...OPERATIONAL_REFERENCE_READ_PERMISSIONS, "order.payment.view"],
    create: [MASTER_DATA_CREATE_PERMISSION],
    edit: [MASTER_DATA_EDIT_PERMISSION],
    delete: [MASTER_DATA_DELETE_PERMISSION],
  },
  cancel_reasons: {
    table: "cancel_reasons",
    read: ORDER_READ_PERMISSIONS,
    create: [MASTER_DATA_CREATE_PERMISSION],
    edit: [MASTER_DATA_EDIT_PERMISSION],
    delete: [MASTER_DATA_DELETE_PERMISSION],
  },
  ad_platforms: {
    table: "ad_platforms",
    read: ADS_REFERENCE_READ_PERMISSIONS,
    create: [MASTER_DATA_CREATE_PERMISSION, ADS_MANAGE_PERMISSION],
    edit: [MASTER_DATA_EDIT_PERMISSION, ADS_MANAGE_PERMISSION],
    delete: [MASTER_DATA_DELETE_PERMISSION, ADS_MANAGE_PERMISSION],
  },
  ad_sub_channels: {
    table: "ad_sub_channels",
    read: ADS_REFERENCE_READ_PERMISSIONS,
    create: [MASTER_DATA_CREATE_PERMISSION, ADS_MANAGE_PERMISSION],
    edit: [MASTER_DATA_EDIT_PERMISSION, ADS_MANAGE_PERMISSION],
    delete: [MASTER_DATA_DELETE_PERMISSION, ADS_MANAGE_PERMISSION],
  },
  ad_accounts: {
    table: "ad_accounts",
    read: ADS_REFERENCE_READ_PERMISSIONS,
    create: [MASTER_DATA_CREATE_PERMISSION, ADS_MANAGE_PERMISSION],
    edit: [MASTER_DATA_EDIT_PERMISSION, ADS_MANAGE_PERMISSION],
    delete: [MASTER_DATA_DELETE_PERMISSION, ADS_MANAGE_PERMISSION],
  },
  ad_account_assignments: {
    table: "ad_account_assignments",
    read: ADS_REFERENCE_READ_PERMISSIONS,
    create: [MASTER_DATA_CREATE_PERMISSION, ADS_MANAGE_PERMISSION],
    edit: [MASTER_DATA_EDIT_PERMISSION, ADS_MANAGE_PERMISSION],
    delete: [MASTER_DATA_DELETE_PERMISSION, ADS_MANAGE_PERMISSION],
  },
  ad_account_owner_assignments: {
    table: "ad_account_owner_assignments",
    read: ADS_REFERENCE_READ_PERMISSIONS,
    create: [MASTER_DATA_CREATE_PERMISSION, ADS_MANAGE_PERMISSION],
    edit: [MASTER_DATA_EDIT_PERMISSION, ADS_MANAGE_PERMISSION],
    delete: [MASTER_DATA_DELETE_PERMISSION, ADS_MANAGE_PERMISSION],
  },
  ad_sources: {
    table: "ad_sources",
    read: ADS_REFERENCE_READ_PERMISSIONS,
    create: [MASTER_DATA_CREATE_PERMISSION, ADS_MANAGE_PERMISSION],
    edit: [MASTER_DATA_EDIT_PERMISSION, ADS_MANAGE_PERMISSION],
    delete: [MASTER_DATA_DELETE_PERMISSION, ADS_MANAGE_PERMISSION],
  },
  roles: {
    table: "roles",
    read: ["role_permissions.view", "users.view", MASTER_DATA_VIEW_PERMISSION, "payroll.view"],
    create: [MASTER_DATA_CREATE_PERMISSION],
    edit: [MASTER_DATA_EDIT_PERMISSION],
    delete: [MASTER_DATA_DELETE_PERMISSION],
  },
  profiles: {
    table: "profiles",
    read: USER_REFERENCE_READ_PERMISSIONS,
    edit: ["users.edit"],
    delete: ["users.delete"],
    filterableColumns: ["id", "email", "role", "status", "branch_id"],
  },
  affiliates: {
    table: "affiliates",
    read: ["affiliate.view", "affiliate.manage", "order.view", "order.create", "leads.view", MASTER_DATA_VIEW_PERMISSION],
    create: ["affiliate.manage", MASTER_DATA_CREATE_PERMISSION],
    edit: ["affiliate.manage", MASTER_DATA_EDIT_PERMISSION],
    delete: ["affiliate.manage", MASTER_DATA_DELETE_PERMISSION],
  },
  vendors: {
    table: "vendors",
    read: ["finance.view", "finance.manage", "debts.view", OPERATIONAL_EXPENSE_VIEW_PERMISSION, MASTER_DATA_VIEW_PERMISSION],
    create: [MASTER_DATA_CREATE_PERMISSION, "finance.manage"],
    edit: [MASTER_DATA_EDIT_PERMISSION, "finance.manage"],
    delete: [MASTER_DATA_DELETE_PERMISSION, "finance.manage"],
  },
  leads: {
    table: "leads",
    read: ["leads.view"],
    create: ["leads.create"],
    edit: ["leads.edit"],
    delete: ["leads.delete"],
    orderBy: "created_at",
    ascending: false,
    filterableColumns: ["created_at", "status", "cs_id", "advertiser_id", "platform_id", "ad_account_id"],
  },
  prospect_labels: {
    table: "prospect_labels",
    read: ["leads.view", MASTER_DATA_VIEW_PERMISSION],
    create: ["leads.edit", MASTER_DATA_CREATE_PERMISSION],
    edit: ["leads.edit", MASTER_DATA_EDIT_PERMISSION],
    delete: ["leads.delete", MASTER_DATA_DELETE_PERMISSION],
    orderBy: "sort_order",
    ascending: true,
    filterableColumns: ["status", "slug"],
  },
  prospect_bookings: {
    table: "prospect_bookings",
    read: ["leads.view", "schedule.view", "order.view"],
    create: ["leads.create", "leads.edit"],
    edit: ["leads.edit", "order.edit"],
    delete: ["leads.delete"],
    orderBy: "schedule_date",
    ascending: false,
    filterableColumns: ["schedule_date", "status", "cs_id", "technician_id", "advertiser_id", "platform_id", "branch_id"],
  },
  orders: {
    table: "orders",
    read: ORDER_READ_PERMISSIONS,
    create: ["order.create"],
    edit: ["order.edit", "order.status.edit", "order.payment.edit_status", "order.payment.edit_type", "order.assign_technician"],
    delete: ["order.delete"],
    orderBy: "created_at",
    filterableColumns: ["service_date", "lead_date", "created_at", "status", "cs_id", "technician_id", "advertiser_id", "platform_id", "sub_channel_id", "ad_account_id", "branch_id"],
  },
  wa_templates: {
    table: "wa_templates",
    read: ["wa_template.view", "whatsapp.templates.manage", "leads.view", "order.view"],
    create: ["wa_template.create", "whatsapp.templates.manage"],
    edit: ["wa_template.edit", "whatsapp.templates.manage"],
    delete: ["wa_template.delete", "whatsapp.templates.manage"],
  },
  daily_ads: {
    table: "daily_ads",
    read: ["ads.view_daily", MARKETING_MONITORING_VIEW_PERMISSION, CS_OKR_VIEW_PERMISSION, "dashboard.view_advertiser", "dashboard.view_cs"],
    create: [ADS_MANAGE_PERMISSION],
    edit: [ADS_MANAGE_PERMISSION],
    delete: [ADS_MANAGE_PERMISSION],
    orderBy: "date",
    ascending: false,
    maxLimit: 1000,
    filterableColumns: ["date", "advertiser_id", "platform_id", "sub_channel_id", "ad_account_id", "cs_id"],
  },
  lead_spam_daily_inputs: {
    table: "lead_spam_daily_inputs",
    read: [MARKETING_MONITORING_VIEW_PERMISSION, CS_OKR_VIEW_PERMISSION, "dashboard.view_advertiser", "dashboard.view_cs"],
    create: ["leads.edit", CS_OKR_MANAGE_PERMISSION, ADS_MANAGE_PERMISSION],
    edit: ["leads.edit", CS_OKR_MANAGE_PERMISSION, ADS_MANAGE_PERMISSION],
    delete: ["leads.edit", CS_OKR_MANAGE_PERMISSION, ADS_MANAGE_PERMISSION],
    orderBy: "input_date",
    ascending: false,
    maxLimit: 1000,
    filterableColumns: ["input_date", "cs_id", "platform_id", "advertiser_id"],
  },
  proof_assets: {
    table: "proof_assets",
    read: ["proof_assets.view"],
    create: ["proof_assets.create"],
    edit: ["proof_assets.edit"],
    delete: ["proof_assets.delete"],
    orderBy: "created_at",
    ascending: false,
    maxLimit: 500,
    filterableColumns: ["vehicle_type_id", "is_active", "created_at"],
  },
  technician_schedules: {
    table: "technician_schedules",
    read: ["technician_schedule.view", "technician_schedule.manage", "schedule.view", "order.view", "teknisi.view_mobile"],
    create: ["technician_schedule.manage"],
    edit: ["technician_schedule.manage"],
    delete: ["technician_schedule.manage"],
    orderBy: "date",
    ascending: false,
    maxLimit: 1000,
    filterableColumns: ["date", "user_id", "type"],
  },
  audit_logs: {
    table: "audit_logs",
    read: ["audit_logs.view"],
    orderBy: "created_at",
    ascending: false,
    maxLimit: 5000,
    filterableColumns: ["created_at", "action", "entity", "user_name"],
  },
};
