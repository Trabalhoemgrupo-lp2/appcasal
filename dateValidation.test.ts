import { describe, expect, it } from "vitest";
import {
  formatBrazilianDateInput,
  formatBrazilianDateTyping,
  hasFourDigitYear,
  parseBrazilianDateInput,
} from "./dateValidation";

describe("hasFourDigitYear", () => {
  it("aceita datas ISO com ano de quatro dígitos", () => {
    expect(hasFourDigitYear("2026-08-21")).toBe(true);
    expect(hasFourDigitYear("1000-01-01")).toBe(true);
  });

  it("recusa ano abreviado, ausente ou fora da faixa de quatro dígitos", () => {
    expect(hasFourDigitYear("26-08-21")).toBe(false);
    expect(hasFourDigitYear("026-08-21")).toBe(false);
    expect(hasFourDigitYear("0000-08-21")).toBe(false);
    expect(hasFourDigitYear("")).toBe(false);
  });
});

describe("entrada brasileira de data", () => {
  it("formata uma data persistida para DD/MM/AAAA", () => {
    expect(formatBrazilianDateInput("2024-06-23")).toBe("23/06/2024");
  });

  it("limpa uma data legada com ano inválido para que possa ser corrigida", () => {
    expect(formatBrazilianDateInput("0006-06-23")).toBe("");
  });

  it("insere separadores sem interromper a digitação de 2024", () => {
    expect(formatBrazilianDateTyping("23062024")).toBe("23/06/2024");
    expect(formatBrazilianDateTyping("23/06/2024")).toBe("23/06/2024");
  });

  it("converte apenas datas reais com ano completo para ISO", () => {
    expect(parseBrazilianDateInput("23/06/2024")).toBe("2024-06-23");
    expect(parseBrazilianDateInput("29/02/2024")).toBe("2024-02-29");
    expect(parseBrazilianDateInput("31/02/2024")).toBeNull();
    expect(parseBrazilianDateInput("23/06/024")).toBeNull();
  });
});
