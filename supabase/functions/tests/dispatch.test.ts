import { signalNotificationWorker } from "../_shared/dispatch.ts";
import { configuredProvider } from "../_shared/mail/config.ts";
import { createNotificationWorker } from "../notification-worker/handler.ts";
import type { MailProvider } from "../_shared/mail/provider.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
function assert(v: unknown): asserts v {
  if (!v) throw new Error("Dispatch assertion failed");
}
Deno.test("disabled or unverified configuration sends no signal/provider request", async () => {
  let calls = 0;
  await signalNotificationWorker(async () => {
    calls++;
    return new Response();
  }, () => undefined);
  assert(calls === 0);
  assert(!configuredProvider(() => "true").enabled);
});
Deno.test("failed immediate signal is harmless and carries no private command payload", async () => {
  let body = "";
  await signalNotificationWorker(
    async (_url, init) => {
      body = String(init?.body);
      throw new Error("outage");
    },
    (
      key,
    ) => ({
      EMAIL_DELIVERY_ENABLED: "true",
      SUPABASE_URL: "http://local",
      WORKER_SECRET: "test",
    }[key]),
  );
  assert(body === "{}");
});
Deno.test("worker uses trusted target once and stores uncertainty instead of reporting acceptance", async () => {
  const calls: string[] = [];
  const admin = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push(name);
      if (name === "claim_email") {
        return {
          data: [{ id: "job", lease: "lease", eventKey: "key" }],
          error: null,
        };
      }
      if (name === "email_target") {
        return {
          data: "partner@example.test",
          error: null,
        };
      }
      assert(args.outcome === "unknown");
      return { data: null, error: null };
    },
  } as unknown as SupabaseClient;
  const provider: MailProvider = {
    sendNotification: async (input) => {
      assert(input.recipientVerifiedEmail === "partner@example.test");
      return { state: "unknown" };
    },
  };
  const handler = createNotificationWorker({
    secret: "server",
    admin,
    provider: { enabled: true, provider },
  });
  assert(
    (await handler(
      new Request("http://local", {
        method: "POST",
        headers: { "x-worker-secret": "server" },
      }),
    )).status === 200,
  );
  assert(calls.join(",") === "claim_email,email_target,finish_email");
});
