import { createApiHandler } from "../api/handler.ts";
import { HttpError } from "../_shared/http.ts";
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Assertion failed");
}
const origin = "http://127.0.0.1:5173";
function request(
  body = JSON.stringify({
    command: "memory.create",
    payload: { title: "private text" },
  }),
  method = "POST",
  from = origin,
) {
  return new Request("http://localhost/api", {
    method,
    headers: { Origin: from, "Content-Type": "application/json" },
    ...(method === "POST" ? { body } : {}),
  });
}
Deno.test("API rejects missing/expired authentication before command dispatch", async () => {
  let called = false;
  const handler = createApiHandler({
    origin: () => origin,
    authenticate: async () => {
      throw new HttpError(401);
    },
    mutation: async () => {
      called = true;
      throw new Error("unreachable");
    },
  });
  const response = await handler(request());
  assert(response.status === 401 && !called);
  assert(response.headers.get("Cache-Control") === "no-store");
});
Deno.test("API enforces exact CORS and handles preflight without executing commands", async () => {
  let authenticated = false;
  const handler = createApiHandler({
    origin: () => origin,
    authenticate: async () => {
      authenticated = true;
    },
  });
  assert((await handler(request(undefined, "OPTIONS"))).status === 204);
  assert(!authenticated);
  assert(
    (await handler(request(undefined, "POST", "https://untrusted.invalid")))
      .status === 403,
  );
  assert(!authenticated);
});
Deno.test("API rejects malformed/oversized JSON and unsupported commands", async () => {
  const handler = createApiHandler({
    origin: () => origin,
    authenticate: async () => {},
  });
  assert((await handler(request("{"))).status === 400);
  assert((await handler(request("x".repeat(262145)))).status === 413);
  assert((await handler(request('{"command":"unknown"}'))).status === 503);
  assert((await handler(request(undefined, "GET"))).status === 400);
});
Deno.test("API preserves denial/conflict/quota statuses and redacts internal exceptions", async () => {
  for (const status of [400, 403, 404, 409, 413, 415, 422, 429, 503]) {
    const handler = createApiHandler({
      origin: () => origin,
      authenticate: async () => {},
      mutation: async () => {
        throw new HttpError(status);
      },
    });
    const response = await handler(request());
    assert(response.status === status);
    assert(!(await response.text()).includes("private text"));
    assert(response.headers.get("Access-Control-Allow-Origin") === origin);
  }
  const handler = createApiHandler({
    origin: () => origin,
    authenticate: async () => {},
    mutation: async () => {
      throw new Error("private text token secret");
    },
  });
  const response = await handler(request());
  assert(
    response.status === 503 && !(await response.text()).includes("secret"),
  );
});
