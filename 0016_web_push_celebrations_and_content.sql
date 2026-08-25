-- Caderno de Dois — Web Push privado para celebrações e novidades compartilhadas.
-- Execute depois das migrations 0001 a 0015 no projeto Supabase do casal.

alter table public.notifications
  add column if not exists push_sent_at timestamptz,
  add column if not exists push_delivery_started_at timestamptz;

alter table public.notifications
  drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'plan_created',
    'location_started',
    'location_paused',
    'book_added',
    'movie_added',
    'music_added'
  ));

create index if not exists notifications_push_delivery_idx
  on public.notifications (kind, created_at asc)
  where push_sent_at is null;

-- Evita que avisos já existentes sejam enviados novamente no momento da ativação.
update public.notifications
set push_sent_at = now(), push_delivery_started_at = null
where push_sent_at is null;

create or replace function public.notify_partner_of_new_library_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_kind text;
  notification_title text;
  notification_body text;
begin
  if new.item_type = 'book' then
    notification_kind := 'book_added';
    notification_title := 'Nova leitura compartilhada';
    notification_body := '“' || new.title || '” entrou na lista de vocês.';
  else
    notification_kind := 'movie_added';
    notification_title := 'Novo filme compartilhado';
    notification_body := '“' || new.title || '” entrou na lista de vocês.';
  end if;

  insert into public.notifications (couple_id, recipient_id, actor_id, kind, title, body)
  select
    new.couple_id,
    member.user_id,
    new.author_id,
    notification_kind,
    notification_title,
    notification_body
  from public.couple_members member
  where member.couple_id = new.couple_id
    and member.user_id <> new.author_id;

  return new;
end;
$$;

drop trigger if exists on_couple_library_item_created_notify_partner on public.couple_library_items;
create trigger on_couple_library_item_created_notify_partner
after insert on public.couple_library_items
for each row execute procedure public.notify_partner_of_new_library_item();

create or replace function public.notify_partner_of_new_music_queue_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (couple_id, recipient_id, actor_id, kind, title, body)
  select
    new.couple_id,
    member.user_id,
    new.added_by,
    'music_added',
    'Nova música na fila afetiva',
    '“' || new.track_title || '” foi adicionada à Sala Spotify.'
  from public.couple_members member
  where member.couple_id = new.couple_id
    and member.user_id <> new.added_by;

  return new;
end;
$$;

drop trigger if exists on_couple_music_queue_item_created_notify_partner on public.couple_music_queue;
create trigger on_couple_music_queue_item_created_notify_partner
after insert on public.couple_music_queue
for each row execute procedure public.notify_partner_of_new_music_queue_item();

create table if not exists public.couple_celebration_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.couple_milestones(id) on delete cascade,
  celebration_date date not null,
  delivery_started_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (milestone_id, celebration_date)
);

create index if not exists couple_celebration_push_deliveries_pending_idx
  on public.couple_celebration_push_deliveries (celebration_date, sent_at)
  where sent_at is null;

alter table public.couple_celebration_push_deliveries enable row level security;

insert into public.app_system_jobs (job_key)
values ('anniversary-web-push'), ('notification-web-push')
on conflict (job_key) do nothing;
