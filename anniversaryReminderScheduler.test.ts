import { describe, expect, it } from "vitest";
import { createAnniversaryPushPayload, isMilestoneDueOnDate } from "./anniversaryReminderScheduler";

describe("anniversaryReminderScheduler", () => {
  it("reconhece o mêsversário no dia 23 de cada mês", () => {
    expect(isMilestoneDueOnDate({ recurrence: "monthly", day_of_month: 23, month_of_year: null }, new Date("2026-08-23T12:00:00.000Z"))).toBe(true);
    expect(isMilestoneDueOnDate({ recurrence: "monthly", day_of_month: 23, month_of_year: null }, new Date("2026-08-22T12:00:00.000Z"))).toBe(false);
  });

  it("reconhece os marcos anuais somente no mês e dia corretos", () => {
    const anniversary = { recurrence: "yearly" as const, day_of_month: 23, month_of_year: 6 };
    expect(isMilestoneDueOnDate(anniversary, new Date("2026-06-23T12:00:00.000Z"))).toBe(true);
    expect(isMilestoneDueOnDate(anniversary, new Date("2026-07-23T12:00:00.000Z"))).toBe(false);
  });

  it("abre a contagem ao tocar no aviso de celebração", () => {
    expect(createAnniversaryPushPayload({ id: "milestone-23", label: "Nosso aniversário de namoro" })).toMatchObject({ url: "/?tab=contagem", tag: "celebration-milestone-23" });
  });
});
