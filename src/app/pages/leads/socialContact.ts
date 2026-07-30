import type { LeadSocialPlatform } from '../master-data/data';

export interface LeadSocialFields {
  socialPlatform?: LeadSocialPlatform;
  socialUsername?: string;
  socialProfileUrl?: string;
  socialChatUrl?: string;
}

export const LEAD_SOCIAL_PLATFORM_OPTIONS: Array<{
  value: LeadSocialPlatform;
  label: string;
}> = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
];

const PLATFORM_LABELS: Record<LeadSocialPlatform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
};

const normalizeUrl = (value?: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed.replace(/^\/+/, '')}`;
};

export const getLeadSocialPlatformLabel = (platform?: string) => {
  if (!platform) return '';
  return PLATFORM_LABELS[platform as LeadSocialPlatform] || platform;
};

export const normalizeSocialUsername = (value?: string) => {
  const rawValue = value?.trim();
  if (!rawValue) return '';

  let normalized = rawValue;

  try {
    if (/^https?:\/\//i.test(rawValue)) {
      const url = new URL(rawValue);
      const segments = url.pathname.split('/').filter(Boolean);
      normalized = segments[segments.length - 1] || '';
    }
  } catch {
    normalized = rawValue;
  }

  normalized = normalized
    .replace(/^www\./i, '')
    .replace(/^instagram\.com\//i, '')
    .replace(/^tiktok\.com\//i, '')
    .replace(/^@/, '')
    .split(/[?#]/)[0]
    .split('/')
    .filter(Boolean)
    .pop() || normalized;

  return normalized.replace(/^@/, '').trim();
};

export const formatLeadSocialHandle = (socialUsername?: string) => {
  const normalized = normalizeSocialUsername(socialUsername);
  return normalized ? `@${normalized}` : '';
};

export const buildLeadSocialProfileUrl = (
  socialPlatform?: string,
  socialUsername?: string,
) => {
  const username = normalizeSocialUsername(socialUsername);
  if (!socialPlatform || !username) return undefined;

  if (socialPlatform === 'instagram') {
    return `https://www.instagram.com/${username}`;
  }

  if (socialPlatform === 'tiktok') {
    return `https://www.tiktok.com/@${username}`;
  }

  return undefined;
};

export const resolveLeadSocialProfileUrl = ({
  socialPlatform,
  socialUsername,
  socialProfileUrl,
}: LeadSocialFields) => {
  return normalizeUrl(socialProfileUrl) || buildLeadSocialProfileUrl(socialPlatform, socialUsername);
};

export const resolveLeadSocialPrimaryUrl = ({
  socialPlatform,
  socialUsername,
  socialProfileUrl,
  socialChatUrl,
}: LeadSocialFields) => {
  return normalizeUrl(socialChatUrl) || resolveLeadSocialProfileUrl({
    socialPlatform,
    socialUsername,
    socialProfileUrl,
  });
};

export const getLeadSocialPrimaryActionLabel = (lead: LeadSocialFields) => {
  return normalizeUrl(lead.socialChatUrl) ? 'Buka Chat' : 'Buka Profil';
};

export const normalizeLeadSocialFields = <T extends LeadSocialFields>(lead: T) => {
  const normalizedPlatform =
    lead.socialPlatform === 'instagram' || lead.socialPlatform === 'tiktok'
      ? lead.socialPlatform
      : undefined;

  const normalizedUsername = normalizeSocialUsername(lead.socialUsername);

  return {
    socialPlatform: normalizedPlatform,
    socialUsername: normalizedUsername || undefined,
    socialProfileUrl: normalizeUrl(lead.socialProfileUrl),
    socialChatUrl: normalizeUrl(lead.socialChatUrl),
  };
};
