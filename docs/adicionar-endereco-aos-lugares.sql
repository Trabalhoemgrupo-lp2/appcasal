-- Adiciona o endereço personalizado usado nos cartões de localização.
-- Execute no Supabase Dashboard > SQL Editor.

alter table public.favorite_places
  add column if not exists address text;

comment on column public.favorite_places.address is
  'Endereço informado pela pessoa para identificação amigável do lugar salvo';
