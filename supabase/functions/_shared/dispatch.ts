export async function signalNotificationWorker(
  fetcher: typeof fetch = fetch,
  env: (name: string) => string | undefined = (name) => Deno.env.get(name),
) {
  if (env("EMAIL_DELIVERY_ENABLED") !== "true") return;
  const base = env("SUPABASE_URL"), secret = env("WORKER_SECRET");
  if (!base || !secret) return;
  try {
    await fetcher(base + "/functions/v1/notification-worker", {
      method: "POST",
      headers: {
        "x-worker-secret": secret,
        "content-type": "application/json",
      },
      body: "{}",
      signal: AbortSignal.timeout(2000),
    });
  } catch { /* recovery owns missed signals; never log private request data */ }
}
export function afterCommitSignal() {
  try {
  const task = signalNotificationWorker();
  const runtime = (globalThis as unknown as {
    EdgeRuntime?: { waitUntil: (task: Promise<unknown>) => void };
  }).EdgeRuntime;
  if (runtime) runtime.waitUntil(task);
  else void task;
  } catch { /* A lost wake-up must never change the committed command response. */ }
}
