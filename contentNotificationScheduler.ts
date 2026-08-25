import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const NOTIFICATION_WEB_PUSH_JOB_KEY = "notification-web-push";
export const NOTIFICATION_WEB_PUSH_PATH = "/api/scheduled/notification-web-push";

const DELIVERY_LEASE_MS = 10 * 60 * 1000;
const PUSH_NOTIFICATION_KINDS = ["plan_created", "book_added", "movie_added", "music_added"] as const;

type PushNotificationKind = (typeof PUSH_NOTIFICATION_KINDS)[number];
type PendingNotification = {
  id: string;
  couple_id: string;
  recipient_id: string;
  kind: PushNotificationKind;
};
type PushSubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };

export type ContentPushPayload = { title: string; body: string; url: string; tag: string };
export type ContentNotificationSchedulerResult = {
  ok: true;
  skipped?: "unbound-scheduler";
  pendingNotifications: number;
  claimedNotifications: number;
  delivered: number;
  revoked: number;
  failed: number;
};

export function isPushNotificationKind(kind: string): kind is PushNotificationKind {
  return (PUSH_NOTIFICATION_KINDS as readonly string[]).includes(kind);
}

export function createContentPushPayload(notification: Pick<PendingNotification, "id" | "kind">): ContentPushPayload {
  const content = {
    plan_created: { body: "Um novo plano foi registrado no calendário de vocês.", url: "/?tab=planos" },
    book_added: { body: "Uma nova leitura foi adicionada ao Caderno.", url: "/?tab=leituras" },
    movie_added: { body: "Um novo filme foi adicionado à lista de vocês.", url: "/?tab=filmes" },
    music_added: { body: "Uma nova música entrou na fila afetiva.", url: "/?tab=musica" },
  } as const;
  const selected = content[notification.kind];
  return { title: "Caderno de Dois", body: selected.body, url: selected.url, tag: `couple-notification-${notification.id}` };
}

function createSupabaseServiceClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("A configuração privada do Supabase para notificações não está disponível.");
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

function configureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error("As chaves VAPID privadas não estão disponíveis.");
  webpush.setVapidDetails("mailto:push@appcasal.local", publicKey, privateKey);
}

function statusCodeFrom(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) return undefined;
  const { statusCode } = error as { statusCode?: unknown };
  return typeof statusCode === "number" ? statusCode : undefined;
}

function shouldRevokePushSubscription(statusCode: number | undefined) {
  return statusCode === 404 || statusCode === 410;
}

/** Entrega para os dispositivos do destinatário, sem enviar o conteúdo privado ao dispositivo da pessoa autora. */
export async function runContentNotificationPushScheduler(taskUid: string): Promise<ContentNotificationSchedulerResult> {
  const supabase = createSupabaseServiceClient();
  const empty: ContentNotificationSchedulerResult = { ok: true, pendingNotifications: 0, claimedNotifications: 0, delivered: 0, revoked: 0, failed: 0 };
  const { data: configuredJob, error: configuredJobError } = await supabase
    .from("app_system_jobs")
    .select("schedule_cron_task_uid")
    .eq("job_key", NOTIFICATION_WEB_PUSH_JOB_KEY)
    .maybeSingle();
  if (configuredJobError) throw configuredJobError;
  if (configuredJob?.schedule_cron_task_uid !== taskUid) return { ...empty, skipped: "unbound-scheduler" };

  configureVapid();
  const now = new Date().toISOString();
  const leaseExpiresAt = new Date(Date.now() - DELIVERY_LEASE_MS).toISOString();
  const { data: pending, error: pendingError } = await supabase
    .from("notifications")
    .select("id, couple_id, recipient_id, kind")
    .in("kind", PUSH_NOTIFICATION_KINDS)
    .is("push_sent_at", null)
    .or(`push_delivery_started_at.is.null,push_delivery_started_at.lt.${leaseExpiresAt}`)
    .order("created_at", { ascending: true })
    .limit(100);
  if (pendingError) throw pendingError;
  const pendingNotifications = (pending ?? []).filter((notification): notification is PendingNotification => isPushNotificationKind(notification.kind));
  empty.pendingNotifications = pendingNotifications.length;

  for (const notification of pendingNotifications) {
    const { data: claimed, error: claimError } = await supabase
      .from("notifications")
      .update({ push_delivery_started_at: now })
      .eq("id", notification.id)
      .is("push_sent_at", null)
      .or(`push_delivery_started_at.is.null,push_delivery_started_at.lt.${leaseExpiresAt}`)
      .select("id, couple_id, recipient_id, kind")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed || !isPushNotificationKind(claimed.kind)) continue;
    empty.claimedNotifications += 1;
    const claimedNotification = claimed as PendingNotification;

    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("couple_web_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("couple_id", claimedNotification.couple_id)
      .eq("user_id", claimedNotification.recipient_id)
      .is("revoked_at", null);
    if (subscriptionsError) throw subscriptionsError;

    let hasRetryableFailure = false;
    const serializedPayload = JSON.stringify(createContentPushPayload(claimedNotification));
    for (const subscription of (subscriptions ?? []) as PushSubscriptionRow[]) {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, serializedPayload);
        empty.delivered += 1;
      } catch (error) {
        empty.failed += 1;
        const statusCode = statusCodeFrom(error);
        if (shouldRevokePushSubscription(statusCode)) {
          const { error: revokeError } = await supabase.from("couple_web_push_subscriptions").update({ revoked_at: now }).eq("id", subscription.id);
          if (revokeError) throw revokeError;
          empty.revoked += 1;
        } else {
          hasRetryableFailure = true;
        }
        console.error("[Content Web Push] Falha de entrega", { kind: claimedNotification.kind, statusCode: statusCode ?? "unknown" });
      }
    }

    const completion = hasRetryableFailure ? { push_delivery_started_at: null } : { push_sent_at: now, push_delivery_started_at: null };
    const { error: completionError } = await supabase
      .from("notifications")
      .update(completion)
      .eq("id", claimedNotification.id)
      .eq("push_delivery_started_at", now);
    if (completionError) throw completionError;
  }
  return empty;
}
