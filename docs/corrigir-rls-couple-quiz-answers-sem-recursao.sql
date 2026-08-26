-- Correção direta do erro 42P17 em couple_quiz_answers.
-- Execute no Supabase Dashboard > SQL Editor como administrador.
--
-- Esta versão não consulta couple_members dentro das políticas. Assim, ela
-- não pode entrar em recursão mesmo que a tabela couple_members tenha uma
-- política antiga apontando de volta para couple_quiz_answers.
-- A leitura fica restrita à resposta da própria pessoa, preservando o sigilo.

alter table public.couple_quiz_answers enable row level security;

drop policy if exists "couples can read quiz answers" on public.couple_quiz_answers;
drop policy if exists "couple members can read quiz answers" on public.couple_quiz_answers;
drop policy if exists "couple quiz answers select" on public.couple_quiz_answers;
drop policy if exists "couple quiz answers insert" on public.couple_quiz_answers;
drop policy if exists "couple quiz answers update" on public.couple_quiz_answers;
drop policy if exists "couple quiz answers delete" on public.couple_quiz_answers;

-- Remove também políticas com nomes diferentes criadas anteriormente.
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

create policy "quiz answers own select"
on public.couple_quiz_answers
for select
to authenticated
using (user_id = auth.uid());

create policy "quiz answers own insert"
on public.couple_quiz_answers
for insert
to authenticated
with check (user_id = auth.uid());

create policy "quiz answers own update"
on public.couple_quiz_answers
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "quiz answers own delete"
on public.couple_quiz_answers
for delete
to authenticated
using (user_id = auth.uid());

-- Verificação opcional, sem criar dados:
-- select policyname, cmd from pg_policies
-- where schemaname = 'public'
--   and tablename = 'couple_quiz_answers';
--
-- Depois, saia e entre no app novamente e responda um quiz. A resposta deve
-- retornar 201/200 e o botão deve continuar disponível para outras perguntas.
