import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("estrutura responsiva do Caderno de Dois", () => {
  it("preserva uma área principal fluida e evita o corte do título em telas estreitas", () => {
    expect(home).toContain("max-w-[calc(100vw-6.5rem)] truncate");
    expect(home).toContain("relative z-10 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-5 sm:px-5 sm:pb-28 sm:pt-7");
    expect(home).toContain('<section className="min-w-0">');
  });

  it("mantém os widgets em uma coluna antes do ponto de quebra amplo", () => {
    expect(home).toContain('className="grid gap-3 sm:gap-4 lg:grid-cols-3"');
    expect(home).toContain('className="mt-6 grid gap-4 sm:gap-5 lg:grid-cols-2"');
    expect(home).toContain("min-h-10 rounded-lg border px-3 py-2");
  });

  it("protege o documento contra transbordamento e reduz detalhes decorativos no celular", () => {
    expect(styles).toContain("html { background: var(--background); overflow-x: hidden; }");
    expect(styles).toContain("body { @apply bg-background font-sans text-foreground antialiased; min-width: 320px; overflow-x: hidden; }");
    expect(styles).toContain("@media (max-width: 639px)");
  });

  it("permite alcançar todas as abas pela rolagem do menu lateral e do painel móvel", () => {
    expect(home).toContain('aria-label="Navegação principal"');
    expect(home).toContain("overflow-y-auto overscroll-contain pr-1 pb-5");
    expect(home).toContain('aria-label="Navegação do menu"');
    expect(home).toContain("overflow-y-auto overscroll-contain pr-1 pb-4");
    expect(home).toContain("tabIndex={0}");
  });

  it("reserva a safe area e mantém alvos de toque acessíveis na navegação móvel", () => {
    expect(home).toContain("bottom-[calc(0.75rem+env(safe-area-inset-bottom))]");
    expect(home).toContain("pb-[max(0.5rem,env(safe-area-inset-bottom))]");
    expect(home).toContain("touch-pan-x");
    expect(home).toContain("min-h-11 min-w-[4.4rem]");
  });
});
