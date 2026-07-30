import type { Lead } from '../../data';
import type { LeadSocialFields } from '../../../leads/socialContact';
import {
  mapLeadSocialFromMaster,
  pickLeadSocialFields,
} from './mappers/leadMappers';
import { buildMakeServerUrl } from '@/app/services/internal/functionsBaseUrl';
import { getSessionBackedEdgeHeaders } from '@/app/services/internal/sessionClientHeaders';

type LeadSocialAdapterConfig = {
  masterType: string;
};

const buildLeadSocialUrl = (
  config: LeadSocialAdapterConfig,
  leadId?: string,
) => {
  const baseUrl = buildMakeServerUrl(`/master/${config.masterType}`);
  return leadId ? `${baseUrl}/${leadId}` : baseUrl;
};

export const fetchLeadSocialContactMap = async (
  config: LeadSocialAdapterConfig,
): Promise<Record<string, LeadSocialFields>> => {
  const response = await fetch(buildLeadSocialUrl(config), {
    headers: await getSessionBackedEdgeHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch lead social contacts (${response.status})`);
  }

  const data = await response.json();
  return Array.isArray(data)
    ? Object.fromEntries(
        data
          .filter((item: any) => item?.id)
          .map((item: any) => [item.id, mapLeadSocialFromMaster(item)]),
      )
    : {};
};

export const upsertLeadSocialContactRecord = async (
  config: LeadSocialAdapterConfig,
  lead: Lead,
): Promise<LeadSocialFields> => {
  const response = await fetch(buildLeadSocialUrl(config), {
    method: 'POST',
    headers: await getSessionBackedEdgeHeaders({ includeJsonContentType: true }),
    body: JSON.stringify({
      id: lead.id,
      ...pickLeadSocialFields(lead),
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to save lead social contact');
  }

  return mapLeadSocialFromMaster(await response.json());
};

export const deleteLeadSocialContactRecord = async (
  config: LeadSocialAdapterConfig,
  leadId: string,
): Promise<void> => {
  const response = await fetch(buildLeadSocialUrl(config, leadId), {
    method: 'DELETE',
    headers: await getSessionBackedEdgeHeaders(),
  });

  if (!response.ok && response.status !== 404) {
    const message = await response.text();
    throw new Error(message || 'Failed to delete lead social contact');
  }
};
