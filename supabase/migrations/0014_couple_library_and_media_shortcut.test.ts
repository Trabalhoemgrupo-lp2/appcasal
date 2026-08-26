import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0014_couple_library_and_media_shortcut.sql"),
  "utf8"
);

describe("migration da biblioteca compartilhada", () => {
  it("mantém livros e filmes isolados pelo casal com RLS", () => {
    expect(migration).toContain("create table if not exists public.couple_library_items");
    expect(migration).toContain("enable row level security");
    expect(migration).toMatch(/item_type\s+text\s+not null\s+check \(item_type in \('book', 'movie'\)\)/i);
    expect(migration).toContain("public.is_couple_member(couple_id)");
  });

  it("restringe criação e alteração ao autor autenticado", () => {
    expect(migration).toContain("author_id = auth.uid()");
    expect(migration).toContain("for delete");
    expect(migration).toContain("for update");
  });
});
