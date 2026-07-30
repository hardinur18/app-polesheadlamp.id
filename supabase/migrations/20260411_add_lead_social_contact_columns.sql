alter table if exists public.leads
  add column if not exists social_platform text,
  add column if not exists social_username text,
  add column if not exists social_profile_url text,
  add column if not exists social_chat_url text;

comment on column public.leads.social_platform is 'Primary social platform for the lead contact, for example instagram or tiktok.';
comment on column public.leads.social_username is 'Normalized social media username used for quick access from Prospek.';
comment on column public.leads.social_profile_url is 'Explicit profile URL for the lead social account.';
comment on column public.leads.social_chat_url is 'Optional direct chat room URL for the lead social account.';
