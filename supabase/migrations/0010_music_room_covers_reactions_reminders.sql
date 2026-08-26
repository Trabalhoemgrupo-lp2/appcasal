-- appCasal Web — personalização e lembretes da Sala Spotify.
-- Execute depois de 0009_couple_music_rooms.sql.
-- Este esquema armazena somente escolhas do casal: nunca senhas, tokens Spotify,
-- dados de rede, identificadores de dispositivos ou histórico de reprodução.

alter table public.couple_music_rooms
  add column if not exists cover_path text
    check (cover_path is null or char_length(cover_path) between 1 and 600),
  add column if not exists listen_at timestamptz,
  add column if not exists reminder_note text
    check (reminder_note is null or char_length(btrim(reminder_note)) between 1 and 240),
  add column if not exists reminder_created_by uuid references public.profiles(id) on delete set null,
  add column if not exists reminder_sent_at timestamptz;

create table if not exists public.couple_music_reactions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  queue_item_id uuid not null references public.couple_music_queue(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '🥹', '✨', '🫶', '🔥', '🎶')),
  created_at timestamptz not null default now(),
  unique (queue_item_id, user_id, emoji)
);

create index if not exists couple_music_reactions_queue_idx
  on public.couple_music_reactions (queue_item_id, created_at asc);

create index if not exists couple_music_rooms_listen_at_idx
  on public.couple_music_rooms (listen_at)
  where listen_at is not null and reminder_sent_at is null;

create or replace function public.can_access_music_room_cover(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_couple_id uuid;
begin
  target_couple_id := split_part(object_name, '/', 1)::uuid;
  return exists (
    select 1 from public.couple_members
    where couple_id = target_couple_id and user_id = auth.uid()
  );
exception
  when invalid_text_representation then return false;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'music-room-covers',
  'music-room-covers',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists music_room_covers_select_member on storage.objects;
create policy music_room_covers_select_member
on storage.objects for select to authenticated
using (bucket_id = 'music-room-covers' and public.can_access_music_room_cover(name));

drop policy if exists music_room_covers_insert_member on storage.objects;
create policy music_room_covers_insert_member
on storage.objects for insert to authenticated
with check (
  bucket_id = 'music-room-covers'
  and owner_id = auth.uid()::text
  and public.can_access_music_room_cover(name)
);

drop policy if exists music_room_covers_delete_member on storage.objects;
create policy music_room_covers_delete_member
on storage.objects for delete to authenticated
using (
  bucket_id = 'music-room-covers'
  and owner_id = auth.uid()::text
  and public.can_access_music_room_cover(name)
);

alter table public.couple_music_reactions enable row level security;

drop policy if exists couple_music_reactions_select_member on public.couple_music_reactions;
create policy couple_music_reactions_select_member
on public.couple_music_reactions for select to authenticated
using (exists (
  select 1 from public.couple_members
  where couple_id = couple_music_reactions.couple_id and user_id = auth.uid()
));

drop policy if exists couple_music_reactions_insert_member on public.couple_music_reactions;
create policy couple_music_reactions_insert_member
on public.couple_music_reactions for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.couple_members
    where couple_id = couple_music_reactions.couple_id and user_id = auth.uid()
  )
  and exists (
    select 1 from public.couple_music_queue
    where id = couple_music_reactions.queue_item_id
      and couple_id = couple_music_reactions.couple_id
  )
);

drop policy if exists couple_music_reactions_delete_owner on public.couple_music_reactions;
create policy couple_music_reactions_delete_owner
on public.couple_music_reactions for delete to authenticated
using (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1 from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime' and c.relname = 'couple_music_reactions'
  ) then
    execute 'alter publication supabase_realtime add table public.couple_music_reactions';
  end if;
end;
$$;
