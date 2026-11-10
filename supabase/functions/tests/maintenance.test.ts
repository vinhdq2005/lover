import { requireWorker } from "../_shared/workerAuth.ts";
import { HttpError } from "../_shared/http.ts";
import { isMissingObject } from "../_shared/storageErrors.ts";
function assert(v: unknown): asserts v {
  if (!v) throw new Error("Assertion failed");
}
Deno.test("maintenance never accepts public API keys as worker authentication", () => {
  const secret = "synthetic-worker-secret-never-a-browser-key";
  requireWorker(
    new Request("http://localhost", {
      method: "POST",
      headers: { "x-worker-secret": secret },
    }),
    secret,
  );
  for (
    const request of [
      new Request("http://localhost", {
        method: "POST",
        headers: { apikey: "sb_publishable_fake" },
      }),
      new Request("http://localhost", {
        method: "POST",
        headers: { "x-worker-secret": secret + "x" },
      }),
    ]
  ) {
    let denied = false;
    try {
      requireWorker(request, secret);
    } catch (error) {
      denied = error instanceof HttpError && error.status === 403;
    }
    assert(denied);
  }
});
Deno.test("unconfigured worker authentication fails closed", () => {
  let denied = false;
  try {
    requireWorker(
      new Request("http://localhost", { method: "POST" }),
      undefined,
    );
  } catch (error) {
    denied = error instanceof HttpError && error.status === 503;
  }
  assert(denied);
});
Deno.test("reconciliation distinguishes missing keys from permission and outage failures", () => {
  assert(isMissingObject({ code: "NoSuchKey", status: 400 }));
  assert(isMissingObject({ status: 404 }));
  for (
    const error of [
      { code: "NoSuchBucket", status: 404 },
      { code: "InvalidJWT", status: 403 },
      { status: 503 },
      null,
    ]
  ) assert(!isMissingObject(error));
});
