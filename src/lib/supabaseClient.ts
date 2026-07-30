import { createClient } from '@supabase/supabase-js';
import {
  isSupabaseConfigured,
  publicAnonKey,
  supabaseUrl,
} from '/utils/supabase/info';

// Inisialisasi Client
// Client ini akan digunakan di seluruh aplikasi untuk interaksi DB, Auth, dan Storage
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? publicAnonKey : 'missing-supabase-anon-key',
);
