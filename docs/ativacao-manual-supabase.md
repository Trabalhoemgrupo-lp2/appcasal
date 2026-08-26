# Ativação manual do PostgreSQL no Supabase

Este guia permite ativar o banco do **appCasal** no seu próprio projeto Supabase, sem compartilhar senhas, chaves administrativas ou acesso à sua conta.

> As migrations são alterações versionadas de banco de dados. Execute os arquivos na ordem indicada para manter as tabelas, políticas de privacidade e recursos dependentes consistentes. O editor SQL do Supabase permite executar consultas diretamente pelo Dashboard.[1]

## Antes de começar

Confirme que está no projeto **appcasal**. No menu lateral, abra **SQL Editor**, clique em **New query** e mantenha apenas uma aba de consulta aberta por vez.

Não use a senha do banco em nenhum desses scripts e não compartilhe a chave `service_role`. Os arquivos criam somente a estrutura privada do produto; não criam contas, não inserem dados de teste e não apagam dados existentes.

## Ordem obrigatória

| Ordem | Arquivo | Resultado principal |
|---:|---|---|
| 1 | `0001_appcasal.sql` | Contas, casais, feed, chat, RLS e Realtime básico |
| 2 | `0002_shared_plans_media_invites.sql` | Planos, convites e fotos privadas das memórias |
| 3 | `0003_plan_notifications.sql` | Avisos de novos planos ao parceiro |
| 4 | `0004_couple_rituals.sql` | Rituais, humor, desejos, presentes e datas especiais |
| 5 | `0005_couple_locations.sql` | Localização voluntária e privada do casal |
| 6 | `0006_location_alerts_and_places.sql` | Alertas de localização e lugares afetivos |
| 7 | `0007_map_places_categories_and_avatars.sql` | Categorias de lugares e avatares privados |
| 8 | `0008_background_proximity_preferences.sql` | Preferências de proximidade por pessoa e por lugar |
| 9 | `0009_couple_music_rooms.sql` | Sala Spotify, convite Jam e fila afetiva |
| 10 | `0010_music_room_covers_reactions_reminders.sql` | Capa privada, reações por emoji e agenda de escuta da Sala Spotify |
| 11 | `0011_couple_widgets_and_quizzes.sql` | Widgets voluntários de bateria e clima, além dos quizzes lacrados do casal |
| 12 | `0012_web_push_subscriptions.sql` | Inscrições privadas por dispositivo para notificações Web e vínculo do trabalho agendado |
| 13 | `0013_music_reminder_delivery_lease.sql` | Reserva temporária de processamento para evitar avisos musicais duplicados durante reexecuções |

### Por que não há um SQL único

Os arquivos permanecem **separados e versionados** para que cada etapa possa ser conferida no histórico, executada somente depois de suas dependências e interrompida com segurança se o Supabase informar um erro. Essa abordagem torna a revisão das políticas RLS, dos buckets privados e da publicação Realtime mais clara; um arquivo consolidado ocultaria a origem de uma falha e dificultaria a recuperação orientada.

## Como executar cada arquivo

1. Abra o arquivo correspondente da tabela acima no computador.
2. Copie **todo** o conteúdo dele.
3. Cole no **SQL Editor** do Supabase.
4. Clique em **Run**.
5. Espere a mensagem de sucesso antes de avançar ao próximo arquivo.

Se houver erro, **pare na mesma migration**, tire uma captura que não exponha chaves e envie-a aqui. Não pule para o próximo arquivo.

## Conferência após a migration 0013

Ao terminar, abra **Table Editor**. As tabelas `profiles`, `couples`, `posts`, `messages`, `plans`, `notifications`, `couple_music_rooms`, `couple_music_queue`, `couple_music_reactions`, `couple_web_push_subscriptions`, `couple_widget_battery_snapshots`, `couple_widget_weather` e `couple_quiz_answers` devem aparecer. Em **Storage**, os buckets `memory-photos`, `profile-avatars` e `music-room-covers` devem existir e estar privados.

## Lembretes de música com o navegador fechado

A estrutura persistente da Sala Spotify, incluindo capa, reações e agenda, fica pronta após a migration `0010`. As migrations `0012` e `0013` adicionam inscrições Web Push privadas por dispositivo e uma reserva de processamento que reduz duplicação em reexecuções.

O navegador continua exigindo a permissão explícita de cada pessoa. Depois de publicar esta versão do app, o projeto deve registrar **um trabalho recorrente por minuto** para a rota protegida `POST /api/scheduled/music-web-push`. O trabalho deve ser associado ao registro `app_system_jobs` com `job_key = 'music-web-push'`; o identificador do trabalho deve ficar em `schedule_cron_task_uid`. Essa ativação é feita no ambiente de publicação, pois a rota só estará disponível depois que a nova versão estiver online.

> Nenhuma chave VAPID privada, chave de serviço do Supabase ou endpoint de dispositivo deve ser copiado para o frontend, para o SQL Editor ou para o chat. Eles permanecem em variáveis seguras do servidor.

## Referência

[1]: https://supabase.com/docs/guides/database/functions
