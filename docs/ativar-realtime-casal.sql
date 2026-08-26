-- Execute no Supabase Dashboard > SQL Editor como administrador.
-- Não insere nem remove dados; apenas garante as tabelas na publicação Realtime.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'couple_locations'
  ) then
    alter publication supabase_realtime add table public.couple_locations;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'favorite_places'
  ) then
    alter publication supabase_realtime add table public.favorite_places;
  end if;
end
$$;

select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('couple_locations', 'favorite_places')
order by tablename;
