import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("estrutura acessível das telas principais", () => {
  it("expõe a navegação móvel e comunica a página ativa", () => {
    expect(home).toContain('aria-label="Navegação móvel"');
    expect(home).toContain('aria-current={active ? "page" : undefined}');
    expect(home).toMatch(/navItems\.map\(item =>[\s\S]{0,900}type="button"/);
  });

  it("mantém ações iconográficas com rótulos acessíveis", () => {
    expect(home).toContain('aria-label="Enviar mensagem"');
    expect(home).toContain('aria-label="Abrir lembretes de proximidade"');
    expect(home).toContain('aria-label="Fechar avisos"');
  });

  it("permite identificar escolhas e estados nos controles do mapa", () => {
    expect(home).toContain("aria-pressed={ownAnswer?.answer_value === option}");
    expect(home).toContain('aria-label={`Editar ${place.title}`}');
    expect(home).toContain('aria-label={`Remover ${place.title}`}');
  });

  it("expõe tema e cor de destaque como escolhas nomeadas", () => {
    expect(home).toContain('aria-label="Modo de aparência"');
    expect(home).toContain('aria-label="Cor de destaque"');
    expect(home).toContain("aria-checked={active}");
    expect(home).toContain('aria-labelledby="appearance-heading"');
  });
});
