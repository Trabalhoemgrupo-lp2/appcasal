import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const MUSIC_WEB_PUSH_JOB_KEY = "music-web-push";
export const MUSIC_WEB_PUSH_PATH = "/api/scheduled/music-web-push";
export const MUSIC_ROOM_PRIMARY_KEY = "couple_id";
export const MUSIC_DUE_ROOM_FIELDS = "couple_id, listen_at, reminder_note";

type DueMusicRoom = {
  couple_id: string;
  listen_at: string;
  reminder_note: string | null;
};

const DELIVERY_LEASE_MS = 10 * 60 * 1000;

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type MusicReminderPushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

export type MusicReminderSchedulerResult = {
  ok: true;
  skipped?: "unbound-scheduler";
  schedulerBinding?: {
    supabaseHost: string;
    configuredTaskUid: string | null;
    receivedTaskUid: string;
    matchesCurrentTask: boolean;
  };
  dueRooms: number;
  claimedRooms: number;
  delivered: number;
  revoked: number;
  failed: number;
};

export function createMusicReminderPushPayload(room: Pick<DueMusicRoom, "reminder_note">): MusicReminderPushPayload {
  const note = room.reminder_note?.trim();
  return {
    title: "Caderno de Dois",
    body: note || "A escuta de vocês começa agora.",
    url: "/?tab=musica",
    tag: "music-reminder",
  };
}

export function shouldRevokePushSubscription(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410;
}

export function describeMusicReminderSchedulerBinding(configuredTaskUid: string | null | undefined, receivedTaskUid: string) {
  const normalizedConfiguredTaskUid = configuredTaskUid?.trim() || null;
  return {
    configuredTaskUid: normalizedConfiguredTaskUid,
    receivedTaskUid,
    matchesCurrentTask: normalizedConfiguredTaskUid === receivedTaskUid,
  };
}

function createSupabaseServiceClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("A configuração privada do Supabase para lembretes não está disponível.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function configureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    throw new Error("As chaves VAPID privadas não estão disponíveis.");
  }

  webpush.setVapidDetails("mailto:push@appcasal.local", publicKey, privateKey);
}

function statusCodeFrom(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) return undefined;
  const { statusCode } = error as { statusCode?: unknown };
  return typeof statusCode === "number" ? statusCode : undefined;
}

/**
 * Entrega os lembretes vencidos uma única vez por sala. A reivindicação de cada
 * sala é uma atualização condicional de `reminder_sent_at`, impedindo duplicação
 * quando a plataforma reexecuta a chamada agendada.
 */
export async function runMusicReminderPushScheduler(taskUid: string): Promise<MusicReminderSchedulerResult> {
  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();
  const leaseExpiresAt = new Date(Date.now() - DELIVERY_LEASE_MS).toISOString();
  const empty: MusicReminderSchedulerResult = {
    ok: true,
    dueRooms: 0,
    claimedRooms: 0,
    delivered: 0,
    revoked: 0,
    failed: 0,
  };

  const { data: configuredJob, error: configuredJobError } = await supabase
    .from("app_system_jobs")
    .select("schedule_cron_task_uid")
    .eq("job_key", MUSIC_WEB_PUSH_JOB_KEY)
    .maybeSingle();

  if (configuredJobError) throw configuredJobError;
  const schedulerBinding = describeMusicReminderSchedulerBinding(configuredJob?.schedule_cron_task_uid, taskUid);
  if (!schedulerBinding.matchesCurrentTask) {
    return {
      ...empty,
      skipped: "unbound-scheduler",
      schedulerBinding: {
        ...schedulerBinding,
        supabaseHost: new URL(process.env.VITE_SUPABASE_URL!).host,
      },
    };
  }

  configureVapid();

  const { data: dueRooms, error: dueRoomsError } = await supabase
    .from("couple_music_rooms")
    .select(MUSIC_DUE_ROOM_FIELDS)
    .not("listen_at", "is", null)
    .is("reminder_sent_at", null)
    .or(`reminder_delivery_started_at.is.null,reminder_delivery_started_at.lt.${leaseExpiresAt}`)
    .lte("listen_at", now);

  if (dueRoomsError) throw dueRoomsError;
  empty.dueRooms = dueRooms?.length ?? 0;

  for (const dueRoom of (dueRooms ?? []) as DueMusicRoom[]) {
    const { data: claimedRoom, error: claimError } = await supabase
      .from("couple_music_rooms")
      .update({ reminder_delivery_started_at: now })
      .eq(MUSIC_ROOM_PRIMARY_KEY, dueRoom.couple_id)
      .is("reminder_sent_at", null)
      .or(`reminder_delivery_started_at.is.null,reminder_delivery_started_at.lt.${leaseExpiresAt}`)
      .lte("listen_at", now)
      .select(MUSIC_DUE_ROOM_FIELDS)
      .maybeSingle();

    if (claimError) throw claimError;
    if (!claimedRoom) continue;
    empty.claimedRooms += 1;

    const room = claimedRoom as DueMusicRoom;
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("couple_web_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("couple_id", room.couple_id)
      .is("revoked_at", null);

    if (subscriptionsError) throw subscriptionsError;
    const serializedPayload = JSON.stringify(createMusicReminderPushPayload(room));

    let hasRetryableFailure = false;
    for (const subscription of (subscriptions ?? []) as PushSubscriptionRow[]) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          serializedPayload
        );
        empty.delivered += 1;
      } catch (error) {
        empty.failed += 1;
        const statusCode = statusCodeFrom(error);
        if (shouldRevokePushSubscription(statusCode)) {
          const { error: revokeError } = await supabase
            .from("couple_web_push_subscriptions")
            .update({ revoked_at: now })
            .eq("id", subscription.id);
          if (revokeError) throw revokeError;
          empty.revoked += 1;
        } else {
          hasRetryableFailure = true;
        }
        console.error("[Music Web Push] Falha de entrega", {
          statusCode: statusCode ?? "unknown",
          retryable: !shouldRevokePushSubscription(statusCode),
        });
      }
    }

    const roomCompletion = hasRetryableFailure
      ? { reminder_delivery_started_at: null }
      : { reminder_sent_at: now, reminder_delivery_started_at: null };
    const { error: completionError } = await supabase
      .from("couple_music_rooms")
      .update(roomCompletion)
      .eq(MUSIC_ROOM_PRIMARY_KEY, room.couple_id)
      .eq("reminder_delivery_started_at", now);
    if (completionError) throw completionError;
  }

  return empty;
}
