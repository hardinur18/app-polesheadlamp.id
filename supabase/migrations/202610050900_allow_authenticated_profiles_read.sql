-- Ensure every signed-in app user can resolve staff profiles during login/bootstrap.
-- Owner/Admin can fall back through app-data, but regular roles may not have users.view.
-- This keeps anonymous access closed while allowing authenticated app sessions to load profiles.
do $$
begin
  if to_regclass('public.profiles') is not null then
    revoke all on public.profiles from anon;
    grant select on public.profiles to authenticated, service_role;

    drop policy if exists "Authenticated read profiles" on public.profiles;
    create policy "Authenticated read profiles"
      on public.profiles
      for select
      to authenticated
      using (true);
  end if;
end $$;
