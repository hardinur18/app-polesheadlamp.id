do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vehicle_types_name_not_chat_like'
  ) then
    alter table public.vehicle_types
      add constraint vehicle_types_name_not_chat_like
      check (
        length(btrim(coalesce(name, ''))) between 1 and 80
        and lower(coalesce(name, '')) !~ '\m(apa|berapa|belum|bengkel|bisa|dekat|gagang|headlamp|kak|kena|kmrn|kusam|kusem|mau|nyala|ortu|pagar|pas|poles|repair|rumah|saya|sedang|soalnya|tp|yang)\M.*\m(apa|berapa|belum|bengkel|bisa|dekat|gagang|headlamp|kak|kena|kmrn|kusam|kusem|mau|nyala|ortu|pagar|pas|poles|repair|rumah|saya|sedang|soalnya|tp|yang)\M'
      ) not valid;
  end if;
end $$;

comment on constraint vehicle_types_name_not_chat_like on public.vehicle_types is
  'Blocks new vehicle type names that look like leaked customer chat text. Existing rows are intentionally not validated until cleaned.';
