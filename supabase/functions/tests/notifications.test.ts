import { disabledProvider } from "../_shared/mail/disabled.ts";
import { brevoProvider } from "../_shared/mail/brevo.ts";
import { requireWorker } from "../_shared/workerAuth.ts";
function assert(v: unknown): asserts v {
  if (!v) throw new Error("Notification contract failed");
}
const input = {
  eventKey: "00000000-0000-4000-8000-000000000073",
  recipientVerifiedEmail: "partner@example.test",
};
Deno.test("disabled provider never calls network", async () => {
  const result = await disabledProvider.sendNotification(input);
  assert(result.state === "disabled");
});
Deno.test("Brevo batch contains exactly one recipient, stable key and generic Vietnamese text", async () => {
  let body: Record<string, unknown> = {};
  const provider = brevoProvider({
    apiKey: "mock-key",
    from: "sender@example.test",
    name: "Lover",
    appOrigin: "https://lover.example.test",
  }, async (_url, init) => {
    body = JSON.parse(String(init?.body));
    return Response.json({ messageIds: ["mock-provider-id"] }, { status: 201 });
  });
  const result = await provider.sendNotification(input);
  assert(result.state === "accepted");
  assert(
    JSON.stringify(body.messageVersions) ===
      JSON.stringify([{ to: [{ email: input.recipientVerifiedEmail }] }]),
  );
  assert(
    (body.headers as Record<string, string>).idempotencyKey === input.eventKey,
  );
  assert(!JSON.stringify(body).includes("private title"));
});
Deno.test("network uncertainty stays unknown, rejection is bounded and duplicate response never blind-resends", async () => {
  const config = {
    apiKey: "mock",
    from: "sender@example.test",
    name: "Lover",
    appOrigin: "https://lover.example.test",
  };
  assert(
    (await brevoProvider(
      config,
      () => Promise.reject(new Error("private data")),
    ).sendNotification(input)).state === "unknown",
  );
  const quota = await brevoProvider(
    config,
    async () => new Response("private provider body", { status: 429 }),
  ).sendNotification(input);
  assert(quota.state === "rejected" && quota.retryable);
  const duplicate = await brevoProvider(
    config,
    async () => Response.json({ code: "duplicate_parameter" }, { status: 400 }),
  ).sendNotification(input);
  assert(duplicate.state === "unknown");
});
Deno.test("worker rejects forged browser credentials", () => {
  let denied = false;
  try {
    requireWorker(
      new Request("http://local", {
        method: "POST",
        headers: { "x-worker-secret": "public-key" },
      }),
      "server-secret",
    );
  } catch {
    denied = true;
  }
  assert(denied);
});
