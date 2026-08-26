# URLs de produção

A URL definitiva será a URL atribuída pelo botão **Publicar** no painel WebDev. Ela não deve ser inventada no código; após a publicação, preencher a variável segura `APP_PUBLIC_ORIGIN` com a origem HTTPS sem barra final.

## Supabase

Em **Authentication → URL Configuration**, cadastrar a URL raiz publicada como **Site URL** e também estas Redirect URLs:

```text
<URL_PUBLICADA>
<URL_PUBLICADA>/
```

Se o fluxo OAuth do projeto usar callbacks adicionais, manter os endpoints do projeto publicados sob a mesma origem.

## Spotify

Em **Spotify Developer Dashboard → Settings → Redirect URIs**, cadastrar exatamente:

```text
<URL_PUBLICADA>/api/spotify/callback
```

A URL precisa coincidir exatamente com a função `getSpotifyPlaylistCallbackUrl`, incluindo HTTPS, host, caminho e ausência de barra final adicional.

## Google Maps

Na chave usada pelo proxy de mapas, autorizar o domínio publicado como HTTP referrer, preferencialmente com:

```text
<URL_PUBLICADA>/*
```

Manter as APIs Maps JavaScript, Geocoding, Places, Marker e Geometry habilitadas conforme o uso do app.

## Variáveis relacionadas

```text
APP_PUBLIC_ORIGIN=<URL_PUBLICADA>
VITE_SUPABASE_URL=<URL_SUPABASE>
VITE_SUPABASE_PUBLISHABLE_KEY=<CHAVE_PUBLICA_SUPABASE>
SPOTIFY_CLIENT_ID=<CLIENT_ID_SPOTIFY>
SPOTIFY_CLIENT_SECRET=<CLIENT_SECRET_SPOTIFY>
```

A URL não pode ser finalizada enquanto o projeto não for publicado e o domínio permanente não for atribuído pelo painel.
