import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0010_music_room_covers_reactions_reminders.sql"),
  "utf8",
);
const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("migration 0010 da Sala Spotify", () => {
  it("cria a capa privada, as reações e o agendamento de escuta", () => {
    expect(migration).toContain("music-room-covers");
    expect(migration).toContain("create table if not exists public.couple_music_reactions");
    expect(migration).toContain("add column if not exists cover_path text");
    expect(migration).toContain("add column if not exists listen_at timestamptz");
    expect(migration).toContain("add column if not exists reminder_note text");
  });

  it("mantém o acesso limitado aos dois membros do casal", () => {
    expect(migration).toContain("couple_music_reactions_select_member");
    expect(migration).toContain("couple_music_reactions_insert_member");
    expect(migration).toContain("music_room_covers_select_member");
    expect(migration).toContain("enable row level security");
  });

  it("compara o proprietário do Storage com o tipo compatível do Supabase", () => {
    expect(migration).toContain("owner_id = auth.uid()::text");
    expect(migration).not.toContain("owner_id = auth.uid()\n");
  });

  it("alinha a capa e os eventos em tempo real às regras privadas", () => {
    expect(home).toContain("`${musicRoom.couple_id}/${authData.user.id}/cover-");
    expect(home).toContain('table: "couple_music_reactions"');
    expect(home).toContain("filter: `couple_id=eq.${musicRoom.couple_id}`");
    expect(home).toContain("musicRoom.updated_at");
  });

  it("oferece vínculo Spotify individual sem persistir token no casal", () => {
    expect(home).toMatch(/linkIdentity\(\{\s*provider: "spotify"/);
    expect(home).toContain('scopes: "user-read-email user-read-private"');
    expect(home).toContain("A conexão é individual.");
    expect(home).not.toContain("spotify_access_token");
  });
});
