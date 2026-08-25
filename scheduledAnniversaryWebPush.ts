import type { Request, Response } from "express";
import { runAnniversaryReminderPushScheduler } from "./anniversaryReminderScheduler";
import { sdk } from "./_core/sdk";

export async function handleScheduledAnniversaryWebPush(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    return res.json(await runAnniversaryReminderPushScheduler(user.taskUid));
  } catch (error) {
    void error;
    console.error("[Celebration Web Push] Execução agendada falhou.");
    return res.status(500).json({ error: "scheduler-delivery-failed" });
  }
}
