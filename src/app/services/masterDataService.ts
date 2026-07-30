import { toast } from 'sonner';
import { buildMakeServerUrl } from './internal/functionsBaseUrl';
import { getSessionBackedEdgeHeaders } from './internal/sessionClientHeaders';

const BASE_URL = buildMakeServerUrl();

// Map tab IDs to database prefixes
const TYPE_MAP: Record<string, string> = {
  branches: 'branch',
  areas: 'area',
  services: 'service',
  vehicles: 'vehicle',
  platforms: 'platform',
  ad_accounts: 'ad_account',
  sources: 'source',
  payments: 'payment',
  teams: 'team',
  staff_status: 'staff_status',
  employment: 'employment',
  banks: 'bank'
};

type MasterDataTabId = keyof typeof TYPE_MAP;

export const masterDataService = {
  async getAll<T = unknown>(tabId: MasterDataTabId): Promise<T[]> {
    const type = TYPE_MAP[tabId];
    if (!type) throw new Error(`Unknown type for tab: ${tabId}`);

    try {
      const response = await fetch(`${BASE_URL}/master/${type}`, {
        headers: await getSessionBackedEdgeHeaders(),
      });
      
      if (!response.ok) throw new Error('Failed to fetch data');
      return await response.json() as T[];
    } catch (error) {
      console.error('Error fetching master data:', error);
      toast.error('Gagal mengambil data dari server');
      return [];
    }
  },

  async save<T = unknown>(tabId: MasterDataTabId, data: unknown): Promise<T> {
    const type = TYPE_MAP[tabId];
    if (!type) throw new Error(`Unknown type for tab: ${tabId}`);

    try {
      const response = await fetch(`${BASE_URL}/master/${type}`, {
        method: 'POST',
        headers: await getSessionBackedEdgeHeaders({ includeJsonContentType: true }),
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Failed to save data');
      return await response.json() as T;
    } catch (error) {
      console.error('Error saving master data:', error);
      toast.error('Gagal menyimpan data ke server');
      throw error;
    }
  },

  async delete(tabId: MasterDataTabId, id: string) {
    const type = TYPE_MAP[tabId];
    if (!type) throw new Error(`Unknown type for tab: ${tabId}`);

    try {
      const response = await fetch(`${BASE_URL}/master/${type}/${id}`, {
        method: 'DELETE',
        headers: await getSessionBackedEdgeHeaders(),
      });

      if (!response.ok) throw new Error('Failed to delete data');
      return true;
    } catch (error) {
      console.error('Error deleting master data:', error);
      toast.error('Gagal menghapus data dari server');
      throw error;
    }
  },

  // Batch import for seeding
  async seed(tabId: MasterDataTabId, items: unknown[]) {
    const type = TYPE_MAP[tabId];
    if (!type) return;

    // Sequential to avoid overwhelming
    for (const item of items) {
      await this.save(tabId, item);
    }
  }
};
