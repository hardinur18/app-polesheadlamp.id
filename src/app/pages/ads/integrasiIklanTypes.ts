export type LeadSource = 'dashboard' | 'order-fallback' | 'order-share' | 'none';

export type UnifiedPerformanceRow = {
  uniqueId: string;
  source: 'meta-live' | 'google-live' | 'tiktok-live' | 'internal';
  platformId: string;
  platformName: string;
  businessGroupId: string;
  businessGroupName: string;
  adAccountId: string;
  accountName: string;
  advertiserId: string;
  advertiserName: string;
  spend: number;
  ppn: number;
  fee: number;
  burn: number;
  leads: number;
  cpl: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cpp: number | null;
  reach: number;
  impressions: number;
  currency?: string;
  liveLabel: string;
  liveError?: string | null;
  leadSource?: LeadSource;
  leadInputStatus?: 'ok' | 'missing-in-range' | 'never-input';
  lastLeadInputDate?: string | null;
  lastOrderFallbackDate?: string | null;
  dashboardLeadCount?: number;
  exactOrderLeadCount?: number;
  sharedOrderLeadCount?: number;
};

export type IntegrasiIklanSummary = {
  spend: number;
  ppn: number;
  fee: number;
  burn: number;
  leads: number;
  clicks: number;
  advertiserCount: number;
  accountCount: number;
  cpl: number;
};

export type IntegrasiIklanOption = {
  id: string;
  name: string;
};
