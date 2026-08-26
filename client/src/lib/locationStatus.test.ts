import { describe, expect, it } from "vitest";
import {
  formatLocationAccuracy,
  formatLocationDistance,
  getLocationStatus,
} from "./locationStatus";

describe("status da localização compartilhada", () => {
  const now = Date.parse("2026-08-25T18:00:00.000Z");

  it("classifica uma posição atualizada nos últimos dois minutos como ao vivo", () => {
    expect(getLocationStatus("2026-08-25T17:59:10.000Z", now)).toEqual({
      freshness: "live",
      label: "ao vivo",
      detail: "atualizado agora",
    });
  });

  it("classifica uma posição com poucos minutos como recente", () => {
    expect(getLocationStatus("2026-08-25T17:57:00.000Z", now)).toEqual({
      freshness: "recent",
      label: "recente",
      detail: "atualizado há 3 min",
    });
  });

  it("classifica uma posição antiga ou inválida como desatualizada", () => {
    expect(getLocationStatus("2026-08-25T17:32:00.000Z", now)).toEqual({
      freshness: "stale",
      label: "desatualizado",
      detail: "atualizado há 28 min",
    });
    expect(getLocationStatus("não disponível", now).freshness).toBe("stale");
  });

  it("formata a precisão em metros ou quilômetros e rejeita valores inválidos", () => {
    expect(formatLocationAccuracy(18.4)).toBe("±18 m");
    expect(formatLocationAccuracy(1_250)).toBe("±1,3 km");
    expect(formatLocationAccuracy(null)).toBeNull();
    expect(formatLocationAccuracy(-1)).toBeNull();
    expect(formatLocationDistance(420)).toBe("420 m de distância");
    expect(formatLocationDistance(1_250)).toBe("1,3 km de distância");
    expect(formatLocationDistance(null)).toBeNull();
  });
});
