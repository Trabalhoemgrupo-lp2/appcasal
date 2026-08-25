-- Execute depois de 0001_appcasal.sql a 0008_background_proximity_preferences.sql.
-- A sala registra somente metadados que o casal escolhe compartilhar: nunca tokens,
-- senhas Spotify, identificadores de dispositivos, endereços IP ou dados da rede Wi-Fi.

create table if not exists public.couple_music_rooms (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Nossa sala de música' check (char_length(btrim(title)) between 1 and 80),
  jam_url text check (jam_url is null or jam_url ~ '^https://(open\\.spotify\\.com|spotify\\.link)/'),
  is_active boolean not null default true,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.couple_music_queue (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  added_by uuid not null references public.profiles(id) on delete cascade,
  track_url text not null check (track_url ~ '^https://(open\\.spotify\\.com|spotify\\.link)/'),
  track_title text not null check (char_length(btrim(track_title)) between 1 and 140),
  artist_name text check (artist_name is null or char_length(btrim(artist_name)) between 1 and 140),
  note text check (note is null or char_length(btrim(note)) between 1 and 240),
  created_at timestamptz not null default now()
);

create index if not exists couple_music_queue_couple_created_idx
  on public.couple_music_queue (couple_id, created_at asc);

create or replace function public.touch_couple_music_room()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.host_id is distinct from old.host_id then
    raise exception 'O anfitrião original da sala não pode ser alterado';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_couple_music_room_touch on public.couple_music_rooms;
create trigger on_couple_music_room_touch
before update on public.couple_music_rooms
for each row execute procedure public.touch_couple_music_room();

alter table public.couple_music_rooms enable row level security;
alter table public.couple_music_queue enable row level security;

drop policy if exists couple_music_rooms_select_member on public.couple_music_rooms;
create policy couple_music_rooms_select_member
on public.couple_music_rooms for select
to authenticated
using (exists (select 1 from public.couple_members where couple_id = couple_music_rooms.couple_id and user_id = auth.uid()));

drop policy if exists couple_music_rooms_insert_member on public.couple_music_rooms;
create policy couple_music_rooms_insert_member
on public.couple_music_rooms for insert
to authenticated
with check (
  host_id = auth.uid()
  and exists (select 1 from public.couple_members where couple_id = couple_music_rooms.couple_id and user_id = auth.uid())
);

drop policy if exists couple_music_rooms_update_member on public.couple_music_rooms;
create policy couple_music_rooms_update_member
on public.couple_music_rooms for update
to authenticated
using (exists (select 1 from public.couple_members where couple_id = couple_music_rooms.couple_id and user_id = auth.uid()))
with check (
  exists (select 1 from public.couple_members where couple_id = couple_music_rooms.couple_id and user_id = auth.uid())
);

drop policy if exists couple_music_queue_select_member on public.couple_music_queue;
create policy couple_music_queue_select_member
on public.couple_music_queue for select
to authenticated
using (exists (select 1 from public.couple_members where couple_id = couple_music_queue.couple_id and user_id = auth.uid()));

drop policy if exists couple_music_queue_insert_member on public.couple_music_queue;
create policy couple_music_queue_insert_member
on public.couple_music_queue for insert
to authenticated
with check (
  added_by = auth.uid()
  and exists (select 1 from public.couple_members where couple_id = couple_music_queue.couple_id and user_id = auth.uid())
);

drop policy if exists couple_music_queue_delete_member on public.couple_music_queue;
create policy couple_music_queue_delete_member
on public.couple_music_queue for delete
to authenticated
using (exists (select 1 from public.couple_members where couple_id = couple_music_queue.couple_id and user_id = auth.uid()));

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime'
      and c.relname = 'couple_music_rooms'
  ) then
    execute 'alter publication supabase_realtime add table public.couple_music_rooms';
  end if;
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime'
      and c.relname = 'couple_music_queue'
  ) then
    execute 'alter publication supabase_realtime add table public.couple_music_queue';
  end if;
end;
$$;
