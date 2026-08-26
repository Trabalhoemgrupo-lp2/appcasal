import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const ANNIVERSARY_WEB_PUSH_JOB_KEY = "anniversary-web-push";
export const ANNIVERSARY_WEB_PUSH_PATH = "/api/scheduled/anniversary-web-push";

const DELIVERY_LEASE_MS = 10 * 60 * 1000;

type CoupleMilestone = {
  id: string;
  couple_id: string;
  label: string;
  recurrence: "monthly" | "yearly";
  day_of_month: number;
  month_of_year: number | null;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type AnniversaryPushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

export type AnniversaryReminderSchedulerResult = {
  ok: true;
  skipped?: "unbound-scheduler";
  dueMilestones: number;
  claimedDeliveries: number;
  delivered: number;
  revoked: number;
  failed: number;
};

export function isMilestoneDueOnDate(milestone: Pick<CoupleMilestone, "recurrence" | "day_of_month" | "month_of_year">, date: Date): boolean {
  if (milestone.day_of_month !== date.getUTCDate()) return false;
  return milestone.recurrence === "monthly" || milestone.month_of_year === date.getUTCMonth() + 1;
}

export function createAnniversaryPushPayload(milestone: Pick<CoupleMilestone, "id" | "label">): AnniversaryPushPayload {
  return {
    title: "Caderno de Dois",
    body: `Hoje é ${milestone.label}. Que seja um dia leve para vocês dois.`,
    url: "/?tab=contagem",
    tag: `celebration-${milestone.id}`,
  };
}

function createSupabaseServiceClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("A configuração privada do Supabase para celebrações não está disponível.");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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

async function claimCelebrationDelivery(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  milestone: CoupleMilestone,
  celebrationDate: string,
  now: string,
  leaseExpiresAt: string
) {
  const { data: created, error: createError } = await supabase
    .from("couple_celebration_push_deliveries")
    .insert({ milestone_id: milestone.id, celebration_date: celebrationDate, delivery_started_at: now })
    .select("id")
    .maybeSingle();
  if (createError && createError.code !== "23505") throw createError;
  if (created) return created;

  const { data: reclaimed, error: reclaimError } = await supabase
    .from("couple_celebration_push_deliveries")
    .update({ delivery_started_at: now })
    .eq("milestone_id", milestone.id)
    .eq("celebration_date", celebrationDate)
    .is("sent_at", null)
    .or(`delivery_started_at.is.null,delivery_started_at.lt.${leaseExpiresAt}`)
    .select("id")
    .maybeSingle();
  if (reclaimError) throw reclaimError;
  return reclaimed;
}

/** Entrega cada marco afetivo uma vez por casal e por data, com retomada segura após falha transitória. */
export async function runAnniversaryReminderPushScheduler(taskUid: string): Promise<AnniversaryReminderSchedulerResult> {
  const supabase = createSupabaseServiceClient();
  const empty: AnniversaryReminderSchedulerResult = { ok: true, dueMilestones: 0, claimedDeliveries: 0, delivered: 0, revoked: 0, failed: 0 };
  const { data: configuredJob, error: configuredJobError } = await supabase
    .from("app_system_jobs")
    .select("schedule_cron_task_uid")
    .eq("job_key", ANNIVERSARY_WEB_PUSH_JOB_KEY)
    .maybeSingle();
  if (configuredJobError) throw configuredJobError;
  if (configuredJob?.schedule_cron_task_uid !== taskUid) return { ...empty, skipped: "unbound-scheduler" };

  configureVapid();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const leaseExpiresAt = new Date(Date.now() - DELIVERY_LEASE_MS).toISOString();
  const { data: milestones, error: milestonesError } = await supabase
    .from("couple_milestones")
    .select("id, couple_id, label, recurrence, day_of_month, month_of_year");
  if (milestonesError) throw milestonesError;

  const dueMilestones = ((milestones ?? []) as CoupleMilestone[]).filter(milestone => isMilestoneDueOnDate(milestone, new Date(now)));
  empty.dueMilestones = dueMilestones.length;

  for (const milestone of dueMilestones) {
    const claim = await claimCelebrationDelivery(supabase, milestone, today, now, leaseExpiresAt);
    if (!claim) continue;
    empty.claimedDeliveries += 1;

    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("couple_web_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("couple_id", milestone.couple_id)
      .is("revoked_at", null);
    if (subscriptionsError) throw subscriptionsError;

    let hasRetryableFailure = false;
    const serializedPayload = JSON.stringify(createAnniversaryPushPayload(milestone));
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
        console.error("[Celebration Web Push] Falha de entrega", { statusCode: statusCode ?? "unknown" });
      }
    }

    const completion = hasRetryableFailure ? { delivery_started_at: null } : { sent_at: now, delivery_started_at: null };
    const { error: completionError } = await supabase
      .from("couple_celebration_push_deliveries")
      .update(completion)
      .eq("id", claim.id)
      .eq("delivery_started_at", now);
    if (completionError) throw completionError;
  }

  return empty;
}
