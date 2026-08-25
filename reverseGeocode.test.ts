import { describe, expect, it } from "vitest";
import { parseReverseGeocodeResponse } from "./reverseGeocode";

describe("geocodificação reversa", () => {
  it("converte a resposta em nome do lugar e endereço", () => {
    expect(
      parseReverseGeocodeResponse({
        locality: "Belo Horizonte",
        city: "Belo Horizonte",
        principalSubdivision: "Minas Gerais",
        postcode: "30130-000",
        countryName: "Brasil",
      })
    ).toEqual({
      name: "Belo Horizonte",
      address: "Belo Horizonte, Minas Gerais, 30130-000, Brasil",
    });
  });

  it("usa fallback quando o provedor não retorna endereço", () => {
    expect(parseReverseGeocodeResponse({})).toEqual({
      name: "Localização atual",
      address: "Endereço não identificado",
    });
  });
});
