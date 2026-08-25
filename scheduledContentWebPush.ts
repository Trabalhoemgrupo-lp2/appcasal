import type { Request, Response } from "express";
import { runContentNotificationPushScheduler } from "./contentNotificationScheduler";
import { sdk } from "./_core/sdk";

export async function handleScheduledContentWebPush(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    return res.json(await runContentNotificationPushScheduler(user.taskUid));
  } catch (error) {
    void error;
    console.error("[Content Web Push] Execução agendada falhou.");
    return res.status(500).json({ error: "scheduler-delivery-failed" });
  }
}
