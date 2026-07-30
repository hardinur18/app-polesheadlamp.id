const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, '') || '';
const envProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID?.trim() || '';
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

const projectIdFromUrl = envSupabaseUrl.match(/^https:\/\/([^.]+)\.supabase\.co$/)?.[1] || '';

export const projectId = envProjectId || projectIdFromUrl;
export const supabaseUrl = envSupabaseUrl || (projectId ? `https://${projectId}.supabase.co` : '');
export const publicAnonKey = envAnonKey;
export const isSupabaseConfigured = Boolean(supabaseUrl && publicAnonKey);
export const supabaseConfigErrorMessage =
  'Konfigurasi Supabase belum lengkap. Isi VITE_SUPABASE_URL atau VITE_SUPABASE_PROJECT_ID, serta VITE_SUPABASE_ANON_KEY di .env sebelum menjalankan app v2.';
