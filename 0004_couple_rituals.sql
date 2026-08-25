-- appCasal Web — rituais afetivos, humor, desejos e presentes.
-- Execute depois de 0001_appcasal.sql, 0002_shared_plans_media_invites.sql e 0003_plan_notifications.sql.

create table if not exists public.couple_settings (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  relationship_started_on date,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.couple_milestones (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 120),
  recurrence text not null check (recurrence in ('monthly', 'yearly')),
  day_of_month smallint not null check (day_of_month between 1 and 31),
  month_of_year smallint check (month_of_year between 1 and 12),
  created_at timestamptz not null default now(),
  constraint milestones_recurrence_month_check check (
    (recurrence = 'monthly' and month_of_year is null)
    or (recurrence = 'yearly' and month_of_year is not null)
  )
);

create unique index if not exists couple_milestones_default_kind_idx
  on public.couple_milestones (couple_id, recurrence, coalesce(month_of_year, 0), day_of_month, label);

create table if not exists public.daily_moods (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  mood text not null check (mood in ('radiante', 'feliz', 'sereno', 'saudade', 'cansado')),
  mood_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (couple_id, author_id, mood_date)
);

create table if not exists public.shared_wishes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 500),
  fulfilled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.gift_wishes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  wished_by uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  occasion text not null default '' check (char_length(occasion) <= 120),
  notes text not null default '' check (char_length(notes) <= 800),
  reference_url text check (char_length(reference_url) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists daily_moods_couple_date_idx on public.daily_moods (couple_id, mood_date desc);
create index if not exists shared_wishes_couple_created_idx on public.shared_wishes (couple_id, created_at desc);
create index if not exists gift_wishes_couple_created_idx on public.gift_wishes (couple_id, created_at desc);

create or replace function public.create_couple_rituals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.couple_settings (couple_id)
  values (new.id)
  on conflict (couple_id) do nothing;

  insert into public.couple_milestones (couple_id, label, recurrence, day_of_month, month_of_year)
  values
    (new.id, 'Nosso mêsversário', 'monthly', 23, null),
    (new.id, 'Nosso aniversário de namoro', 'yearly', 23, 6),
    (new.id, 'Aniversário especial · 12/01', 'yearly', 12, 1),
    (new.id, 'Aniversário especial · 21/08', 'yearly', 21, 8)
  on conflict do nothing;

  return new;
end;
$$;

create or replace function public.touch_couple_settings()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.touch_daily_moods()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_couple_created_create_rituals on public.couples;
create trigger on_couple_created_create_rituals
after insert on public.couples
for each row execute procedure public.create_couple_rituals();

drop trigger if exists on_couple_settings_updated on public.couple_settings;
create trigger on_couple_settings_updated
before update on public.couple_settings
for each row execute procedure public.touch_couple_settings();

drop trigger if exists on_daily_mood_updated on public.daily_moods;
create trigger on_daily_mood_updated
before update on public.daily_moods
for each row execute procedure public.touch_daily_moods();

-- Garante rituais para casais criados antes desta migração.
insert into public.couple_settings (couple_id)
select id from public.couples
on conflict (couple_id) do nothing;

insert into public.couple_milestones (couple_id, label, recurrence, day_of_month, month_of_year)
select couples.id, defaults.label, defaults.recurrence, defaults.day_of_month, defaults.month_of_year
from public.couples couples
cross join (
  values
    ('Nosso mêsversário'::text, 'monthly'::text, 23::smallint, null::smallint),
    ('Nosso aniversário de namoro'::text, 'yearly'::text, 23::smallint, 6::smallint),
    ('Aniversário especial · 12/01'::text, 'yearly'::text, 12::smallint, 1::smallint),
    ('Aniversário especial · 21/08'::text, 'yearly'::text, 21::smallint, 8::smallint)
) as defaults(label, recurrence, day_of_month, month_of_year)
on conflict do nothing;

grant select, insert, update on public.couple_settings to authenticated;
grant select, insert, update, delete on public.couple_milestones to authenticated;
grant select, insert, update, delete on public.daily_moods to authenticated;
grant select, insert, update, delete on public.shared_wishes to authenticated;
grant select, insert, update, delete on public.gift_wishes to authenticated;

alter table public.couple_settings enable row level security;
alter table public.couple_milestones enable row level security;
alter table public.daily_moods enable row level security;
alter table public.shared_wishes enable row level security;
alter table public.gift_wishes enable row level security;

drop policy if exists couple_settings_select_member on public.couple_settings;
create policy couple_settings_select_member on public.couple_settings for select to authenticated
using (public.is_couple_member(couple_id));

drop policy if exists couple_settings_update_member on public.couple_settings;
create policy couple_settings_update_member on public.couple_settings for update to authenticated
using (public.is_couple_member(couple_id))
with check (public.is_couple_member(couple_id));

drop policy if exists couple_settings_insert_member on public.couple_settings;
create policy couple_settings_insert_member on public.couple_settings for insert to authenticated
with check (public.is_couple_member(couple_id));

drop policy if exists couple_milestones_member on public.couple_milestones;
create policy couple_milestones_member on public.couple_milestones for all to authenticated
using (public.is_couple_member(couple_id))
with check (public.is_couple_member(couple_id));

drop policy if exists daily_moods_select_member on public.daily_moods;
create policy daily_moods_select_member on public.daily_moods for select to authenticated
using (public.is_couple_member(couple_id));

drop policy if exists daily_moods_insert_author on public.daily_moods;
create policy daily_moods_insert_author on public.daily_moods for insert to authenticated
with check (author_id = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists daily_moods_update_author on public.daily_moods;
create policy daily_moods_update_author on public.daily_moods for update to authenticated
using (author_id = auth.uid() and public.is_couple_member(couple_id))
with check (author_id = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists daily_moods_delete_author on public.daily_moods;
create policy daily_moods_delete_author on public.daily_moods for delete to authenticated
using (author_id = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists shared_wishes_select_member on public.shared_wishes;
create policy shared_wishes_select_member on public.shared_wishes for select to authenticated
using (public.is_couple_member(couple_id));

drop policy if exists shared_wishes_insert_author on public.shared_wishes;
create policy shared_wishes_insert_author on public.shared_wishes for insert to authenticated
with check (author_id = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists shared_wishes_update_author on public.shared_wishes;
create policy shared_wishes_update_author on public.shared_wishes for update to authenticated
using (author_id = auth.uid() and public.is_couple_member(couple_id))
with check (author_id = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists shared_wishes_delete_author on public.shared_wishes;
create policy shared_wishes_delete_author on public.shared_wishes for delete to authenticated
using (author_id = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists gift_wishes_select_member on public.gift_wishes;
create policy gift_wishes_select_member on public.gift_wishes for select to authenticated
using (public.is_couple_member(couple_id));

drop policy if exists gift_wishes_insert_owner on public.gift_wishes;
create policy gift_wishes_insert_owner on public.gift_wishes for insert to authenticated
with check (wished_by = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists gift_wishes_update_owner on public.gift_wishes;
create policy gift_wishes_update_owner on public.gift_wishes for update to authenticated
using (wished_by = auth.uid() and public.is_couple_member(couple_id))
with check (wished_by = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists gift_wishes_delete_owner on public.gift_wishes;
create policy gift_wishes_delete_owner on public.gift_wishes for delete to authenticated
using (wished_by = auth.uid() and public.is_couple_member(couple_id));

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array['couple_settings', 'daily_moods', 'shared_wishes', 'gift_wishes']
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
