-- appCasal Web — categorias de lugares, autoria preservada e avatares privados.
-- Execute depois de 0001_appcasal.sql a 0006_location_alerts_and_places.sql.

alter table public.profiles
  add column if not exists avatar_path text
  check (avatar_path is null or char_length(avatar_path) between 1 and 600);

alter table public.favorite_places
  add column if not exists category text not null default 'favoritos'
  check (category in ('encontros', 'viagens', 'favoritos'));

create index if not exists favorite_places_couple_category_idx
  on public.favorite_places (couple_id, category, created_at desc);

create or replace function public.keep_favorite_place_creator()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.created_by = old.created_by;
  return new;
end;
$$;

drop trigger if exists on_favorite_place_keep_creator on public.favorite_places;
create trigger on_favorite_place_keep_creator
before update on public.favorite_places
for each row execute procedure public.keep_favorite_place_creator();

create or replace function public.can_access_profile_avatar(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  target_user_id := split_part(object_name, '/', 1)::uuid;

  return target_user_id = auth.uid()
    or exists (
      select 1
      from public.couple_members viewer_members
      join public.couple_members target_members
        on target_members.couple_id = viewer_members.couple_id
      where viewer_members.user_id = auth.uid()
        and target_members.user_id = target_user_id
    );
exception
  when invalid_text_representation then
    return false;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  false,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_avatars_select_couple on storage.objects;
create policy profile_avatars_select_couple
on storage.objects for select
to authenticated
using (
  bucket_id = 'profile-avatars'
  and public.can_access_profile_avatar(name)
);

drop policy if exists profile_avatars_insert_owner on storage.objects;
create policy profile_avatars_insert_owner
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and owner_id = (select auth.uid()::text)
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists profile_avatars_delete_owner on storage.objects;
create policy profile_avatars_delete_owner
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and owner_id = (select auth.uid()::text)
  and split_part(name, '/', 1) = auth.uid()::text
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime'
      and c.relname = 'profiles'
  ) then
    execute 'alter publication supabase_realtime add table public.profiles';
  end if;
end;
$$;
