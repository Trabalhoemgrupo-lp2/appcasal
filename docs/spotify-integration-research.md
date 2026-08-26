# Sala Spotify — requisitos confirmados

## Objetivo

Adicionar uma sala musical privada ao appCasal sem expor senhas, tokens ou informações de reprodução entre pessoas que não pertencem ao casal.

## Constatações oficiais

O **Spotify Jam** permite que participantes escutem e alterem a fila juntos. Um anfitrião Premium pode criar o Jam; para a escuta remota, quem participa também precisa de Premium. O Spotify pode sugerir a entrada em um Jam para pessoas na mesma rede Wi‑Fi, mas esse reconhecimento acontece no próprio Spotify, não no appCasal. O appCasal deve somente guardar e compartilhar, com RLS por casal, o link ou QR de convite que o anfitrião escolheu fornecer. [1]

Para uma reprodução no navegador usando o Spotify Web Playback SDK, a conta precisa ser Premium e deve conceder o escopo `streaming`. Para observar ou controlar a reprodução via Spotify Connect, os escopos mínimos relevantes são `user-read-playback-state`, `user-read-currently-playing` e `user-modify-playback-state`. [2] [4]

Em um aplicativo web de página única, o método oficial recomendado de login é **Authorization Code com PKCE**. Ele usa um `client_id` público registrado no painel do Spotify e uma URI de redirecionamento permitida; o `client_secret` não deve ser colocado no frontend. O usuário autoriza explicitamente cada escopo solicitado. A integração deve solicitar apenas os escopos indispensáveis e manter tokens fora das tabelas compartilhadas do casal. [3] [4]

## Decisão de produto para a primeira versão

A primeira versão será uma **Sala Spotify de convite seguro**: estado privado do casal, título, anfitrião, link do Jam, QR de entrada, data de atualização e uma fila afetiva de referências Spotify. O controle e a sincronização do áudio acontecerão no Spotify, preservando compatibilidade com celulares, caixas de som e a descoberta na mesma rede Wi‑Fi. A reprodução embutida no appCasal poderá ser uma evolução posterior, condicionada à configuração de um aplicativo Spotify e a ambas as pessoas terem Premium. [1] [2]

## Vínculo opcional da conta Spotify

Cada pessoa poderá vincular **a própria** conta Spotify estando autenticada no appCasal. A interface inicia o fluxo `linkIdentity({ provider: 'spotify' })` do Supabase Auth, que redireciona a autorização ao Spotify e volta à aplicação já associando essa identidade ao mesmo usuário. A identidade vinculada pertence ao usuário no serviço de autenticação, e não às tabelas nem às políticas RLS compartilhadas do casal. [5] [6]

Antes de ativar o botão em dados reais, o proprietário do projeto deve criar um aplicativo no Spotify Developer Dashboard, registrar exatamente o callback exibido em **Supabase → Authentication → Sign In / Providers → Spotify**, inserir Client ID e Client Secret no provedor Spotify do Supabase e habilitar o vínculo manual de identidades. A URI de retorno precisa corresponder exatamente à URI cadastrada no Spotify. [5] [6] [7]

O vínculo mostra apenas o estado de conexão na Sala Spotify. Esta etapa não lê playlists, não controla reprodução e não persiste token, e-mail ou dados do perfil do Spotify em registros do casal. Recursos futuros de reprodução ou Spotify Connect exigirão consentimento separado e os escopos mínimos necessários. [3] [4]

## Validação de prévia

Em 18 de agosto de 2026, a prévia local exibiu a aba **Música** no trilho editorial, a abertura narrativa “Uma música no mesmo instante” e o formulário para abrir a primeira sala. A composição preserva a hierarquia do Caderno de Dois: convite material, acento hibisco e controles discretos de Spotify. A próxima checagem cobre a criação da sala, o QR local e a fila afetiva.

A criação de uma sala na prévia foi validada com o nome “Noite do nosso mêsversário”. O estado mudou para **aberta**, o QR local foi renderizado e os controles de link do Jam, abertura no Spotify, cópia de convite, encerramento e fila afetiva apareceram sem depender de acesso à rede local.

O salvamento de um link no formato `https://open.spotify.com/socialsession/...` foi aceito. Após o salvamento, a prévia habilitou a abertura no Spotify e a cópia do convite; o QR foi atualizado para codificar o próprio link da sala. Nenhum dado de conta, senha, token ou rede Wi‑Fi foi solicitado ou armazenado pelo appCasal.

A fila afetiva também foi validada com uma faixa Spotify, artista e bilhete opcional. O item apareceu com ordem, link externo e ação de remoção; o contador da fila foi atualizado. Assim, o fluxo de prévia cobre criação de sala, convite e curadoria colaborativa de músicas, sem iniciar uma reprodução externa durante os testes.

## Referências

1. [Spotify Support — Start or join a Jam](https://support.spotify.com/us/article/jam/)
2. [Spotify for Developers — Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk)
3. [Spotify for Developers — Authorization Code with PKCE Flow](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow)
4. [Spotify for Developers — Scopes](https://developer.spotify.com/documentation/web-api/concepts/scopes)
5. [Spotify for Developers — Web API](https://developer.spotify.com/documentation/web-api)
6. [Supabase Docs — Login with Spotify](https://supabase.com/docs/guides/auth/social-login/auth-spotify)
7. [Supabase Docs — Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
8. [Spotify for Developers — Redirect URIs](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)
