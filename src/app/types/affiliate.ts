export interface Affiliate {
  id: string;
  nama_lengkap: string;
  no_whatsapp: string;
  status: 'Active' | 'Inactive';
  profesi: string;
  komisi: number;
  total_komisi: number;
  social_media?: string; // New field
  created_at?: string;
}

/**
 * SQL Structure for Supabase:
 * 
 * create table public.affiliates (
 *   id text not null primary key, -- Using text ID (AF-XXXX) as per current logic, or UUID if preferred
 *   nama_lengkap text not null,
 *   no_whatsapp text not null,
 *   status text not null default 'Active',
 *   profesi text,
 *   komisi numeric default 0,
 *   total_komisi numeric default 0,
 *   social_media text,
 *   created_at timestamp with time zone default timezone('utc'::text, now()) not null
 * );
 * 
 * -- Enable RLS
 * alter table public.affiliates enable row level security;
 * 
 * -- Create policies (Open for demo purposes, restrict in production)
 * create policy "Enable read access for all users" on public.affiliates for select using (true);
 * create policy "Enable write access for authenticated users" on public.affiliates for all using (auth.role() = 'authenticated');
 */
