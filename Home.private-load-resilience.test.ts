import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(
  new URL("./Home.tsx", import.meta.url),
  "utf8"
);

describe("carregamento privado resiliente", () => {
  it("não interrompe todo o caderno por uma consulta privada isolada", () => {
    expect(homeSource).not.toContain(
      'toast.error("Não foi possível carregar os dados privados agora.")'
    );
    expect(homeSource).toContain("const unavailablePrivateAreas = [");
    expect(homeSource).toContain("libraryError && \"biblioteca\"");
  });

  it("mantém o diagnóstico técnico fora da experiência de produção", () => {
    expect(homeSource).toContain("import.meta.env.DEV");
    expect(homeSource).toContain(
      'console.warn("Algumas áreas privadas não puderam ser atualizadas.")'
    );
  });
});
