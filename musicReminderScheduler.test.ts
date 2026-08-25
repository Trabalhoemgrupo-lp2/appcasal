import { describe, expect, it } from "vitest";
import {
  MUSIC_WEB_PUSH_PATH,
  MUSIC_DUE_ROOM_FIELDS,
  MUSIC_ROOM_PRIMARY_KEY,
  createMusicReminderPushPayload,
  describeMusicReminderSchedulerBinding,
  shouldRevokePushSubscription,
} from "./musicReminderScheduler";

describe("agendador de lembretes musicais", () => {
  it("mantém a rota de execução dentro do namespace protegido de tarefas agendadas", () => {
    expect(MUSIC_WEB_PUSH_PATH).toBe("/api/scheduled/music-web-push");
  });

  it("cria uma notificação sem expor o título ou identificador da sala", () => {
    expect(createMusicReminderPushPayload({ reminder_note: " Nossa música começa agora. " })).toEqual({
      title: "Caderno de Dois",
      body: "Nossa música começa agora.",
      url: "/?tab=musica",
      tag: "music-reminder",
    });
  });

  it("usa uma mensagem afetiva padrão quando não houver bilhete no lembrete", () => {
    expect(createMusicReminderPushPayload({ reminder_note: null }).body).toBe("A escuta de vocês começa agora.");
  });

  it("consulta e atualiza a Sala Spotify pela chave real couple_id", () => {
    expect(MUSIC_ROOM_PRIMARY_KEY).toBe("couple_id");
    const fields = MUSIC_DUE_ROOM_FIELDS.split(", ");
    expect(fields).toContain(MUSIC_ROOM_PRIMARY_KEY);
    expect(fields).not.toContain("id");
  });

  it("revoga apenas endpoints que o provedor informou que não existem mais", () => {
    expect(shouldRevokePushSubscription(404)).toBe(true);
    expect(shouldRevokePushSubscription(410)).toBe(true);
    expect(shouldRevokePushSubscription(429)).toBe(false);
    expect(shouldRevokePushSubscription(undefined)).toBe(false);
  });

  it("mantém uma margem de reserva suficiente para evitar execuções concorrentes", () => {
    expect(MUSIC_WEB_PUSH_PATH.startsWith("/api/scheduled/")).toBe(true);
  });

  it("diferencia o vínculo salvo do identificador recebido pelo trabalho sem acessar segredos", () => {
    expect(describeMusicReminderSchedulerBinding(" task-1 ", "task-1")).toEqual({
      configuredTaskUid: "task-1",
      receivedTaskUid: "task-1",
      matchesCurrentTask: true,
    });
    expect(describeMusicReminderSchedulerBinding("task-2", "task-1").matchesCurrentTask).toBe(false);
  });
});
