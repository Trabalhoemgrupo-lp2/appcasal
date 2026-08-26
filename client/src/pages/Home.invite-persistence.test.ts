import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(
  new URL("./Home.tsx", import.meta.url),
  "utf8"
);

describe("convite persistente", () => {
  it("restaura apenas o convite pendente e não expirado criado pela própria pessoa", () => {
    expect(homeSource).toContain('.from("partner_invites")');
    expect(homeSource).toContain('.eq("invited_by", currentSession.user.id)');
    expect(homeSource).toContain('.eq("status", "pending")');
    expect(homeSource).toContain('.gt("expires_at", new Date().toISOString())');
    expect(homeSource).toContain('setInviteCode(data?.code ?? "")');
  });

  it("mantém o código visível e oferece cópia repetida e geração de novo convite", () => {
    expect(homeSource).toContain(
      "const hasCompleteCouple = isPreview ? false : coupleMembers.length >= 2;"
    );
    expect(homeSource).toContain("Código para enviar ao seu par");
    expect(homeSource).toContain("copiar novamente");
    expect(homeSource).toContain("gerar novo");
  });
});
