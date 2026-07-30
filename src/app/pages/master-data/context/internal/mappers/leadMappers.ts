import { Lead } from '../../../data';
import { LeadSocialFields, normalizeLeadSocialFields } from '../../../../leads/socialContact';

export const LEAD_SOCIAL_MASTER_TYPE = 'lead_social_contacts';

export const pickLeadSocialFields = (lead: Partial<Lead>): LeadSocialFields => normalizeLeadSocialFields({
  socialPlatform: lead.socialPlatform,
  socialUsername: lead.socialUsername,
  socialProfileUrl: lead.socialProfileUrl,
  socialChatUrl: lead.socialChatUrl,
});

export const hasLeadSocialData = (lead: Partial<Lead>) => {
  const social = pickLeadSocialFields(lead);
  return Boolean(
    social.socialPlatform ||
    social.socialUsername ||
    social.socialProfileUrl ||
    social.socialChatUrl,
  );
};

export const mergeLeadSocialFields = (lead: Lead, social?: LeadSocialFields): Lead => ({
  ...lead,
  ...(social || {}),
});

export const stripLeadSocialFields = (lead: Lead): Lead => ({
  ...lead,
  socialPlatform: undefined,
  socialUsername: undefined,
  socialProfileUrl: undefined,
  socialChatUrl: undefined,
});

export const mapLeadSocialFromMaster = (item: any): LeadSocialFields => pickLeadSocialFields(item || {});

export const isLeadSocialSchemaError = (error: any) => {
  const text = [
    error?.message,
    error?.details,
    error?.hint,
    error?.error_description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return ['social_platform', 'social_username', 'social_profile_url', 'social_chat_url']
    .some((column) => text.includes(column));
};

export const mapLeadFromDB = (lead: any, social?: LeadSocialFields): Lead => mergeLeadSocialFields({
  id: lead.id,
  name: lead.name,
  phone: lead.phone,
  status: lead.status,
  notes: lead.notes,
  platformId: lead.platform_id,
  subChannelId: lead.sub_channel_id,
  advertiserId: lead.advertiser_id,
  csId: lead.cs_id,
  vehicleId: lead.vehicle_id,
  serviceId: lead.service_id,
  affiliateId: lead.affiliate_id,
  lastContact: lead.last_contact,
  timestamp: lead.created_at,
  templateHistory: lead.template_history || [],
  socialPlatform: lead.social_platform,
  socialUsername: lead.social_username,
  socialProfileUrl: lead.social_profile_url,
  socialChatUrl: lead.social_chat_url,
  embedFormId: lead.embed_form_id,
  embedFormSubmissionId: lead.embed_form_submission_id,
  embedFormSlug: lead.embed_form_slug,
  embedFormName: lead.embed_form_name,
  origin: lead.origin,
  landingPageUrl: lead.landing_page_url,
  utmSource: lead.utm_source,
  utmMedium: lead.utm_medium,
  utmCampaign: lead.utm_campaign,
  utmTerm: lead.utm_term,
  utmContent: lead.utm_content,
}, social);

export const mapLeadToDB = (lead: Lead) => ({
  id: lead.id,
  name: lead.name,
  phone: lead.phone,
  status: lead.status,
  notes: lead.notes,
  platform_id: lead.platformId,
  sub_channel_id: lead.subChannelId,
  advertiser_id: lead.advertiserId,
  cs_id: lead.csId,
  vehicle_id: lead.vehicleId,
  service_id: lead.serviceId,
  affiliate_id: lead.affiliateId,
  last_contact: lead.lastContact,
  template_history: lead.templateHistory,
  social_platform: lead.socialPlatform,
  social_username: lead.socialUsername,
  social_profile_url: lead.socialProfileUrl,
  social_chat_url: lead.socialChatUrl,
  embed_form_id: lead.embedFormId,
  embed_form_submission_id: lead.embedFormSubmissionId,
  embed_form_slug: lead.embedFormSlug,
  embed_form_name: lead.embedFormName,
  origin: lead.origin,
  landing_page_url: lead.landingPageUrl,
  utm_source: lead.utmSource,
  utm_medium: lead.utmMedium,
  utm_campaign: lead.utmCampaign,
  utm_term: lead.utmTerm,
  utm_content: lead.utmContent,
});
