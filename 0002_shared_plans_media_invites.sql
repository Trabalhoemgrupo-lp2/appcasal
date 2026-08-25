-- appCasal Web — calendário, fotos e convite de parceiro.
-- Execute esta migração depois de 0001_appcasal.sql no SQL Editor do Supabase.

alter table public.posts
  add column if not exists image_path text;

alter table public.posts
  drop constraint if exists posts_content_check;

alter table public.posts
  add constraint posts_content_or_image_check
  check (
    char_length(btrim(content)) between 0 and 2000
    and (char_length(btrim(content)) > 0 or image_path is not null)
  );

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  details text not null default '' check (char_length(details) <= 1200),
  scheduled_for date not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists plans_couple_scheduled_for_idx
  on public.plans (couple_id, scheduled_for asc);

create table if not exists public.partner_invites (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  code text not null unique default encode(gen_random_bytes(20), 'hex'),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'cancelled', 'expired')),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists partner_invites_one_pending_per_couple_idx
  on public.partner_invites (couple_id)
  where status = 'pending';

create index if not exists partner_invites_code_idx
  on public.partner_invites (code);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(new.raw_user_meta_data->>'display_name', ''),
      split_part(coalesce(new.email, 'Pessoa'), '@', 1)
    ),
    new.email
  )
  on conflict (id) do update
    set name = excluded.name,
        email = excluded.email;

  return new;
end;
$$;

create or replace function public.is_couple_media_path_allowed(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  path_couple_id uuid;
begin
  path_couple_id := split_part(object_name, '/', 1)::uuid;
  return public.is_couple_member(path_couple_id);
exception
  when invalid_text_representation then
    return false;
end;
$$;

create or replace function public.create_partner_invite()
returns table (invite_id uuid, invite_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  active_couple_id uuid;
  new_invite public.partner_invites;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select couple_id
    into active_couple_id
  from public.couple_members
  where user_id = auth.uid()
  limit 1;

  if active_couple_id is null then
    insert into public.couples default values
    returning id into active_couple_id;

    insert into public.couple_members (couple_id, user_id)
    values (active_couple_id, auth.uid());
  end if;

  if (select count(*) from public.couple_members where couple_id = active_couple_id) >= 2 then
    raise exception 'couple_is_already_complete';
  end if;

  update public.partner_invites
    set status = 'cancelled'
  where couple_id = active_couple_id
    and status = 'pending';

  insert into public.partner_invites (couple_id, invited_by)
  values (active_couple_id, auth.uid())
  returning * into new_invite;

  return query
  select new_invite.id, new_invite.code, new_invite.expires_at;
end;
$$;

create or replace function public.accept_partner_invite(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invite public.partner_invites;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select *
    into target_invite
  from public.partner_invites
  where code = lower(btrim(invite_code))
    and status = 'pending'
    and expires_at > now()
  for update;

  if target_invite.id is null then
    raise exception 'invite_not_found_or_expired';
  end if;

  if target_invite.invited_by = auth.uid() then
    raise exception 'cannot_accept_own_invite';
  end if;

  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'user_already_belongs_to_a_couple';
  end if;

  if (select count(*) from public.couple_members where couple_id = target_invite.couple_id) >= 2 then
    raise exception 'couple_is_already_complete';
  end if;

  insert into public.couple_members (couple_id, user_id)
  values (target_invite.couple_id, auth.uid());

  update public.partner_invites
    set status = 'accepted',
        accepted_by = auth.uid(),
        accepted_at = now()
  where id = target_invite.id;

  return target_invite.couple_id;
end;
$$;

grant select, insert, update, delete on public.plans to authenticated;
grant select on public.partner_invites to authenticated;
grant execute on function public.create_partner_invite() to authenticated;
grant execute on function public.accept_partner_invite(text) to authenticated;

alter table public.plans enable row level security;
alter table public.partner_invites enable row level security;

drop policy if exists plans_select_member on public.plans;
create policy plans_select_member
on public.plans for select
to authenticated
using (public.is_couple_member(couple_id));

drop policy if exists plans_insert_member on public.plans;
create policy plans_insert_member
on public.plans for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_couple_member(couple_id)
);

drop policy if exists plans_update_member on public.plans;
create policy plans_update_member
on public.plans for update
to authenticated
using (public.is_couple_member(couple_id))
with check (public.is_couple_member(couple_id));

drop policy if exists plans_delete_member on public.plans;
create policy plans_delete_member
on public.plans for delete
to authenticated
using (public.is_couple_member(couple_id));

drop policy if exists partner_invites_select_creator on public.partner_invites;
create policy partner_invites_select_creator
on public.partner_invites for select
to authenticated
using (invited_by = auth.uid());

drop policy if exists posts_insert_member on public.posts;
create policy posts_insert_member
on public.posts for insert
to authenticated
with check (
  author_id = auth.uid()
  and public.is_couple_member(couple_id)
  and (image_path is null or public.is_couple_media_path_allowed(image_path))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memory-photos',
  'memory-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists memory_photos_select_couple_member on storage.objects;
create policy memory_photos_select_couple_member
on storage.objects for select
to authenticated
using (
  bucket_id = 'memory-photos'
  and public.is_couple_media_path_allowed(name)
);

drop policy if exists memory_photos_insert_couple_member on storage.objects;
create policy memory_photos_insert_couple_member
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'memory-photos'
  and owner_id = (select auth.uid()::text)
  and public.is_couple_media_path_allowed(name)
);

drop policy if exists memory_photos_delete_owner on storage.objects;
create policy memory_photos_delete_owner
on storage.objects for delete
to authenticated
using (
  bucket_id = 'memory-photos'
  and owner_id = (select auth.uid()::text)
  and public.is_couple_media_path_allowed(name)
);

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array['plans', 'posts']
  loop
    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_class c on c.oid = pr.prrelid
      join pg_publication p on p.oid = pr.prpubid
      where p.pubname = 'supabase_realtime'
        and c.relname = relation_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', relation_name);
    end if;
  end loop;
end;
$$;
