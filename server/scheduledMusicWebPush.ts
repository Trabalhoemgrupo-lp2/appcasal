import type { Request, Response } from "express";
import { runMusicReminderPushScheduler } from "./musicReminderScheduler";
import { sdk } from "./_core/sdk";

export async function handleScheduledMusicWebPush(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const result = await runMusicReminderPushScheduler(user.taskUid);
    return res.json(result);
  } catch (error) {
    void error;
    console.error("[Music Web Push] Execução agendada falhou.");
    return res.status(500).json({
      error: "scheduler-delivery-failed",
    });
  }
}
