import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const homeSource = readFileSync(
  resolve(projectRoot, "client/src/pages/Home.tsx"),
  "utf8"
);
const manifest = JSON.parse(
  readFileSync(
    resolve(projectRoot, "client/public/manifest.webmanifest"),
    "utf8"
  )
) as { shortcuts?: Array<{ short_name?: string; url?: string }> };

describe("atalho instalável do contador", () => {
  it("declara um atalho PWA que abre diretamente a aba Tempo", () => {
    expect(manifest.shortcuts).toContainEqual(
      expect.objectContaining({
        short_name: "Contador",
        url: "/?tab=contagem",
      })
    );
  });

  it("preserva uma ação acessível de instalação e as instruções por plataforma", () => {
    expect(homeSource).toContain("handleAddCounterToHome");
    expect(homeSource).toContain("beforeinstallprompt");
    expect(homeSource).toContain("Adicionar à Tela de Início");
    expect(homeSource).toContain("mantenha o ícone pressionado");
  });
});
