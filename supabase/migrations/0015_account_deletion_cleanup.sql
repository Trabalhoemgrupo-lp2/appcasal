-- Exclusão direta pelo Supabase Auth também precisa liberar as referências
-- com RESTRICT. O aplicativo continua sendo o fluxo recomendado, pois só ele
-- remove os arquivos do Storage antes de apagar a identidade.

create or replace function public.cleanup_account_before_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.couple_music_rooms where host_id = old.id;
  delete from public.posts where author_id = old.id;
  delete from public.messages where sender_id = old.id;
  delete from public.plans where created_by = old.id;
  delete from public.partner_invites where invited_by = old.id;
  delete from public.favorite_places where created_by = old.id;

  -- Se esta pessoa for a única integrante, a exclusão do casal vazio elimina
  -- também os dados compartilhados que não podem mais ser acessados por ninguém.
  delete from public.couples as couple
  where couple.id in (
    select membership.couple_id
    from public.couple_members as membership
    where membership.user_id = old.id
  )
  and not exists (
    select 1
    from public.couple_members as other_membership
    where other_membership.couple_id = couple.id
      and other_membership.user_id <> old.id
  );

  return old;
end;
$$;

drop trigger if exists before_profile_account_cleanup on public.profiles;
create trigger before_profile_account_cleanup
before delete on public.profiles
for each row execute procedure public.cleanup_account_before_profile_delete();
