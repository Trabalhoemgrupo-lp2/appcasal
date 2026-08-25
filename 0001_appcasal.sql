-- appCasal Web — esquema-base para autenticação, casal, feed e chat.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now(),
  likes integer not null default 0 check (likes >= 0)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  sender_name text not null check (char_length(btrim(sender_name)) between 1 and 120),
  text text not null check (char_length(btrim(text)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists posts_couple_created_at_idx on public.posts (couple_id, created_at desc);
create index if not exists messages_couple_created_at_idx on public.messages (couple_id, created_at asc);

create or replace function public.is_couple_member(target_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.couple_members
    where couple_id = target_couple_id and user_id = auth.uid()
  );
$$;

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.create_couple_for_current_user()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_couple_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into public.couples default values returning id into new_couple_id;
  insert into public.couple_members (couple_id, user_id) values (new_couple_id, auth.uid());
  return new_couple_id;
end;
$$;

grant execute on function public.create_couple_for_current_user() to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.couples to authenticated;
grant select on public.couple_members to authenticated;
grant select, insert on public.posts to authenticated;
grant select, insert on public.messages to authenticated;

alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.posts enable row level security;
alter table public.messages enable row level security;

drop policy if exists profiles_select_couple_member on public.profiles;
create policy profiles_select_couple_member
on public.profiles for select to authenticated
using (
  id = auth.uid() or exists (
    select 1
    from public.couple_members viewer_members
    join public.couple_members target_members on target_members.couple_id = viewer_members.couple_id
    where viewer_members.user_id = auth.uid() and target_members.user_id = profiles.id
  )
);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists couples_select_member on public.couples;
create policy couples_select_member on public.couples for select to authenticated using (public.is_couple_member(id));
drop policy if exists couple_members_select_member on public.couple_members;
create policy couple_members_select_member on public.couple_members for select to authenticated using (public.is_couple_member(couple_id));
drop policy if exists posts_select_member on public.posts;
create policy posts_select_member on public.posts for select to authenticated using (public.is_couple_member(couple_id));
drop policy if exists posts_insert_member on public.posts;
create policy posts_insert_member on public.posts for insert to authenticated with check (author_id = auth.uid() and public.is_couple_member(couple_id));
drop policy if exists messages_select_member on public.messages;
create policy messages_select_member on public.messages for select to authenticated using (public.is_couple_member(couple_id));
drop policy if exists messages_insert_member on public.messages;
create policy messages_insert_member on public.messages for insert to authenticated with check (sender_id = auth.uid() and public.is_couple_member(couple_id));

do $$
begin
  if not exists (
    select 1 from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime' and c.relname = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end;
$$;
