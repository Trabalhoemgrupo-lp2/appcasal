# Lembretes da Sala Spotify com o app fechado

## Decisão de implementação

O lembrete musical será enviado como **notificação web push**. Cada dispositivo autoriza explicitamente as notificações em uma ação direta e registra uma inscrição própria. O servidor agenda o disparo, cifra a mensagem para cada inscrição e entrega apenas um lembrete associado ao casal e ao horário escolhido.

## Requisitos confirmados

| Requisito | Consequência no appCasal |
|---|---|
| O push chega mesmo quando a aplicação não está aberta, desde que exista uma inscrição ativa. | É necessário armazenar inscrições por dispositivo, protegidas por usuário e casal. |
| A recepção ocorre em um service worker. | O projeto precisa de service worker e de uma rota que abra a Sala Spotify ao tocar no aviso. |
| O navegador exige HTTPS e permissão concedida por gesto explícito. | A Sala terá uma ação clara de ativar lembretes; nunca solicitará permissão automaticamente. |
| No iPhone e iPad, o Web Push depende do app web instalado na Tela de Início. | A documentação deve orientar a instalação do appCasal antes de ativar o lembrete nesses aparelhos. |

> As inscrições push são URLs de capacidade: devem ser tratadas como segredo operacional e nunca exibidas na interface, registradas em logs ou compartilhadas entre casais.

## Limites de privacidade

O payload conterá somente o título da sala, a hora e um bilhete escolhido para o lembrete. Não incluirá link de Jam, nome de faixas, localização, tokens Spotify, IPs ou dados de Wi‑Fi. Uma notificação por sessão e dispositivo evita repetições.

## Pré-requisitos antes da ativação

A entrega real do lembrete ainda não está ativada. Antes de implementá-la, o projeto precisa receber a **`SUPABASE_SERVICE_ROLE_KEY`** exclusivamente pelo campo seguro de variáveis do projeto, nunca por mensagens. Também serão geradas chaves VAPID específicas do projeto, criado o service worker de push e incluídas as tabelas privadas de inscrições por dispositivo.

Como o disparo depende de agendamento confiável, a versão com push só poderá ser configurada depois de o site estar publicado. O agendador deverá usar uma rota protegida em `/api/scheduled/`, executar de modo idempotente e persistir o identificador da tarefa no registro do lembrete. Essa sequência evita que lembretes sejam perdidos quando uma instância sem uso for suspensa.

> Até essa ativação, o cartão de agenda da Sala Spotify guarda o horário e o bilhete para o casal. O aviso garantido com o navegador fechado permanece pendente de configuração segura.

## Referências

[1] [MDN — Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

[2] [MDN — Using the Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API)

[3] [WebKit — Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
