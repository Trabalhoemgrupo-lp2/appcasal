-- appCasal Web — preferências individuais para lembretes de proximidade.
-- Execute depois de 0001_appcasal.sql a 0007_map_places_categories_and_avatars.sql.
-- Esta tabela não armazena passagens, trajetos ou o histórico de alertas.

create table if not exists public.place_proximity_preferences (
  place_id uuid not null references public.favorite_places(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_enabled boolean not null default false,
  radius_meters integer not null default 150 check (radius_meters between 100 and 1000),
  custom_message text check (custom_message is null or char_length(btrim(custom_message)) between 1 and 280),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (place_id, user_id)
);

create index if not exists place_proximity_preferences_user_enabled_idx
  on public.place_proximity_preferences (user_id, is_enabled, updated_at desc);

create or replace function public.touch_place_proximity_preference()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_place_proximity_preference_touch on public.place_proximity_preferences;
create trigger on_place_proximity_preference_touch
before update on public.place_proximity_preferences
for each row execute procedure public.touch_place_proximity_preference();

alter table public.place_proximity_preferences enable row level security;

drop policy if exists place_proximity_preferences_select_owner on public.place_proximity_preferences;
create policy place_proximity_preferences_select_owner
on public.place_proximity_preferences for select
to authenticated
using (user_id = auth.uid());

drop policy if exists place_proximity_preferences_insert_owner on public.place_proximity_preferences;
create policy place_proximity_preferences_insert_owner
on public.place_proximity_preferences for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.favorite_places place
    join public.couple_members member on member.couple_id = place.couple_id
    where place.id = place_proximity_preferences.place_id
      and member.user_id = auth.uid()
  )
);

drop policy if exists place_proximity_preferences_update_owner on public.place_proximity_preferences;
create policy place_proximity_preferences_update_owner
on public.place_proximity_preferences for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.favorite_places place
    join public.couple_members member on member.couple_id = place.couple_id
    where place.id = place_proximity_preferences.place_id
      and member.user_id = auth.uid()
  )
);

drop policy if exists place_proximity_preferences_delete_owner on public.place_proximity_preferences;
create policy place_proximity_preferences_delete_owner
on public.place_proximity_preferences for delete
to authenticated
using (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime'
      and c.relname = 'place_proximity_preferences'
  ) then
    execute 'alter publication supabase_realtime add table public.place_proximity_preferences';
  end if;
end;
$$;
