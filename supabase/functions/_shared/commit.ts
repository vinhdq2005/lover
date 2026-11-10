import { createClient } from "@supabase/supabase-js";
import { authenticatedUser } from "./auth.ts";
import { verifyOperation } from "./operations.ts";
import { HttpError } from "./http.ts";
import { z } from "zod";
export async function commitMutation(
  request: Request,
  raw: unknown,
  schema: z.ZodType,
) {
  const envelope = z.strictObject({
    command: z.string(),
    payload: z.record(z.string(), z.unknown()),
    operation_id: z.uuid(),
    operation_token: z.string().max(4096),
  }).safeParse(raw);
  if (!envelope.success) throw new HttpError(400);
  const payload = schema.safeParse(envelope.data.payload);
  if (!payload.success) throw new HttpError(400);
  const { user, client } = await authenticatedUser(request);
  const url = Deno.env.get("SUPABASE_URL"),
    service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    key = Deno.env.get("OPERATION_SIGNING_KEY"),
    keyId = Deno.env.get("OPERATION_SIGNING_KEY_ID");
  if (!url || !service || !key || !keyId) throw new HttpError(503);
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const intent = {
    command: envelope.data.command,
    payload: payload.data as Record<string, unknown>,
  };
  const claims = await verifyOperation(
    envelope.data.operation_token,
    user.id,
    intent,
    { key, keyId },
    async () => {
      const { data, error } = await client.rpc("authorize_operation_intent", {
        command: intent.command,
        payload: intent.payload,
      });
      if (!error && data === true) return true;
      const { data: receipt } = await admin.from("operation_receipts").select(
        "operation_id",
      ).eq("actor_id", user.id).eq("operation_id", envelope.data.operation_id)
        .eq("command", intent.command).maybeSingle();
      const { data: member } = await client.from("memberships").select(
        "couple_id",
      ).eq("user_id", user.id).maybeSingle();
      return !!receipt && !!member;
    },
  );
  if (claims.id !== envelope.data.operation_id) throw new HttpError(409);
  const { data, error } = await admin.rpc("commit_mutation", {
    actor: user.id,
    command: intent.command,
    payload: intent.payload,
    op: claims.id,
    request_hash: claims.hash,
    token_expiry: new Date(claims.expiresAt).toISOString(),
  });
  if (error) {
    throw new HttpError(
      error.message.includes("QUOTA")
        ? 429
        : error.message.includes("CONFLICT")
        ? 409
        : error.message.includes("INVALID")
        ? 400
        : 403,
    );
  }
  return data;
}
