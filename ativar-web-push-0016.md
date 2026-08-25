# Ativação do Web Push ampliado

O arquivo `supabase/migrations/0016_web_push_celebrations_and_content.sql` habilita os gatilhos privados para planos, livros, filmes e músicas, além da tabela idempotente de entregas das celebrações. Ele deve ser executado integralmente no **SQL Editor** do projeto Supabase `meu casal` depois das migrations `0001` a `0015`.

Após uma execução sem erros, os registros `anniversary-web-push` e `notification-web-push` passam a existir em `public.app_system_jobs`. Os agendamentos publicados usam esses registros para aceitar somente chamadas autorizadas. A migration também marca notificações anteriores como entregues para que nenhum aviso histórico seja reenviado.

> A execução deve ocorrer como uma única consulta, sem salvar ou reutilizar uma entrada incompleta do editor SQL.

## Estado de ativação

A migration foi aplicada com sucesso ao projeto Supabase `meu casal` em **21/08/2026**. Os dois trabalhos de produção estão vinculados aos registros privados da tabela `app_system_jobs`:

| Trabalho | Frequência | Finalidade |
| --- | --- | --- |
| `anniversary-web-push` | diariamente às 09h, horário de Brasília | aniversário de relacionamento, mesversário e aniversários pessoais |
| `notification-web-push` | a cada minuto | novos planos, livros, filmes e músicas |

Os identificadores técnicos dos trabalhos permanecem exclusivamente na configuração de produção; não são necessários para o uso diário do aplicativo.
