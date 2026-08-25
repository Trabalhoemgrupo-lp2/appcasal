import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const status = readFileSync(
  resolve(process.cwd(), "client/src/lib/locationStatus.ts"),
  "utf8",
);

describe("experiência de localização compartilhada", () => {
  it("apresenta linguagem de compartilhamento ao vivo e uma atualização manual", () => {
    expect(home).toContain("compartilhamento ao vivo");
    expect(home).toContain("onRefresh={handleRefreshLocation}");
    expect(home).toContain("atualizar agora");
    expect(home).toContain("maximumAge: 0");
    expect(home).toContain("map.setZoom(17)");
    expect(home).toContain("sharedLocations.length === 1");
    expect(home).toContain('table: "couple_locations"');
    expect(home).toContain('table: "favorite_places"');
    expect(home).toContain("postgres_changes");
    expect(home).toContain("result.status === 400");
  });

  it("expõe status, precisão, última atualização e distância sem criar histórico", () => {
    expect(home).toContain('data-testid="location-status"');
    expect(home).toContain('data-testid="location-circle-summary"');
    expect(home).toContain('O círculo de vocês');
    expect(home).toContain('todos visíveis');
    expect(home).toContain("formatLocationAccuracy");
    expect(home).toContain("formatLocationDistance");
    expect(home).toContain("A posição pode não refletir o local atual");
    expect(status).toContain('export type LocationFreshness = "live" | "recent" | "stale"');
  });

  it("mostra a foto do participante e identifica o lugar salvo por proximidade", () => {
    expect(home).toContain("findSavedPlaceForLocation");
    expect(home).toContain("SAVED_PLACE_MATCH_RADIUS_METERS = 180");
    expect(home).toContain("está em ${savedPlace.title}");
    expect(home).toContain("{partnerName} está em");
    expect(home).toContain("Foto de ${member.name ?? \"membro\"}");
    expect(home).toContain("placeAddress");
    expect(home).toContain("address: placeAddress.trim() || null");
    expect(home).toContain("Rodovia Presidente Dutra, 2550");
  });

  it("preserva o contrato de pausa e a limpeza da coordenada", () => {
    expect(home).toContain("sharing_enabled: false");
    expect(home).toContain("latitude: null");
    expect(home).toContain("longitude: null");
    expect(home).toContain("histórico de trajetos");
  });
});
