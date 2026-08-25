import { describe, expect, it } from "vitest";
import { createContentPushPayload, isPushNotificationKind } from "./contentNotificationScheduler";

describe("contentNotificationScheduler", () => {
  it("restringe a entrega aos tipos privados de novidades aceitos", () => {
    expect(isPushNotificationKind("plan_created")).toBe(true);
    expect(isPushNotificationKind("movie_added")).toBe(true);
    expect(isPushNotificationKind("location_started")).toBe(false);
  });

  it("direciona cada aviso para a aba correspondente sem enviar o título privado no payload", () => {
    expect(createContentPushPayload({ id: "notice-book", kind: "book_added" })).toEqual({
      title: "Caderno de Dois",
      body: "Uma nova leitura foi adicionada ao Caderno.",
      url: "/?tab=leituras",
      tag: "couple-notification-notice-book",
    });
    expect(createContentPushPayload({ id: "notice-music", kind: "music_added" }).url).toBe("/?tab=musica");
  });
});
