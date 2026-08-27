import { describe, expect, it } from "vitest";
import { relationshipElapsed } from "./Home";

describe("contador vivo do relacionamento", () => {
  it("separa dias, horas, minutos e segundos", () => {
    const start = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
    const now = start + ((3 * 86_400 + 4 * 3_600 + 12 * 60 + 9) * 1_000);

    expect(relationshipElapsed("2024-01-01", now)).toEqual({
      days: 3,
      hours: 4,
      minutes: 12,
      seconds: 9,
    });
  });

  it("não aceita uma data inválida ou sem ano completo", () => {
    expect(relationshipElapsed("01/01/24", Date.now())).toBeNull();
    expect(relationshipElapsed("não é uma data", Date.now())).toBeNull();
  });
});
