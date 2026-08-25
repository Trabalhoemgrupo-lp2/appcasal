# Ativação do Spotify OAuth

O botão **Entrar no Spotify** inicia a vinculação da identidade Spotify à sessão existente no Caderno de Dois e retorna ao domínio público `https://appcasal-kzzvckwa.manus.space`. A ação de criação de playlist usa um segundo fluxo OAuth, processado pelo servidor, e por isso exige uma callback adicional no aplicativo do Spotify.

## Credenciais e callbacks

1. No [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/), crie ou abra o aplicativo Spotify.
2. Em **Redirect URIs**, adicione exatamente as duas URLs abaixo, sem trocar o esquema, o host, o caminho ou a barra final:

```text
https://fysieyzyejnqosovgeyb.supabase.co/auth/v1/callback
https://appcasal-kzzvckwa.manus.space/api/spotify/callback
```

A primeira URL é a callback do **Supabase Auth**, usada pela vinculação da identidade Spotify. A segunda é a callback do servidor do Caderno de Dois, usada pela autorização de criação de uma playlist privada. O Spotify compara a URI cadastrada com a URI enviada tanto na autorização quanto na troca do código.

3. Salve e copie o **Client ID** e o **Client Secret**. Nunca envie o segredo pelo chat ou registre-o no código.
4. No Supabase, abra **Authentication → Sign In / Providers → Spotify**, habilite **Spotify Enabled**, preencha os dois campos e salve.
5. Na mesma tela, em **User Signups**, habilite **Allow manual linking** e salve. O Caderno usa a vinculação manual de identidade para acrescentar o Spotify à sessão já autenticada, sem transformar esse login em uma nova conta no aplicativo.
6. Em **Authentication → URL Configuration**, mantenha `https://appcasal-kzzvckwa.manus.space` como **Site URL** e inclua essa origem como **Redirect URL** permitida.

O callback do provedor precisa ser o endpoint do **Supabase**, enquanto o `redirectTo` usado pelo aplicativo precisa estar na lista de URLs permitidas do Supabase. Esses valores são distintos do callback próprio usado na criação de playlists.

## Variáveis do servidor

Para o fluxo de playlist, o servidor precisa das seguintes variáveis em um arquivo `.env` local ou no ambiente seguro de produção. O arquivo `.env` deve permanecer fora do controle de versão:

```dotenv
APP_PUBLIC_ORIGIN=https://appcasal-kzzvckwa.manus.space
SPOTIFY_CLIENT_ID=seu_client_id
SPOTIFY_CLIENT_SECRET=seu_client_secret
```

`APP_PUBLIC_ORIGIN` permite usar a mesma implementação em uma implantação de preview ou em produção sem codificar uma callback incorreta. Em produção, a origem deve usar HTTPS. O valor padrão no código continua sendo o domínio público atual para preservar compatibilidade com a implantação existente.

## Validação

Após salvar as configurações, entre no Caderno de Dois com uma conta real, abra **Música** e toque em **Entrar no Spotify**. A autorização deve abrir o Spotify e retornar à Sala Spotify no domínio público. Depois, acione a criação de playlist. O servidor deve trocar o código usando exatamente `https://appcasal-kzzvckwa.manus.space/api/spotify/callback` e redirecionar somente para uma URL oficial do Spotify após a criação privada.

A validação automatizada cobre a origem configurável, a normalização de barra final, a exigência de HTTPS, o escopo `playlist-modify-private` e a validação do destino final. Para testar as credenciais do aplicativo contra o endpoint real do Spotify, use explicitamente `RUN_LIVE_SPOTIFY_TESTS=1 pnpm vitest run server/spotifyCredentials.test.ts`; esse teste é opt-in porque depende de um serviço externo. A autorização real de uma conta Spotify ainda depende de uma sessão autenticada no Spotify e de o URI adicional estar cadastrado no Spotify Developer Dashboard.

## Estado da configuração

O painel do projeto **meu casal** indica que o provedor **Spotify está habilitado**, as credenciais da aplicação estão configuradas e **Allow manual linking** está ativo. Esses valores não são registrados neste repositório nem devem ser enviados pelo chat. A configuração local recebeu as mesmas credenciais para os testes, mas a callback adicional precisa estar cadastrada no Spotify Developer Dashboard para validar a criação de playlist em produção.

## Fontes oficiais

- [Supabase: Login com Spotify](https://supabase.com/docs/guides/auth/social-login/auth-spotify)
- [Supabase: Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Spotify: Redirect URIs](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)
