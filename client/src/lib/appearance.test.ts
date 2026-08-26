import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACCENT_OPTIONS,
  applyAppearanceToDocument,
  defaultAppearance,
  readAppearancePreference,
  resolveAppearanceMode,
  serializeAppearancePreference,
} from "./appearance";

const globalStyles = readFileSync(
  resolve(process.cwd(), "client/src/index.css"),
  "utf8"
);

function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map(value => Number.parseInt(value, 16) / 255)
    .map(value =>
      value <= 0.04045
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4)
    );
  return (
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  );
}

function contrastWithWhite(hex: string) {
  return 1.05 / (luminance(hex) + 0.05);
}

describe("preferências de aparência", () => {
  it("lê escolhas válidas e retorna a opção serena padrão para conteúdo inválido", () => {
    expect(
      readAppearancePreference('{"mode":"system","accent":"sage"}')
    ).toEqual({ mode: "system", accent: "sage" });
    expect(readAppearancePreference('{"mode":"neon"}')).toEqual(
      defaultAppearance
    );
  });

  it("resolve o modo automático conforme a preferência do dispositivo", () => {
    expect(resolveAppearanceMode("system", true)).toBe("dark");
    expect(resolveAppearanceMode("system", false)).toBe("light");
    expect(resolveAppearanceMode("dark", false)).toBe("dark");
  });

  it("persiste e aplica atributos de aparência no documento", () => {
    expect(
      serializeAppearancePreference({ mode: "dark", accent: "plum" })
    ).toBe('{"mode":"dark","accent":"plum"}');

    const state = { dark: false };
    const root = {
      classList: {
        toggle: (_name: string, force?: boolean) => {
          state.dark = Boolean(force);
        },
      },
      dataset: {} as Record<string, string | undefined>,
      style: { colorScheme: "" },
    };
    applyAppearanceToDocument(root, "plum", "dark");

    expect(state.dark).toBe(true);
    expect(root.dataset.accent).toBe("plum");
    expect(root.style.colorScheme).toBe("dark");
  });

  it("mantém contraste AA para rótulos brancos sobre cada cor de destaque", () => {
    ACCENT_OPTIONS.forEach(option => {
      expect(contrastWithWhite(option.swatch)).toBeGreaterThanOrEqual(4.5);
    });
  });

  it("mantém papel, tinta e superfícies globais no mesmo modo noturno", () => {
    expect(globalStyles).toContain("--color-paper: var(--paper)");
    expect(globalStyles).toContain("--color-ink: var(--ink)");
    expect(globalStyles).toContain("--paper: #1e1b22");
    expect(globalStyles).toContain("--ink: #f8f2f4");
    expect(globalStyles).toContain("html { background: var(--background); overflow-x: hidden; }");
    expect(globalStyles).toContain("body { @apply bg-background font-sans text-foreground antialiased; min-width: 320px; overflow-x: hidden; }");
    expect(globalStyles).toContain(".dark aside.fixed.inset-y-0.left-0");
  });
});
