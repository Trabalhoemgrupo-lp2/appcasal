import webpush from "web-push";
import { describe, expect, it } from "vitest";

describe("configuração privada de VAPID", () => {
  it("aceita o par de chaves configurado para assinar notificações Web Push", () => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    expect(publicKey).toMatch(/^B[A-Za-z0-9_-]{40,}$/);
    expect(privateKey).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(() => webpush.setVapidDetails("mailto:push@appcasal.local", publicKey!, privateKey!)).not.toThrow();
  });
});
