-- appCasal Web — widgets voluntários e quizzes privados.
-- Execute depois de 0010_music_room_covers_reactions_reminders.sql.
-- Não armazena histórico de bateria, geolocalização do aparelho ou respostas públicas.

create table if not exists public.couple_widget_battery_snapshots (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  level_percent smallint not null check (level_percent between 0 and 100),
  is_charging boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

create table if not exists public.couple_widget_weather (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  city text not null check (char_length(btrim(city)) between 1 and 100),
  latitude numeric(8, 5) not null check (latitude between -90 and 90),
  longitude numeric(8, 5) not null check (longitude between -180 and 180),
  temperature_c numeric(4, 1),
  weather_code smallint,
  observed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.couple_quiz_answers (
  couple_id uuid not null references public.couples(id) on delete cascade,
  quiz_key text not null check (quiz_key in ('proxima-aventura', 'memorias-que-riem', 'rituais-nossos')),
  question_key text not null check (char_length(question_key) between 1 and 80),
  user_id uuid not null references public.profiles(id) on delete cascade,
  answer_value text not null check (char_length(btrim(answer_value)) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (couple_id, quiz_key, question_key, user_id)
);

create index if not exists couple_quiz_answers_member_idx
  on public.couple_quiz_answers (couple_id, user_id, quiz_key, question_key);

create or replace function public.touch_couple_widget_weather()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.touch_couple_quiz_answers()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_couple_widget_weather_updated on public.couple_widget_weather;
create trigger on_couple_widget_weather_updated
before update on public.couple_widget_weather
for each row execute procedure public.touch_couple_widget_weather();

drop trigger if exists on_couple_quiz_answers_updated on public.couple_quiz_answers;
create trigger on_couple_quiz_answers_updated
before update on public.couple_quiz_answers
for each row execute procedure public.touch_couple_quiz_answers();

grant select, insert, update, delete on public.couple_widget_battery_snapshots to authenticated;
grant select, insert, update on public.couple_widget_weather to authenticated;
grant select, insert, update, delete on public.couple_quiz_answers to authenticated;

alter table public.couple_widget_battery_snapshots enable row level security;
alter table public.couple_widget_weather enable row level security;
alter table public.couple_quiz_answers enable row level security;

drop policy if exists couple_widget_battery_select_member on public.couple_widget_battery_snapshots;
create policy couple_widget_battery_select_member on public.couple_widget_battery_snapshots for select to authenticated
using (public.is_couple_member(couple_id));

drop policy if exists couple_widget_battery_insert_owner on public.couple_widget_battery_snapshots;
create policy couple_widget_battery_insert_owner on public.couple_widget_battery_snapshots for insert to authenticated
with check (user_id = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists couple_widget_battery_update_owner on public.couple_widget_battery_snapshots;
create policy couple_widget_battery_update_owner on public.couple_widget_battery_snapshots for update to authenticated
using (user_id = auth.uid() and public.is_couple_member(couple_id))
with check (user_id = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists couple_widget_battery_delete_owner on public.couple_widget_battery_snapshots;
create policy couple_widget_battery_delete_owner on public.couple_widget_battery_snapshots for delete to authenticated
using (user_id = auth.uid());

drop policy if exists couple_widget_weather_select_member on public.couple_widget_weather;
create policy couple_widget_weather_select_member on public.couple_widget_weather for select to authenticated
using (public.is_couple_member(couple_id));

drop policy if exists couple_widget_weather_insert_member on public.couple_widget_weather;
create policy couple_widget_weather_insert_member on public.couple_widget_weather for insert to authenticated
with check (public.is_couple_member(couple_id));

drop policy if exists couple_widget_weather_update_member on public.couple_widget_weather;
create policy couple_widget_weather_update_member on public.couple_widget_weather for update to authenticated
using (public.is_couple_member(couple_id))
with check (public.is_couple_member(couple_id));

-- A própria resposta é sempre visível. A resposta do par aparece apenas depois
-- de a pessoa autenticada responder à mesma pergunta.
drop policy if exists couple_quiz_answers_select_revealed_member on public.couple_quiz_answers;
create policy couple_quiz_answers_select_revealed_member on public.couple_quiz_answers for select to authenticated
using (
  public.is_couple_member(couple_id)
  and (
    user_id = auth.uid()
    or exists (
      select 1
      from public.couple_quiz_answers own_answer
      where own_answer.couple_id = couple_quiz_answers.couple_id
        and own_answer.quiz_key = couple_quiz_answers.quiz_key
        and own_answer.question_key = couple_quiz_answers.question_key
        and own_answer.user_id = auth.uid()
    )
  )
);

drop policy if exists couple_quiz_answers_insert_owner on public.couple_quiz_answers;
create policy couple_quiz_answers_insert_owner on public.couple_quiz_answers for insert to authenticated
with check (user_id = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists couple_quiz_answers_update_owner on public.couple_quiz_answers;
create policy couple_quiz_answers_update_owner on public.couple_quiz_answers for update to authenticated
using (user_id = auth.uid() and public.is_couple_member(couple_id))
with check (user_id = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists couple_quiz_answers_delete_owner on public.couple_quiz_answers;
create policy couple_quiz_answers_delete_owner on public.couple_quiz_answers for delete to authenticated
using (user_id = auth.uid());

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array['couple_widget_battery_snapshots', 'couple_widget_weather', 'couple_quiz_answers']
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
