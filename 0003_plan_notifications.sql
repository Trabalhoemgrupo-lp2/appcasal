-- appCasal Web — alerta de nova tarefa para o parceiro.
-- Execute depois de 0001_appcasal.sql e 0002_shared_plans_media_invites.sql.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete cascade,
  kind text not null check (kind in ('plan_created')),
  title text not null check (char_length(btrim(title)) between 1 and 180),
  body text not null default '' check (char_length(body) <= 600),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_at_idx
  on public.notifications (recipient_id, created_at desc);

create or replace function public.notify_partner_of_new_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  creator_name text;
begin
  select name
    into creator_name
  from public.profiles
  where id = new.created_by;

  insert into public.notifications (
    couple_id,
    recipient_id,
    actor_id,
    plan_id,
    kind,
    title,
    body
  )
  select
    new.couple_id,
    member.user_id,
    new.created_by,
    new.id,
    'plan_created',
    coalesce(creator_name, 'Seu parceiro') || ' adicionou uma tarefa',
    new.title || ' · ' || to_char(new.scheduled_for, 'DD/MM/YYYY')
  from public.couple_members member
  where member.couple_id = new.couple_id
    and member.user_id <> new.created_by;

  return new;
end;
$$;

drop trigger if exists on_plan_created_notify_partner on public.plans;
create trigger on_plan_created_notify_partner
after insert on public.plans
for each row execute procedure public.notify_partner_of_new_plan();

grant select, update on public.notifications to authenticated;

alter table public.notifications enable row level security;

drop policy if exists notifications_select_recipient on public.notifications;
create policy notifications_select_recipient
on public.notifications for select
to authenticated
using (recipient_id = auth.uid());

drop policy if exists notifications_update_recipient on public.notifications;
create policy notifications_update_recipient
on public.notifications for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime'
      and c.relname = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end;
$$;
