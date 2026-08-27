import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("abas dedicadas", () => {
  it("mantém a localização como destino de navegação dedicado", () => {
    expect(home).toMatch(/type AppTab\s*=\s*\|\s*"inicio"\s*\|\s*"momentos"\s*\|\s*"chat"\s*\|\s*"planos"\s*\|\s*"contagem"\s*\|\s*"musica"\s*\|\s*"widgets"\s*\|\s*"localizacao"\s*\|\s*"leituras"\s*\|\s*"filmes"\s*\|\s*"mais"/);
    expect(home).toMatch(/\{\s*id: "localizacao",\s*label: "Mapa",\s*icon: MapPin\s*\}/);
  });

  it("renderiza o mapa na área principal, em vez de um painel flutuante", () => {
    expect(home).toContain('{tab === "localizacao" && (');
    expect(home).toContain("<LocationTab");
    expect(home).not.toContain("<FloatingLocation");
  });

  it("mantém os widgets na área principal para evitar uma aba vazia", () => {
    expect(home).toContain('{tab === "widgets" && (');
    expect(home).toContain("<WidgetsPanel");
    expect(home).not.toContain("renderWidgetsTab");
  });

  it("mantém o tempo de relacionamento como aba direta e configurável", () => {
    expect(home).toMatch(/\{\s*id: "contagem",\s*label: "Tempo",\s*icon: Heart\s*\}/);
    expect(home).toContain('{tab === "contagem" && (');
    expect(home).toContain("<RelationshipCounterPanel");
    expect(home).toContain("onSaveRelationshipDate={handleSaveRelationshipDate}");
  });

  it("mantém a Galeria privada com seleção reversível para o atalho", () => {
    expect(home).toMatch(/\{\s*id: "momentos",\s*label: "Galeria",\s*icon: Camera\s*\}/);
    expect(home).toContain('{tab === "momentos" && (');
    expect(home).toContain("<MomentsPanel");
    expect(home).toContain("onUploadFiles={files =>");
    expect(home).toContain("ACCEPTED_MEMORY_MEDIA_TYPES");
    expect(home).toContain("downloadMedia");
  });

  it("mantém Leituras e Filmes como listas compartilhadas em superfícies diretas", () => {
    expect(home).toMatch(/\{\s*id: "leituras",\s*label: "Leituras",\s*icon: BookOpen\s*\}/);
    expect(home).toMatch(/\{\s*id: "filmes",\s*label: "Filmes",\s*icon: Clapperboard\s*\}/);
    expect(home).toContain('{tab === "leituras" && (');
    expect(home).toContain('{tab === "filmes" && (');
    expect(home).toContain('<LibraryPanel');
    expect(home).toContain('handleAddLibraryItem("book")');
    expect(home).toContain('handleAddLibraryItem("movie")');
  });
});
