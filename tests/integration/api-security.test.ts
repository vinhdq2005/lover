import { expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { provisionCoupleLocal } from "../helpers/localStack";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

it("real Edge API denies invalid sessions, forged fields and unauthorized operation intents", async () => {
  const stack = await provisionCoupleLocal();
  const send = async (
    token: string,
    body: unknown,
    origin = "http://127.0.0.1:5173",
  ) =>
    fetch(stack.url + "/functions/v1/api", {
      method: "POST",
      headers: {
        Origin: origin,
        apikey: stack.key,
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  const invalid = await send("invalid", {
    command: "operation.issue",
    payload: {},
  });
  expect(invalid.status).toBe(401);
  const tokens: Record<string, string> = {};
  for (const role of ["first", "outsider"]) {
    const client = createClient(stack.url, stack.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({
      email: role + "@example.test",
      password: "Local-Only-Test-Password-2026!",
    });
    expect(error).toBeNull();
    tokens[role] = data.session!.access_token;
  }
  const intent = {
    command: "memory.create",
    payload: {
      title: "Synthetic boundary test",
      description: "",
      event_date: "2024-01-01",
    },
  };
  expect(
    (await send(tokens.outsider, {
      command: "operation.issue",
      payload: intent,
    })).status,
  ).toBe(403);
  expect(
    (await send(tokens.first, {
      command: "operation.issue",
      payload: {
        ...intent,
        payload: { ...intent.payload, actor_id: stack.users.partner },
      },
    })).status,
  ).toBe(400);
  expect(
    (await send(tokens.first, {
      command: "operation.issue",
      payload: { ...intent, hash: "client-hash" },
    })).status,
  ).toBe(400);
  expect(
    (await send(
      tokens.first,
      { command: "operation.issue", payload: intent },
      "https://untrusted.invalid",
    )).status,
  ).toBe(403);
  const issued = await send(tokens.first, {
    command: "operation.issue",
    payload: intent,
  });
  expect(issued.status).toBe(200);
  const signed = await issued.json();
  const denied = await send(tokens.first, {
    ...intent,
    payload: { ...intent.payload, title: "Modified private text" },
    operation_id: signed.operation_id,
    operation_token: signed.token,
  });
  expect(denied.status).toBe(409);
  expect(await denied.text()).not.toContain("Modified private text");
  const { data: rows } = await stack.admin.from("memories").select("id").eq(
    "title",
    "Synthetic boundary test",
  );
  expect(rows).toEqual([]);
  // Exact concurrent commands must share the receipt/event, not merely pass a schema mock.
  const envelope = {
    ...intent,
    operation_id: signed.operation_id,
    operation_token: signed.token,
  };
  const committed = await Promise.all([
    send(tokens.first, envelope),
    send(tokens.first, envelope),
  ]);
  expect(committed.map((r) => r.status)).toEqual([200, 200]);
  const results = await Promise.all(committed.map((r) => r.json()));
  expect(results[0].id).toBe(results[1].id);
  const { data: events } = await stack.admin.from("change_events").select("id")
    .eq("operation_id", signed.operation_id);
  expect(events).toHaveLength(1);
  const { data: receipts } = await stack.admin.from("operation_receipts")
    .select("operation_id").eq("operation_id", signed.operation_id);
  expect(receipts).toHaveLength(1);
  // Simulate a valid server signature from 31 days ago, after operational receipt cleanup.
  // Local-only signing material is never printed or sent to a browser.
  const key = readFileSync(
    process.env.LOVER_TEST_EDGE_ENVFILE ?? ".env.edge.local",
    "utf8",
  ).split(/\r?\n/).find(
    (line) => line.startsWith("OPERATION_SIGNING_KEY="),
  )!.split("=").slice(1).join("=");
  const claims = JSON.parse(
    Buffer.from(signed.token.split(".")[0], "base64url").toString("utf8"),
  );
  claims.issuedAt = Date.now() - 31 * 86400000;
  claims.expiresAt = claims.issuedAt + 30 * 86400000;
  const encoded = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const expiredToken = encoded + "." +
    createHmac("sha256", key).update(encoded).digest("base64url");
  const { error: purgeError } = await stack.admin.from("operation_receipts")
    .delete().eq("operation_id", signed.operation_id);
  expect(purgeError).toBeNull();
  expect(
    (await send(tokens.first, { ...envelope, operation_token: expiredToken }))
      .status,
  ).toBe(409);
  const { data: unchanged } = await stack.admin.from("memories").select("id")
    .eq("title", "Synthetic boundary test");
  expect(unchanged).toHaveLength(1);
  const deleteIntent = {
    command: "memory.delete",
    payload: { id: results[0].id, expected_version: 1 },
  };
  const deleteIssue = await send(tokens.first, {
    command: "operation.issue",
    payload: deleteIntent,
  });
  expect(deleteIssue.status).toBe(200);
  const deletion = await deleteIssue.json();
  expect(
    (await send(tokens.first, {
      ...deleteIntent,
      operation_id: deletion.operation_id,
      operation_token: deletion.token,
    })).status,
  ).toBe(200);
});
