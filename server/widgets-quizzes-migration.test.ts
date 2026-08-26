import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/0011_couple_widgets_and_quizzes.sql"), "utf8");
const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("migration 0011 de widgets e quizzes", () => {
  it("cria snapshots voluntários e respostas privadas do casal", () => {
    expect(migration).toContain("create table if not exists public.couple_widget_battery_snapshots");
    expect(migration).toContain("create table if not exists public.couple_widget_weather");
    expect(migration).toContain("create table if not exists public.couple_quiz_answers");
    expect(migration).toContain("primary key (couple_id, quiz_key, question_key, user_id)");
  });

  it("mantém os widgets isolados por casal e o quiz lacrado antes da resposta própria", () => {
    expect(migration).toContain("couple_widget_battery_update_owner");
    expect(migration).toContain("couple_widget_weather_update_member");
    expect(migration).toContain("couple_quiz_answers_select_revealed_member");
    expect(migration).toContain("own_answer.user_id = auth.uid()");
    expect(migration).toContain("enable row level security");
  });

  it("liga a interface aos fluxos opt-in de bateria, clima e resposta individual", () => {
    expect(home).toContain("getBattery");
    expect(home).toContain("geocoding-api.open-meteo.com");
    expect(home).toContain("couple_widget_battery_snapshots");
    expect(home).toContain("couple_quiz_answers");
    expect(home).toContain("Resposta lacrada até a outra pessoa responder");
  });
});
