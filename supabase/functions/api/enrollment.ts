import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { authenticatedUser } from "../_shared/auth.ts";
import { HttpError } from "../_shared/http.ts";
import { verifyOperation } from "../_shared/operations.ts";
import { dateOnly, textField } from "../_shared/validation.ts";
export const enrollmentSchemas: Record<string, z.ZodType> = {
  "couple.create": z.strictObject({
    name: textField(1, 100),
    start_date: dateOnly,
    timezone: z.string().min(1).max(100),
  }),
  "invitation.create": z.strictObject({
    recipient_email: z.email().transform((v) => v.toLowerCase()),
  }),
  "invitation.revoke": z.strictObject({
    id: z.uuid(),
    expected_version: z.int().positive(),
  }),
  "invitation.accept": z.strictObject({ token: z.string().min(32).max(200) }),
};
export function enrollmentPayload(command: string, payload: unknown) {
  return (enrollmentSchemas[command] ?? z.never()).safeParse(payload);
}
export async function commitEnrollment(request: Request, raw: unknown) {
  const input = z.strictObject({
    command: z.string(),
    payload: z.record(z.string(), z.unknown()),
    operation_id: z.uuid(),
    operation_token: z.string().max(4096),
  }).safeParse(raw);
  if (!input.success) throw new HttpError(400);
  const parsed = enrollmentPayload(input.data.command, input.data.payload);
  if (!parsed.success) throw new HttpError(400);
  const { user, client } = await authenticatedUser(request);
  const key = Deno.env.get("OPERATION_SIGNING_KEY"),
    keyId = Deno.env.get("OPERATION_SIGNING_KEY_ID"),
    service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    url = Deno.env.get("SUPABASE_URL");
  if (!key || !keyId || !service || !url) throw new HttpError(503);
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const intent = {
    command: input.data.command,
    payload: parsed.data as Record<string, unknown>,
  };
  const claims = await verifyOperation(
    input.data.operation_token,
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
      ).eq("actor_id", user.id).eq("operation_id", input.data.operation_id).eq(
        "command",
        intent.command,
      ).maybeSingle();
      const { data: member } = await client.from("memberships").select(
        "couple_id",
      ).eq("user_id", user.id).maybeSingle();
      return !!receipt && !!member;
    },
  );
  if (claims.id !== input.data.operation_id) throw new HttpError(409);
  let token: string | undefined, hash: string | undefined;
  if (intent.command === "invitation.create") {
    token = Array.from(
      crypto.getRandomValues(new Uint8Array(32)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
      ),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
  }
  const { data, error } = await admin.rpc("commit_enrollment", {
    actor: user.id,
    command: intent.command,
    payload: intent.payload,
    op: claims.id,
    request_hash: claims.hash,
    token_expiry: new Date(claims.expiresAt).toISOString(),
    invite_hash: hash ?? null,
  });
  if (error) {
    throw new HttpError(error.message.includes("CONFLICT") ? 409 : 403);
  }
  return {
    ...data,
    ...(token && !data.replayed ? { invitation_token: token } : {}),
  };
}
