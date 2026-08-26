import { describe, expect, it } from "vitest";

const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const canValidateCredentials = Boolean(spotifyClientId && spotifyClientSecret);
const runLiveSpotifyTests = process.env.RUN_LIVE_SPOTIFY_TESTS === "1";

describe("credenciais de servidor do Spotify", () => {
  const verifiesCredentials = canValidateCredentials && runLiveSpotifyTests ? it : it.skip;

  verifiesCredentials("obtém um token de aplicação sem expor os segredos", async () => {
    const credentials = Buffer.from(
      `${spotifyClientId}:${spotifyClientSecret}`
    ).toString("base64");

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    expect(response.ok).toBe(true);

    const payload = (await response.json()) as {
      access_token?: string;
      token_type?: string;
    };

    expect(payload.access_token).toEqual(expect.any(String));
    expect(payload.token_type).toBe("Bearer");
  }, 20_000);
});
