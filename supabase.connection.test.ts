import { describe, expect, it } from "vitest";

describe("Supabase público", () => {
  it("responde à configuração de autenticação com a URL e a chave publishable", async () => {
    const projectUrl = process.env.VITE_SUPABASE_URL;
    const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    expect(projectUrl).toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co$/i);
    expect(publishableKey).toBeTruthy();

    const response = await fetch(`${projectUrl}/auth/v1/settings`, {
      headers: { apikey: publishableKey! },
    });

    expect(response.ok).toBe(true);
    const settings = (await response.json()) as { external?: Record<string, unknown> };
    expect(settings).toBeTypeOf("object");
  });

  it("expõe as rotas públicas de banco, Storage e Realtime no projeto configurado", async () => {
    const projectUrl = process.env.VITE_SUPABASE_URL;
    const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    expect(projectUrl).toBeTruthy();
    expect(publishableKey).toBeTruthy();

    const endpoints = [
      `${projectUrl}/rest/v1/`,
      `${projectUrl}/storage/v1/bucket`,
      `${projectUrl}/realtime/v1/api/tenants/realtime-dev/health`,
    ];

    const responses = await Promise.all(
      endpoints.map(endpoint =>
        fetch(endpoint, {
          headers: { apikey: publishableKey! },
        }),
      ),
    );

    for (const response of responses) {
      expect(response.status).not.toBe(404);
      expect(response.status).toBeLessThan(500);
    }
  });

  it("permite ao servidor ler o vínculo privado do agendador com a chave de serviço", async () => {
    const projectUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(projectUrl).toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co$/i);
    expect(serviceRoleKey).toBeTruthy();

    const response = await fetch(
      `${projectUrl}/rest/v1/app_system_jobs?job_key=eq.music-web-push&select=job_key,schedule_cron_task_uid`,
      { headers: { apikey: serviceRoleKey!, Authorization: `Bearer ${serviceRoleKey}` } },
    );

    expect(response.ok).toBe(true);
    const jobs = (await response.json()) as Array<{ job_key: string; schedule_cron_task_uid: string | null }>;
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.job_key).toBe("music-web-push");
    expect(jobs[0]?.schedule_cron_task_uid).toBeTruthy();
  });
});
