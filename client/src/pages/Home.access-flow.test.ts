// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  EmailConfirmationView,
  getInitialAppTab,
  getSignupDestination,
  getSpotifyContinuationUrl,
  getSpotifyLinkOptions,
  LoginView,
  PUBLIC_APP_ORIGIN,
} from "./Home";

const homeSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Home.tsx"),
  "utf8"
);

describe("fluxo de acesso do Caderno de Dois", () => {
  it("encaminha o cadastro com sessão imediata para o espaço do caderno", () => {
    const session = { access_token: "token" } as Parameters<typeof getSignupDestination>[0];
    expect(getSignupDestination(session)).toBe("workspace");
  });

  it("encaminha o cadastro sem sessão para a confirmação de e-mail", () => {
    expect(getSignupDestination(null)).toBe("email-confirmation");
  });

  it("envia o cadastro pelo formulário ao confirmar com Enter", async () => {
    const user = userEvent.setup();
    const onAuth = vi.fn().mockResolvedValue(undefined);
    render(createElement(LoginView, { onAuth, onPreview: vi.fn() }));

    await user.click(screen.getByRole("button", { name: "Ainda não tenho conta" }));
    await user.type(screen.getByLabelText("Seu nome"), "Júlia");
    await user.type(screen.getByLabelText("E-mail"), "julia@exemplo.com");
    await user.type(screen.getByLabelText("Senha"), "segredo123{enter}");

    expect(onAuth).toHaveBeenCalledWith("signup", "julia@exemplo.com", "segredo123", "Júlia");
  });

  it("renderiza a tela de confirmação fora do formulário de acesso", () => {
    const html = renderToStaticMarkup(createElement(EmailConfirmationView, { email: "amor@exemplo.com", onBack: () => undefined }));
    expect(html).toContain("O primeiro capítulo já começou.");
    expect(html).toContain("amor@exemplo.com");
    expect(html).not.toContain("Entrar no espaço de vocês");
  });

  it("inicia a conexão Spotify com retorno somente ao domínio público", () => {
    expect(getSpotifyLinkOptions()).toEqual({
      redirectTo: `${PUBLIC_APP_ORIGIN}?spotify_return=1`,
      scopes: "user-read-email user-read-private",
    });
    expect(getSpotifyLinkOptions().redirectTo).toBe(
      "https://appcasal-kzzvckwa.manus.space?spotify_return=1"
    );
  });

  it("mantém a conexão Spotify como uma vinculação à sessão já autenticada", () => {
    expect(homeSource).toContain("supabase.auth.linkIdentity({");
    expect(homeSource).toContain('provider: "spotify"');
    expect(homeSource).toContain("...getSpotifyLinkOptions(),");
    expect(homeSource).toContain("skipBrowserRedirect: true");
    expect(homeSource).toContain("window.location.assign(data.url)");
    expect(homeSource).toContain("client.auth.getUserIdentities()");
    expect(homeSource).toContain('get("spotify_return") === "1"');
    expect(homeSource).toContain("spotifyConnectionStorageKey(currentSession.user.id)");
    expect(homeSource).toContain(
      "window.location.assign(getSpotifyContinuationUrl(musicRoom?.jam_url))"
    );
    expect(homeSource).toContain(
      'window.sessionStorage.setItem(SPOTIFY_LINK_RETURN_KEY, "pending")'
    );
  });

  it("abre somente uma Sala Spotify válida ou a biblioteca de playlists após a autorização", () => {
    expect(getSpotifyContinuationUrl("https://open.spotify.com/playlist/abc")).toBe(
      "https://open.spotify.com/playlist/abc"
    );
    expect(getSpotifyContinuationUrl("https://example.com/playlist")).toBe(
      "https://open.spotify.com/collection/playlists"
    );
    expect(getSpotifyContinuationUrl(null)).toBe(
      "https://open.spotify.com/collection/playlists"
    );
  });

  it("abre um convite público diretamente na área de entrada do casal", () => {
    expect(getInitialAppTab("?invite=convite-privado")).toBe("mais");
    expect(getInitialAppTab("?tab=chat&invite=convite-privado")).toBe(
      "mais"
    );
    expect(PUBLIC_APP_ORIGIN).toBe("https://appcasal-kzzvckwa.manus.space");
  });
});
