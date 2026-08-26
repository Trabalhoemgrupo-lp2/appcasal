import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Home.tsx"),
  "utf8"
);

describe("campos de data com ano completo", () => {
  it("usa o campo digitável DD/MM/AAAA para relacionamento e estreia", () => {
    expect(homeSource).toContain("BrazilianDateInput");
    expect(homeSource).toContain('placeholder="DD/MM/AAAA"');
    expect(homeSource).toContain('inputMode="numeric"');
  });

  it("continua validando antes de persistir datas do relacionamento e de filmes", () => {
    expect(homeSource).toContain("!hasFourDigitYear(libraryReleaseDraft)");
    expect(homeSource).toContain("if (value && !hasFourDigitYear(value))");
  });
});
