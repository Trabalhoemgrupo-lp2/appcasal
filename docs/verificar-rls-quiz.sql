-- Diagnóstico somente leitura. Execute no Supabase SQL Editor.
-- Não cria, altera nem remove dados.

select
  routine_schema,
  routine_name,
  routine_type,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'is_couple_member';

select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'couple_quiz_answers'
order by policyname;

select
  count(*) as quiz_answer_rows
from public.couple_quiz_answers;
