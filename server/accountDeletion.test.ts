import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const cleanupSource = readFileSync(resolve(process.cwd(), "server/accountDeletion.ts"), "utf8");

describe("exclusão definitiva de conta Supabase", () => {
  it("valida a pessoa pelo token da sessão antes de executar qualquer exclusão administrativa", () => {
    expect(routerSource).toContain("identityClient.auth.getUser(input.accessToken)");
    expect(routerSource).toContain("if (identityError || !identity.user)");
    expect(routerSource).toContain('code: "UNAUTHORIZED"');
  });

  it("remove os registros que bloqueiam a cascata do perfil e as mídias privadas da conta", () => {
    expect(cleanupSource).toContain('"posts"');
    expect(cleanupSource).toContain('"messages"');
    expect(cleanupSource).toContain('"plans"');
    expect(cleanupSource).toContain('"partner_invites"');
    expect(cleanupSource).toContain('"favorite_places"');
    expect(cleanupSource).toContain('.eq("owner_id", userId)');
    expect(cleanupSource).toContain('"memory-photos"');
    expect(cleanupSource).toContain('"profile-avatars"');
    expect(cleanupSource).toContain('"music-room-covers"');
  });

  it("remove a Sala Spotify da conta que a hospedava em vez de alterar a autoria protegida", () => {
    expect(cleanupSource).toContain('.from("couple_music_rooms")');
    expect(cleanupSource).toContain('.delete()');
    expect(cleanupSource).toContain('.eq("host_id", userId)');
    expect(cleanupSource).not.toContain('.update({ host_id: partnerId })');
  });

  it("faz hard delete da identidade, liberando o e-mail para uma nova conta sem histórico", () => {
    expect(routerSource).toContain("admin.auth.admin.deleteUser(identity.user.id, false)");
    expect(routerSource).toContain("removeAccountData(admin, identity.user.id)");
  });
});
