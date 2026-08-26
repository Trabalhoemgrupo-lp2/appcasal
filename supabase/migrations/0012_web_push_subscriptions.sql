-- appCasal — inscrições Web Push privadas e vínculo do agendador de lembretes.
-- A reserva temporária de processamento é adicionada pela migration 0013.

create table if not exists public.couple_web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists couple_web_push_subscriptions_active_idx
  on public.couple_web_push_subscriptions (couple_id, revoked_at);

alter table public.couple_web_push_subscriptions enable row level security;

create policy "Membro insere a própria inscrição Web Push"
on public.couple_web_push_subscriptions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_couple_member(couple_id)
);

create policy "Membro lê apenas a própria inscrição Web Push"
on public.couple_web_push_subscriptions
for select
to authenticated
using (user_id = auth.uid());

create policy "Membro atualiza apenas a própria inscrição Web Push"
on public.couple_web_push_subscriptions
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and public.is_couple_member(couple_id)
);

create policy "Membro remove apenas a própria inscrição Web Push"
on public.couple_web_push_subscriptions
for delete
to authenticated
using (user_id = auth.uid());

alter table public.couple_music_rooms
  add column if not exists schedule_cron_task_uid varchar(65);

create index if not exists couple_music_rooms_schedule_cron_task_uid_idx
  on public.couple_music_rooms (schedule_cron_task_uid)
  where schedule_cron_task_uid is not null;

create table if not exists public.app_system_jobs (
  job_key text primary key,
  schedule_cron_task_uid varchar(65),
  updated_at timestamptz not null default now()
);

alter table public.app_system_jobs enable row level security;

insert into public.app_system_jobs (job_key)
values ('music-web-push')
on conflict (job_key) do nothing;

alter publication supabase_realtime add table public.couple_web_push_subscriptions;
