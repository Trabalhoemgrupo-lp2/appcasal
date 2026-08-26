import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("gestão de conta", () => {
  it("oferece uma saída local que encerra rastreadores e limpa a sessão deste dispositivo", () => {
    expect(home).toContain('"sair da conta"');
    expect(home).toContain("clearLocalPrivacyData(");
    expect(home).toContain('supabase.auth.signOut({ scope: "local" })');
  });

  it("requer confirmação textual explícita antes de habilitar a exclusão", () => {
    expect(home).toContain('Digite <span className="font-mono text-hibiscus">EXCLUIR</span> para confirmar');
    expect(home).toContain('disabled={deleteConfirmation !== "EXCLUIR" || deletingAccount}');
    expect(home).toContain('aria-label="Confirme a exclusão digitando EXCLUIR"');
  });

  it("renova o token no instante da exclusão e retorna a pessoa ao acesso limpo", () => {
    expect(home).toContain("trpc.account.delete.useMutation()");
    expect(home).toContain("await supabase.auth.refreshSession()");
    expect(home).toContain("accessToken: refreshed.session.access_token");
    expect(home).toContain('confirmation: "EXCLUIR"');
    expect(home).toContain("window.history.replaceState({}, \"\", PUBLIC_APP_ORIGIN)");
  });
});
