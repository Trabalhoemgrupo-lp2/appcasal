-- Correção definitiva do erro 42P17 no Supabase:
-- infinite recursion detected in policy for relation "couple_quiz_answers"
--
-- Execute no Supabase Dashboard > SQL Editor com usuário administrador.
-- Esta versão consulta couple_members por uma função SECURITY DEFINER,
-- portanto a política de couple_members não volta a ser avaliada durante a
-- política de couple_quiz_answers.

create or replace function public.is_couple_member(
  target_couple_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.couple_members as cm
    where cm.couple_id = target_couple_id
      and cm.user_id = target_user_id
  );
$$;

revoke all on function public.is_couple_member(uuid, uuid) from public;
grant execute on function public.is_couple_member(uuid, uuid) to authenticated;

alter table public.couple_quiz_answers enable row level security;

-- Remove qualquer nome antigo de política da tabela, inclusive nomes criados
-- manualmente no primeiro script.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'couple_quiz_answers'
  loop
    execute format(
      'drop policy if exists %I on public.couple_quiz_answers',
      policy_row.policyname
    );
  end loop;
end
$$;

create policy "couple quiz answers select"
on public.couple_quiz_answers
for select
to authenticated
using (public.is_couple_member(couple_id, auth.uid()));

create policy "couple quiz answers insert"
on public.couple_quiz_answers
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_couple_member(couple_id, auth.uid())
);

create policy "couple quiz answers update"
on public.couple_quiz_answers
for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_couple_member(couple_id, auth.uid())
)
with check (
  user_id = auth.uid()
  and public.is_couple_member(couple_id, auth.uid())
);

create policy "couple quiz answers delete"
on public.couple_quiz_answers
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.is_couple_member(couple_id, auth.uid())
);

-- Verificação sem expor dados:
-- select public.is_couple_member('SEU_COUPLE_ID'::uuid, auth.uid());
-- Depois, no app, responda um quiz e confirme HTTP 201/200 em
-- /rest/v1/couple_quiz_answers, sem erro 42P17 ou 500.
