import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("edição e exclusão de conteúdos", () => {
  it("mantém controles para corrigir ou apagar as próprias memórias", () => {
    expect(home).toContain("handleEditPost");
    expect(home).toContain("handleDeletePost");
    expect(home).toContain("post.author_id === currentUserId");
    expect(home).toContain("Apagar esta memória?");
  });

  it("permite corrigir ou apagar apenas mensagens e planos da própria autoria", () => {
    expect(home).toContain("handleEditMessage");
    expect(home).toContain("handleDeleteMessage");
    expect(home).toContain("message.sender_id === currentUserId");
    expect(home).toContain("handleEditPlan");
    expect(home).toContain("handleDeletePlan");
    expect(home).toContain("plan.created_by === currentUserId");
  });

  it("protege itens de leitura e filme do parceiro e pede confirmação para remoção", () => {
    expect(home).toContain("handleEditLibraryItem");
    expect(home).toContain("item.author_id === currentUserId");
    expect(home).toContain("Apagar “${item.title}” da lista?");
    expect(home).toContain("Apagar esta mensagem?");
    expect(home).toContain("Apagar o plano “${plan.title}”?");
  });
});
