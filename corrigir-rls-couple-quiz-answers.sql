-- Correção do erro Supabase 42P17:
-- infinite recursion detected in policy for relation "couple_quiz_answers"
--
-- Execute no Supabase Dashboard > SQL Editor usando um usuário administrador.
-- A causa é uma política da própria tabela que consulta
-- public.couple_quiz_answers novamente durante a avaliação do USING/WITH CHECK.

alter table public.couple_quiz_answers enable row level security;

drop policy if exists "couples can read quiz answers" on public.couple_quiz_answers;
drop policy if exists "couple members can read quiz answers" on public.couple_quiz_answers;
drop policy if exists "couple quiz answers select" on public.couple_quiz_answers;
drop policy if exists "couple quiz answers insert" on public.couple_quiz_answers;
drop policy if exists "couple quiz answers update" on public.couple_quiz_answers;
drop policy if exists "couple quiz answers delete" on public.couple_quiz_answers;

create policy "couple quiz answers select"
on public.couple_quiz_answers
for select
to authenticated
using (
  exists (
    select 1
    from public.couple_members as cm
    where cm.couple_id = couple_quiz_answers.couple_id
      and cm.user_id = auth.uid()
  )
);

create policy "couple quiz answers insert"
on public.couple_quiz_answers
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.couple_members as cm
    where cm.couple_id = couple_quiz_answers.couple_id
      and cm.user_id = auth.uid()
  )
);

create policy "couple quiz answers update"
on public.couple_quiz_answers
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.couple_members as cm
    where cm.couple_id = couple_quiz_answers.couple_id
      and cm.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.couple_members as cm
    where cm.couple_id = couple_quiz_answers.couple_id
      and cm.user_id = auth.uid()
  )
);

create policy "couple quiz answers delete"
on public.couple_quiz_answers
for delete
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.couple_members as cm
    where cm.couple_id = couple_quiz_answers.couple_id
      and cm.user_id = auth.uid()
  )
);

-- Teste opcional após executar:
-- select couple_id, quiz_key, question_key, user_id, answer_value,
--        created_at, updated_at
-- from public.couple_quiz_answers
-- where couple_id = 'SEU_COUPLE_ID';

-- Se a própria tabela couple_members tiver uma política que também consulta
-- couple_quiz_answers, remova essa dependência circular. A política de
-- couple_members deve validar apenas auth.uid() e os membros do casal.
