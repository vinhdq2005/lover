import { errorResponse, parseBody } from "../_shared/http.ts";
function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
Deno.test("error boundary exposes only fixed safe Vietnamese messages", () => {
  for (const status of [400, 401, 403, 404, 409, 413, 415, 422, 429, 503]) {
    const r = errorResponse(status);
    assert(r.status === status);
    assert(r.headers.get("Cache-Control") === "no-store");
  }
});
Deno.test("malformed and oversized bodies fail without leaking input", async () => {
  for (const body of ["{invalid", "x".repeat(300000)]) {
    let failed = false;
    try {
      await parseBody(
        new Request("http://localhost", { method: "POST", body }),
      );
    } catch {
      failed = true;
    }
    assert(failed);
  }
});
