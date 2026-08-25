// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signUp: vi.fn(),
}));

const accountDeletion = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
}));

const playlistAuthorization = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
}));

const emptyResult = { data: [], error: null };
const query = new Proxy(
  {
    then: (resolve: (value: typeof emptyResult) => unknown) => Promise.resolve(emptyResult).then(resolve),
  },
  {
    get: (target, key) => (key === "then" ? target.then : () => query),
  }
);

vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth,
    from: () => query,
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    account: {
      delete: {
        useMutation: () => accountDeletion,
      },
    },
    spotify: {
      createPlaylistAuthorization: {
        useMutation: () => playlistAuthorization,
      },
    },
    push: {
      publicKey: {
        useQuery: () => ({ data: null }),
      },
    },
  },
}));

import Home from "./Home";

async function submitSignup(email: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Ainda não tenho conta" }));
  await user.type(screen.getByLabelText("Seu nome"), "Júlia");
  await user.type(screen.getByLabelText("E-mail"), email);
  await user.type(screen.getByLabelText("Senha"), "segredo123");
  await user.click(screen.getByRole("button", { name: "Criar o nosso espaço" }));
}

describe("Home — desfechos reais do cadastro", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    auth.signUp.mockReset();
  });

  it("substitui o formulário pela confirmação quando o Supabase exige validar o e-mail", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    render(createElement(Home));

    await submitSignup("julia@exemplo.com");

    await waitFor(() => expect(screen.getByText("O primeiro capítulo já começou.")).toBeTruthy());
    expect(screen.getByText("julia@exemplo.com")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Entrar no espaço de vocês" })).toBeNull();
    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({
        emailRedirectTo: "https://appcasal-kzzvckwa.manus.space",
      }),
    }));
  });

  it("mostra a área inicial quando o Supabase devolve uma sessão no cadastro", async () => {
    auth.signUp.mockResolvedValue({ data: { session: { user: { id: "user-1", email: "julia@exemplo.com", user_metadata: {} } } }, error: null });
    render(createElement(Home));

    await submitSignup("julia@exemplo.com");

    await waitFor(() => expect(screen.getByRole("heading", { name: "Entre páginas, vocês" })).toBeTruthy());
    expect(screen.queryByText("O primeiro capítulo já começou.")).toBeNull();
  });
});
