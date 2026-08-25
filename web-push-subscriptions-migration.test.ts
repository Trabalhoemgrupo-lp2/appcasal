import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0012_web_push_subscriptions.sql"),
  "utf8",
);

describe("migration 0012 — inscrições Web Push", () => {
  it("mantém a inscrição de dispositivo privada para o próprio usuário", () => {
    expect(sql).toContain("create table if not exists public.couple_web_push_subscriptions");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("user_id = auth.uid()");
    expect(sql).not.toContain("for select\nto authenticated\nusing (public.is_couple_member");
  });

  it("registra um identificador durável para o agendador protegido", () => {
    expect(sql).toContain("create table if not exists public.app_system_jobs");
    expect(sql).toContain("schedule_cron_task_uid varchar(65)");
    expect(sql).toContain("values ('music-web-push')");
  });
});
