# Ativação do Supabase — registro de execução

Projeto ativo: `fysieyzyejnqosovgeyb` — **meu casal**.

| Migration | Estado | Observação |
|---|---|---|
| `0001_appcasal.sql` | Executada | Esquema-base, RLS e Realtime inicial. |
| `0002_shared_plans_media_invites.sql` | Executada | Corrigida a comparação de `storage.objects.owner_id` para `auth.uid()::text`, compatível com o tipo atual de Storage. |
| `0003_plan_notifications.sql` | Executada | Notificações privadas de calendário. |
| `0004_couple_rituals.sql` | Executada | Rituais, humor, desejos e presentes por casal. |
| `0005_couple_locations.sql` | Executada | Compartilhamento voluntário de localização. |
| `0006_location_alerts_and_places.sql` | Executada | Lugares afetivos e alertas de localização. |
| `0007_map_places_categories_and_avatars.sql` | Executada | Categorias do mapa e avatares privados; políticas de Storage corrigidas para `auth.uid()::text`. |
| `0008_background_proximity_preferences.sql` | Executada | Preferências privadas de proximidade. |
| `0009_couple_music_rooms.sql` | Executada | Sala Spotify e fila afetiva. |
| `0010_music_room_covers_reactions_reminders.sql` | Executada | Capas privadas, reações e agenda de escuta; políticas de Storage corrigidas para `auth.uid()::text`. |
| `0011_couple_widgets_and_quizzes.sql` | Executada | Widgets voluntários de bateria/clima e quizzes privados. |
| `0012_web_push_subscriptions.sql` | Executada | Inscrições Web Push privadas por dispositivo, RLS individual e registro do trabalho de lembretes. |
| `0013_music_reminder_delivery_lease.sql` | Executada | Reserva temporária de processamento que evita aviso musical duplicado durante reexecuções. |

## Verificação final

As consultas públicas às tabelas principais retornaram **HTTP 200**. A leitura da tabela `couple_web_push_subscriptions` retornou **HTTP 200**, confirmando a aplicação da migration `0012`; a leitura da coluna `reminder_delivery_started_at` em `couple_music_rooms` também retornou **HTTP 200**, confirmando a migration `0013`. Uma consulta somente de leitura no editor SQL confirmou os buckets privados `memory-photos`, `profile-avatars` e `music-room-covers`, além da publicação Realtime de mensagens, planos, Sala Spotify, widgets e quizzes.

> O código de entrega Web Push, o service worker, as chaves VAPID seguras e a rota de execução agendada estão ativos. Em produção, o trabalho recorrente `music-web-push` executa a cada minuto na rota protegida `/api/scheduled/music-web-push`; o identificador ativo `DBef7nKKJrm2bD9KUxurmP` está associado ao registro privado `app_system_jobs`. A execução automática de `2026-08-20 14:20:38 UTC` e a execução manual de `2026-08-20 14:21:32 UTC` retornaram `HTTP 200`, sem o erro anterior de coluna inexistente. Falta somente a validação com um dispositivo inscrito e um lembrete real vencido.

## Confirmação de e-mail no domínio publicado

A configuração de autenticação do Supabase foi revisada diretamente no painel. A **Site URL** e a lista de **Redirect URLs** contêm `https://appcasal-kzzvckwa.manus.space`; o cadastro também envia esse mesmo domínio explicitamente por `emailRedirectTo`. Com isso, novos e-mails de confirmação não devem redirecionar para `localhost`. A validação final ainda requer abrir um **novo** link de confirmação no dispositivo real, pois links antigos mantêm o destino com que foram originalmente emitidos.
