create or replace function public.increment_proof_asset_usage(p_asset_id text)
returns public.proof_assets
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_asset public.proof_assets;
begin
  update public.proof_assets
  set usage_count = usage_count + 1
  where id = p_asset_id
  returning * into updated_asset;

  if updated_asset.id is null then
    raise exception 'Proof asset not found' using errcode = 'P0002';
  end if;

  return updated_asset;
end;
$$;

grant execute on function public.increment_proof_asset_usage(text) to authenticated, service_role;
