-- Caderno de Dois — biblioteca afetiva privada para leituras e filmes.
-- Execute depois da migration 0013 no projeto Supabase do casal.

create table if not exists public.couple_library_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('book', 'movie')),
  title text not null check (char_length(btrim(title)) between 1 and 180),
  creator text not null default '' check (char_length(creator) <= 180),
  notes text not null default '' check (char_length(notes) <= 600),
  status text not null check (
    (item_type = 'book' and status in ('want', 'reading', 'finished'))
    or (item_type = 'movie' and status in ('want', 'upcoming', 'watched'))
  ),
  release_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists couple_library_items_couple_type_status_idx
  on public.couple_library_items (couple_id, item_type, status, created_at desc);

create or replace function public.touch_couple_library_items()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if new.author_id is distinct from old.author_id then
    raise exception 'library_author_immutable';
  end if;
  if new.couple_id is distinct from old.couple_id then
    raise exception 'library_couple_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists on_couple_library_item_updated on public.couple_library_items;
create trigger on_couple_library_item_updated
before update on public.couple_library_items
for each row execute procedure public.touch_couple_library_items();

grant select, insert, update, delete on public.couple_library_items to authenticated;

alter table public.couple_library_items enable row level security;

drop policy if exists couple_library_items_select_member on public.couple_library_items;
create policy couple_library_items_select_member
on public.couple_library_items for select to authenticated
using (public.is_couple_member(couple_id));

drop policy if exists couple_library_items_insert_author on public.couple_library_items;
create policy couple_library_items_insert_author
on public.couple_library_items for insert to authenticated
with check (author_id = auth.uid() and public.is_couple_member(couple_id));

-- A lista e seu status pertencem ao casal; qualquer membro pode avançar um item.
drop policy if exists couple_library_items_update_member on public.couple_library_items;
create policy couple_library_items_update_member
on public.couple_library_items for update to authenticated
using (public.is_couple_member(couple_id))
with check (public.is_couple_member(couple_id));

drop policy if exists couple_library_items_delete_author on public.couple_library_items;
create policy couple_library_items_delete_author
on public.couple_library_items for delete to authenticated
using (author_id = auth.uid() and public.is_couple_member(couple_id));

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime'
      and c.relname = 'couple_library_items'
  ) then
    execute 'alter publication supabase_realtime add table public.couple_library_items';
  end if;
end;
$$;
