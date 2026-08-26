-- appCasal — reserva temporária para entrega confiável de lembretes Web Push.
-- Execute depois de 0012_web_push_subscriptions.sql.

alter table public.couple_music_rooms
  add column if not exists reminder_delivery_started_at timestamptz;

create index if not exists couple_music_rooms_reminder_delivery_idx
  on public.couple_music_rooms (listen_at, reminder_delivery_started_at)
  where listen_at is not null and reminder_sent_at is null;
