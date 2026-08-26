import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { TRPCError } from "@trpc/server";

const CALLBACK_PATH = "/api/spotify/callback";
const STATE_COOKIE = "__Host-appcasal_spotify_playlist";
const PLAYLIST_SCOPE = "playlist-modify-private";

type PendingAuthorization = { state: string; userId: string };

function publicAppOrigin() {
  const configuredOrigin = process.env.APP_PUBLIC_ORIGIN?.trim();
  if (!configuredOrigin) {
    throw new Error("A origem pública do appCasal ainda não foi configurada.");
  }
  let origin: URL;
  try {
    origin = new URL(configuredOrigin);
  } catch {
    throw new Error("A origem pública do appCasal é inválida.");
  }

  const isLocalOrigin = origin.hostname === "localhost" || origin.hostname === "127.0.0.1";
  if (origin.protocol !== "https:" && !isLocalOrigin) {
    throw new Error("A origem pública do appCasal deve usar HTTPS.");
  }
  origin.pathname = origin.pathname.replace(/\/+$/, "");
  origin.search = "";
  origin.hash = "";
  return origin.toString().replace(/\/$/, "");
}

export function getSpotifyPlaylistCallbackUrl() {
  return new URL(CALLBACK_PATH, `${publicAppOrigin()}/`).toString();
}

function signingKey() {
  const key = process.env.JWT_SECRET;
  if (!key) throw new Error("Chave de assinatura indisponível.");
  return key;
}

function signature(value: string) {
  return createHmac("sha256", signingKey()).update(value).digest("base64url");
}

function serializePendingAuthorization(pending: PendingAuthorization) {
  const payload = `${pending.state}.${pending.userId}`;
  return `${payload}.${signature(payload)}`;
}

function readCookie(req: Request, name: string) {
  const value = req.headers.cookie
    ?.split(";")
    .map(item => item.trim())
    .find(item => item.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  return value ? decodeURIComponent(value) : null;
}

function parsePendingAuthorization(value: string | null) {
  if (!value) return null;
  const [state, userId, receivedSignature] = value.split(".");
  if (!state || !userId || !receivedSignature) return null;
  const expectedSignature = signature(`${state}.${userId}`);
  const left = Buffer.from(expectedSignature);
  const right = Buffer.from(receivedSignature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return { state, userId } satisfies PendingAuthorization;
}

function spotifyCredentials() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "A criação de playlist ainda não está configurada.",
    });
  }
  return { clientId, clientSecret };
}

export async function createPlaylistAuthorization(
  req: Request,
  res: Response,
  accessToken: string
) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Sessão indisponível." });
  }
  const identityClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data, error } = await identityClient.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sua sessão expirou. Entre novamente." });
  }

  const { clientId } = spotifyCredentials();
  const callbackUrl = getSpotifyPlaylistCallbackUrl();
  const state = randomUUID();
  res.cookie(STATE_COOKIE, serializePendingAuthorization({ state, userId: data.user.id }), {
    httpOnly: true,
    maxAge: 10 * 60 * 1_000,
    path: "/",
    sameSite: "lax",
    secure: true,
  });

  const authorizationUrl = new URL("https://accounts.spotify.com/authorize");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("redirect_uri", callbackUrl);
  authorizationUrl.searchParams.set("scope", PLAYLIST_SCOPE);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("show_dialog", "true");
  return { authorizationUrl: authorizationUrl.toString() };
}

function returnToMusic(res: Response, message: string) {
  const target = new URL(publicAppOrigin());
  target.searchParams.set("tab", "musica");
  target.searchParams.set("spotify_playlist_error", message);
  res.redirect(target.toString());
}

export function registerSpotifyPlaylistRoutes(app: Express) {
  app.get(CALLBACK_PATH, async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;
    const pending = parsePendingAuthorization(readCookie(req, STATE_COOKIE));
    res.clearCookie(STATE_COOKIE, { httpOnly: true, path: "/", sameSite: "lax", secure: true });
    if (!code || !state || !pending || pending.state !== state) {
      returnToMusic(res, "Não foi possível confirmar a autorização Spotify.");
      return;
    }

    try {
      const { clientId, clientSecret } = spotifyCredentials();
      const callbackUrl = getSpotifyPlaylistCallbackUrl();
      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: callbackUrl }),
      });
      const token = (await tokenResponse.json()) as { access_token?: string };
      if (!tokenResponse.ok || !token.access_token) throw new Error("spotify-token");

      const playlistResponse = await fetch("https://api.spotify.com/v1/me/playlists", {
        method: "POST",
        headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Nossa playlist • Caderno de Dois",
          description: "Uma playlist privada criada pelo Caderno de Dois.",
          public: false,
        }),
      });
      const playlist = (await playlistResponse.json()) as { external_urls?: { spotify?: string } };
      const url = playlist.external_urls?.spotify;
      if (!playlistResponse.ok || !url || !/^https:\/\/(open\.spotify\.com|spotify\.link)\//.test(url)) {
        throw new Error("spotify-playlist");
      }

      res.redirect(url);
    } catch {
      returnToMusic(res, "Não foi possível criar a playlist agora. Tente novamente.");
    }
  });
}
