import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("migration 0002 — políticas de fotos privadas", () => {
  it("compara o dono do objeto Storage como texto, compatível com o schema atual", async () => {
    const sql = await readFile(
      new URL("../supabase/migrations/0002_shared_plans_media_invites.sql", import.meta.url),
      "utf8",
    );

    expect(sql).toContain("owner_id = (select auth.uid()::text)");
    expect(sql).not.toContain("owner_id = auth.uid()");
  });
});

describe("migration 0007 — políticas de avatares privados", () => {
  it("compara o dono do objeto Storage como texto, compatível com o schema atual", async () => {
    const sql = await readFile(
      new URL("../supabase/migrations/0007_map_places_categories_and_avatars.sql", import.meta.url),
      "utf8",
    );

    expect(sql).toContain("owner_id = (select auth.uid()::text)");
    expect(sql).not.toContain("owner_id = auth.uid()");
  });
});
