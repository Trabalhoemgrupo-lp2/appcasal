import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getSpotifyPlaylistCallbackUrl } from "./spotifyPlaylists";

const source = readFileSync(
  resolve(process.cwd(), "server/spotifyPlaylists.ts"),
  "utf8"
);

const originalPublicOrigin = process.env.APP_PUBLIC_ORIGIN;

afterEach(() => {
  if (originalPublicOrigin === undefined) {
    delete process.env.APP_PUBLIC_ORIGIN;
  } else {
    process.env.APP_PUBLIC_ORIGIN = originalPublicOrigin;
  }
});

describe("criação privada de playlist Spotify", () => {
  it("solicita somente o escopo de escrita para playlists privadas", () => {
    expect(source).toContain('const PLAYLIST_SCOPE = "playlist-modify-private"');
    expect(source).toContain("public: false");
  });

  it("redireciona apenas para a URL Spotify validada após criar a playlist", () => {
    expect(source).toContain(
      'if (!playlistResponse.ok || !url || !/^https:\\/\\/(open\\.spotify\\.com|spotify\\.link)\\//.test(url))'
    );
    expect(source).toContain("res.redirect(url);");
  });

  it("usa a origem pública configurada e a mesma URI no callback Spotify", () => {
    process.env.APP_PUBLIC_ORIGIN = "https://preview.example.com/";
    expect(getSpotifyPlaylistCallbackUrl()).toBe(
      "https://preview.example.com/api/spotify/callback"
    );
    expect(source).toContain("const callbackUrl = getSpotifyPlaylistCallbackUrl();");
  });

  it("rejeita uma origem pública HTTP fora de localhost", () => {
    process.env.APP_PUBLIC_ORIGIN = "http://preview.example.com";
    expect(() => getSpotifyPlaylistCallbackUrl()).toThrow(/HTTPS/);
  });
});
