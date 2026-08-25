import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() } }));

import { createClient } from "@supabase/supabase-js";
import {
  MUSIC_DUE_ROOM_FIELDS,
  MUSIC_ROOM_PRIMARY_KEY,
  runMusicReminderPushScheduler,
} from "./musicReminderScheduler";

type QueryResult = { data: unknown; error: null };

function createQuery(result: QueryResult, selectCalls: string[], eqCalls: Array<[string, unknown]>) {
  const query = {
    select: vi.fn((fields: string) => {
      selectCalls.push(fields);
      return query;
    }),
    update: vi.fn(() => query),
    eq: vi.fn((field: string, value: unknown) => {
      eqCalls.push([field, value]);
      return query;
    }),
    not: vi.fn(() => query),
    is: vi.fn(() => query),
    or: vi.fn(() => query),
    lte: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

describe("execução do emissor de lembretes musicais", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VITE_SUPABASE_URL = "https://fysieyzyejnqosovgeyb.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
    process.env.VAPID_PUBLIC_KEY = "vapid-public-test";
    process.env.VAPID_PRIVATE_KEY = "vapid-private-test";
  });

  it("usa couple_id em cada busca e atualização da Sala Spotify", async () => {
    const selectCalls: string[] = [];
    const eqCalls: Array<[string, unknown]> = [];
    const dueRoom = {
      couple_id: "couple-7",
      listen_at: "2026-08-20T10:00:00.000Z",
      reminder_note: "Nossa escuta começa agora.",
    };
    let musicRoomRequestCount = 0;

    vi.mocked(createClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "app_system_jobs") {
          return createQuery({ data: { schedule_cron_task_uid: "task-1" }, error: null }, selectCalls, eqCalls);
        }
        if (table === "couple_web_push_subscriptions") {
          return createQuery({ data: [], error: null }, selectCalls, eqCalls);
        }
        if (table === "couple_music_rooms") {
          musicRoomRequestCount += 1;
          if (musicRoomRequestCount === 1) {
            return createQuery({ data: [dueRoom], error: null }, selectCalls, eqCalls);
          }
          if (musicRoomRequestCount === 2) {
            return createQuery({ data: dueRoom, error: null }, selectCalls, eqCalls);
          }
          return createQuery({ data: null, error: null }, selectCalls, eqCalls);
        }
        throw new Error(`Tabela inesperada no teste: ${table}`);
      }),
    } as never);

    const result = await runMusicReminderPushScheduler("task-1");

    expect(result).toMatchObject({ dueRooms: 1, claimedRooms: 1, delivered: 0, failed: 0 });
    expect(selectCalls.filter(fields => fields === MUSIC_DUE_ROOM_FIELDS)).toHaveLength(2);
    expect(eqCalls.filter(([field]) => field === MUSIC_ROOM_PRIMARY_KEY)).toEqual([
      ["couple_id", "couple-7"],
      ["couple_id", "couple-7"],
      ["couple_id", "couple-7"],
    ]);
    expect(eqCalls.some(([field]) => field === "id")).toBe(false);
  });
});
