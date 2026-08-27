import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("galeria de fotos e vídeos", () => {
  it("aceita formatos de vídeo com limite separado das fotos", () => {
    expect(home).toContain("MAX_VIDEO_BYTES = 50 * 1024 * 1024");
    expect(home).toContain('"video/mp4"');
    expect(home).toContain('"video/webm"');
    expect(home).toContain('"video/quicktime"');
  });

  it("mantém visualização ampliada, navegação e download", () => {
    expect(home).toContain('aria-label="Visualizador da galeria"');
    expect(home).toContain('aria-label="Mídia anterior"');
    expect(home).toContain('aria-label="Próxima mídia"');
    expect(home).toContain('aria-label="Baixar mídia"');
    expect(home).toContain("downloadMedia");
  });

  it("oferece filtros de período, seleção múltipla e busca", () => {
    expect(home).toContain('"years" | "months" | "all"');
    expect(home).toContain("'Anos'");
    expect(home).toContain("'Meses'");
    expect(home).toContain("'Tudo'");
    expect(home).toContain('placeholder="Buscar por pessoa ou legenda"');
    expect(home).toContain('aria-label="Baixar mídias selecionadas"');
    expect(home).toContain('aria-label="Excluir mídias selecionadas"');
  });
});
