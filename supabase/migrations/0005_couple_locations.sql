-- appCasal Web — localização atual, voluntária e restrita ao casal.
-- Execute depois de 0001_appcasal.sql a 0004_couple_rituals.sql.

create table if not exists public.couple_locations (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sharing_enabled boolean not null default false,
  latitude double precision,
  longitude double precision,
  accuracy_meters double precision,
  updated_at timestamptz not null default now(),
  primary key (couple_id, user_id),
  constraint couple_locations_latitude_check check (latitude is null or latitude between -90 and 90),
  constraint couple_locations_longitude_check check (longitude is null or longitude between -180 and 180),
  constraint couple_locations_accuracy_check check (accuracy_meters is null or accuracy_meters >= 0),
  constraint couple_locations_visibility_check check (
    (sharing_enabled and latitude is not null and longitude is not null)
    or (not sharing_enabled and latitude is null and longitude is null and accuracy_meters is null)
  )
);

create index if not exists couple_locations_couple_updated_idx
  on public.couple_locations (couple_id, updated_at desc);

create or replace function public.touch_couple_location()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_couple_location_updated on public.couple_locations;
create trigger on_couple_location_updated
before update on public.couple_locations
for each row execute procedure public.touch_couple_location();

grant select, insert, update, delete on public.couple_locations to authenticated;

alter table public.couple_locations enable row level security;

drop policy if exists couple_locations_select_member on public.couple_locations;
create policy couple_locations_select_member
on public.couple_locations for select
to authenticated
using (public.is_couple_member(couple_id));

drop policy if exists couple_locations_insert_self on public.couple_locations;
create policy couple_locations_insert_self
on public.couple_locations for insert
to authenticated
with check (user_id = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists couple_locations_update_self on public.couple_locations;
create policy couple_locations_update_self
on public.couple_locations for update
to authenticated
using (user_id = auth.uid() and public.is_couple_member(couple_id))
with check (user_id = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists couple_locations_delete_self on public.couple_locations;
create policy couple_locations_delete_self
on public.couple_locations for delete
to authenticated
using (user_id = auth.uid() and public.is_couple_member(couple_id));

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime'
      and c.relname = 'couple_locations'
  ) then
    execute 'alter publication supabase_realtime add table public.couple_locations';
  end if;
end;
$$;
