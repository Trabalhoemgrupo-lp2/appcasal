-- appCasal Web — avisos de localização e lugares afetivos compartilhados.
-- Execute depois de 0001_appcasal.sql a 0005_couple_locations.sql.

alter table public.notifications
  drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('plan_created', 'location_started', 'location_paused'));

create or replace function public.notify_partner_of_location_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  notification_kind text;
  notification_title text;
  notification_body text;
begin
  if tg_op = 'INSERT' and not new.sharing_enabled then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.sharing_enabled is not distinct from old.sharing_enabled then
    return new;
  end if;

  select name into actor_name from public.profiles where id = new.user_id;

  if new.sharing_enabled then
    notification_kind := 'location_started';
    notification_title := coalesce(actor_name, 'Seu parceiro') || ' compartilhou a localização';
    notification_body := 'Você pode ver a posição atual no mapa afetivo.';
  else
    notification_kind := 'location_paused';
    notification_title := coalesce(actor_name, 'Seu parceiro') || ' pausou a localização';
    notification_body := 'A posição atual foi removida do espaço de vocês.';
  end if;

  insert into public.notifications (couple_id, recipient_id, actor_id, kind, title, body)
  select new.couple_id, member.user_id, new.user_id, notification_kind, notification_title, notification_body
  from public.couple_members member
  where member.couple_id = new.couple_id
    and member.user_id <> new.user_id;

  return new;
end;
$$;

drop trigger if exists on_couple_location_change_notify_partner on public.couple_locations;
create trigger on_couple_location_change_notify_partner
after insert or update of sharing_enabled on public.couple_locations
for each row execute procedure public.notify_partner_of_location_change();

create table if not exists public.favorite_places (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  meaning text not null default '' check (char_length(meaning) <= 500),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists favorite_places_couple_created_idx
  on public.favorite_places (couple_id, created_at desc);

create or replace function public.touch_favorite_place()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_favorite_place_updated on public.favorite_places;
create trigger on_favorite_place_updated
before update on public.favorite_places
for each row execute procedure public.touch_favorite_place();

grant select, insert, update, delete on public.favorite_places to authenticated;

alter table public.favorite_places enable row level security;

drop policy if exists favorite_places_select_member on public.favorite_places;
create policy favorite_places_select_member
on public.favorite_places for select
to authenticated
using (public.is_couple_member(couple_id));

drop policy if exists favorite_places_insert_member on public.favorite_places;
create policy favorite_places_insert_member
on public.favorite_places for insert
to authenticated
with check (created_by = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists favorite_places_update_member on public.favorite_places;
create policy favorite_places_update_member
on public.favorite_places for update
to authenticated
using (public.is_couple_member(couple_id))
with check (public.is_couple_member(couple_id));

drop policy if exists favorite_places_delete_member on public.favorite_places;
create policy favorite_places_delete_member
on public.favorite_places for delete
to authenticated
using (public.is_couple_member(couple_id));

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime'
      and c.relname = 'favorite_places'
  ) then
    execute 'alter publication supabase_realtime add table public.favorite_places';
  end if;
end;
$$;
