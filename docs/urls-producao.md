# URLs de produção

A URL pública permanente configurada no Render é `https://appcasal-gratuito.onrender.com`. Use essa origem sem barra final em `APP_PUBLIC_ORIGIN` no serviço Render. O serviço é Free e pode suspender a instância após inatividade; os dados do appCasal continuam no Supabase.

## Supabase Authentication

Em **Authentication → URL Configuration**, cadastrar:

```text
Site URL: https://appcasal-gratuito.onrender.com
Redirect URL: https://appcasal-gratuito.onrender.com/
```

Se o fluxo OAuth do projeto usar callbacks adicionais, manter os endpoints publicados sob a mesma origem.

## Spotify

Em **Spotify Developer Dashboard → Settings → Redirect URIs**, cadastrar exatamente:

```text
https://appcasal-gratuito.onrender.com/api/spotify/callback
```

A URL precisa coincidir exatamente com a função `getSpotifyPlaylistCallbackUrl`, incluindo HTTPS, host, caminho e ausência de barra final adicional. A validação live do OAuth/playlist ainda depende de testar com as credenciais Spotify configuradas no Render.

## Google Maps

Na chave usada pelo proxy de mapas, autorizar o domínio publicado como HTTP referrer, preferencialmente com:

```text
https://appcasal-gratuito.onrender.com/*
```

Manter habilitadas as APIs Maps JavaScript, Geocoding, Places, Marker e Geometry conforme o uso do app.

## Supabase Database e Realtime — pendências obrigatórias

Executar no **Supabase Dashboard → SQL Editor**, usando um administrador do projeto Supabase, os scripts já entregues no repositório:

```text
docs/adicionar-endereco-aos-lugares.sql
docs/corrigir-rls-couple-quiz-answers.sql
```

O primeiro adiciona `favorite_places.address` sem apagar dados. O segundo substitui as políticas recursivas de `couple_quiz_answers`; após aplicá-lo, verificar se as políticas de `couple_members` não consultam `couple_quiz_answers`. Por fim, em **Database → Replication**, adicionar `public.couple_locations` e `public.favorite_places` ao publication `supabase_realtime` e validar a atualização entre dois participantes. Essas ações são externas ao banco interno do WebDev e não foram executadas automaticamente neste ambiente.

## Variáveis relacionadas

```text
APP_PUBLIC_ORIGIN=https://appcasal-gratuito.onrender.com
VITE_SUPABASE_URL=<URL_SUPABASE>
VITE_SUPABASE_PUBLISHABLE_KEY=<CHAVE_PUBLICA_SUPABASE>
SPOTIFY_CLIENT_ID=<CLIENT_ID_SPOTIFY>
SPOTIFY_CLIENT_SECRET=<CLIENT_SECRET_SPOTIFY>
```

Nunca versionar `SUPABASE_SERVICE_ROLE_KEY`, `SPOTIFY_CLIENT_SECRET` ou `VAPID_PRIVATE_KEY`.
