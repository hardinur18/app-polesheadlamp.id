import { DailyAd, LeadSpamDailyInput, Notification, WATemplate } from '../../../data';

type TechnicianScheduleLike = {
  id: string;
  userId: string;
  date: string;
  type: 'Libur' | 'Sakit' | 'Cuti' | 'Izin';
  reason?: string;
  createdAt: string;
};

export const mapNotificationFromDB = (n: any): Notification => ({
  id: n.id,
  userId: n.user_id,
  title: n.title,
  message: n.message,
  isRead: n.is_read,
  type: n.type,
  relatedId: n.related_id,
  createdAt: n.created_at,
});

export const mapScheduleFromDB = (s: any): TechnicianScheduleLike => ({
  id: s.id,
  userId: s.user_id,
  date: s.date,
  type: s.type,
  reason: s.reason,
  createdAt: s.created_at,
});

export const mapScheduleToDB = (s: TechnicianScheduleLike) => ({
  user_id: s.userId,
  date: s.date,
  type: s.type,
  reason: s.reason,
});

export const mapWATemplateFromDB = (t: any): WATemplate => ({
  id: t.id,
  title: t.title,
  message: t.message,
  category: t.category,
  usage_count: t.usage_count || 0,
});

export const mapWATemplateToDB = (t: WATemplate) => ({
  id: t.id,
  title: t.title,
  message: t.message,
  category: t.category,
  usage_count: t.usage_count,
});

export const mapDailyAdFromDB = (a: any): DailyAd => ({
  id: a.id,
  date: a.date,
  advertiserId: a.advertiser_id,
  platformId: a.platform_id,
  subChannelId: a.sub_channel_id,
  adAccountId: a.ad_account_id,
  csId: a.cs_id,
  amountSpent: a.amount_spent,
  leadsDashboard: a.leads_dashboard,
  ppnAmount: a.ppn_amount,
  feeAmount: a.fee_amount,
  editCount: a.edit_count,
});

export const mapDailyAdToDB = (a: DailyAd) => ({
  id: a.id,
  date: a.date,
  advertiser_id: a.advertiserId,
  platform_id: a.platformId,
  sub_channel_id: a.subChannelId,
  ad_account_id: a.adAccountId,
  cs_id: a.csId,
  amount_spent: a.amountSpent,
  leads_dashboard: a.leadsDashboard,
  ppn_amount: a.ppnAmount,
  fee_amount: a.feeAmount,
});

export const mapLeadSpamDailyInputFromDB = (row: any): LeadSpamDailyInput => ({
  id: row.id,
  inputDate: row.input_date,
  csId: row.cs_id,
  platformId: row.platform_id,
  advertiserId: row.advertiser_id,
  spamCount: Number(row.spam_count) || 0,
  notes: row.notes || undefined,
  createdBy: row.created_by || undefined,
  updatedBy: row.updated_by || undefined,
  createdAt: row.created_at || undefined,
  updatedAt: row.updated_at || undefined,
});

export const mapLeadSpamDailyInputToDB = (row: LeadSpamDailyInput) => ({
  id: row.id,
  input_date: row.inputDate,
  cs_id: row.csId,
  platform_id: row.platformId,
  advertiser_id: row.advertiserId,
  spam_count: row.spamCount,
  notes: row.notes || null,
  created_by: row.createdBy || null,
  updated_by: row.updatedBy || null,
});
