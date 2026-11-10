import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { uploadSchemas } from "./uploadSchemas.ts";
import { authenticatedUser } from "../_shared/auth.ts";
import { verifyOperation } from "../_shared/operations.ts";
import { HttpError } from "../_shared/http.ts";
import { validateImage } from "../_shared/images.ts";
import { MAX_IMAGE_BYTES } from "../_shared/imageHeader.ts";

function rpcFailure(error: { message: string } | null) {
  if (!error) return;
  throw new HttpError(
    error.message.includes("CONFLICT")
      ? 409
      : error.message.includes("QUOTA")
      ? 429
      : error.message.includes("INVALID")
      ? 400
      : 503,
  );
}
async function sha256(bytes: Uint8Array<ArrayBuffer>) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
async function stagedBytes(url: string, key: string, path: string) {
  const response = await fetch(
    url + "/storage/v1/object/authenticated/staging/" +
      path.split("/").map(encodeURIComponent).join("/"),
    {
      headers: { Authorization: "Bearer " + key, apikey: key },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) {
    throw new HttpError([400, 404].includes(response.status) ? 404 : 503);
  }
  if (Number(response.headers.get("Content-Length")) > MAX_IMAGE_BYTES) {
    await response.body?.cancel();
    throw new HttpError(413);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new HttpError(503);
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_IMAGE_BYTES) {
        await reader.cancel();
        throw new HttpError(413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

export async function commitUpload(request: Request, raw: unknown) {
  const envelope = z.strictObject({
    command: z.string(),
    payload: z.record(z.string(), z.unknown()),
    operation_id: z.uuid(),
    operation_token: z.string().max(4096),
  }).safeParse(raw);
  if (!envelope.success) throw new HttpError(400);
  const schema = uploadSchemas[envelope.data.command];
  if (!schema) throw new HttpError(400);
  const parsed = schema.safeParse(envelope.data.payload);
  if (!parsed.success) throw new HttpError(400);
  const intent = {
    command: envelope.data.command,
    payload: parsed.data as Record<string, unknown>,
  };
  const { user, client } = await authenticatedUser(request);
  const url = Deno.env.get("SUPABASE_URL"),
    service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    key = Deno.env.get("OPERATION_SIGNING_KEY"),
    keyId = Deno.env.get("OPERATION_SIGNING_KEY_ID");
  if (!url || !service || !key || !keyId) throw new HttpError(503);
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
      return !error && data === true;
    },
  );
  if (claims.id !== envelope.data.operation_id) throw new HttpError(409);
  // Verification and current intent authorization always precede receipt lookup.
  const receipt = await admin.from("operation_receipts").select(
    "command,request_hash,result_reference",
  ).eq("actor_id", user.id).eq("operation_id", claims.id).maybeSingle();
  if (receipt.error) throw new HttpError(503);
  if (receipt.data) {
    if (
      receipt.data.command !== intent.command ||
      receipt.data.request_hash !== claims.hash
    ) throw new HttpError(409);
    return receipt.data.result_reference;
  }
  const signed = {
    actor: user.id,
    command: intent.command,
    payload: intent.payload,
    op: claims.id,
    request_hash: claims.hash,
    token_expiry: new Date(claims.expiresAt).toISOString(),
  };
  if (intent.command === "upload.reserve") {
    const { command: _command, ...reserve } = signed;
    const result = await admin.rpc("reserve_upload", reserve);
    rpcFailure(result.error);
    return result.data;
  }
  if (intent.command === "upload.close") {
    const result = await admin.rpc("complete_upload_command", signed);
    rpcFailure(result.error);
    return result.data;
  }
  const batch = intent.payload.batch_id as string,
    reservation = intent.payload.reservation_id as string,
    file = (intent.payload.file_ids as string[])[0];
  const claimed = await admin.rpc("claim_upload_file", {
    actor: user.id,
    batch,
    reservation,
    file,
  });
  rpcFailure(claimed.error);
  const attempt = claimed.data as {
    state: string;
    lease_id: string;
    staging_path: string;
    media_path: string;
    declared_bytes: number;
    declared_type: string;
  };
  if (attempt.state !== "ready") {
    let failure:
      | "NOT_UPLOADED"
      | "INVALID_IMAGE"
      | "STORAGE_UNAVAILABLE"
      | undefined;
    try {
      const bytes = await stagedBytes(url, service, attempt.staging_path);
      if (bytes.length !== attempt.declared_bytes) throw new HttpError(422);
      const validated = await validateImage(bytes, attempt.declared_type);
      const output = new Uint8Array(validated.preview);
      if (!output.length || output.length > MAX_IMAGE_BYTES) {
        throw new HttpError(422);
      }
      const upload = await admin.storage.from("media").upload(
        attempt.media_path,
        output,
        { contentType: "image/jpeg", cacheControl: "0", upsert: false },
      );
      if (upload.error) {
        // A previous response may have been lost after promotion. Reuse only identical bytes.
        const existing = await admin.storage.from("media").download(
          attempt.media_path,
        );
        if (
          existing.error || !existing.data ||
          await sha256(new Uint8Array(await existing.data.arrayBuffer())) !==
            await sha256(output)
        ) throw new HttpError(503);
      }
      const published = await admin.rpc("publish_upload_file", {
        actor: user.id,
        batch,
        reservation,
        file,
        claim: attempt.lease_id,
        output_bytes: output.length,
        image_width: validated.width,
        image_height: validated.height,
        source_hash: await sha256(bytes),
      });
      rpcFailure(published.error);
    } catch (error) {
      failure = error instanceof HttpError && error.status === 404
        ? "NOT_UPLOADED"
        : error instanceof HttpError && [413, 415, 422].includes(error.status)
        ? "INVALID_IMAGE"
        : "STORAGE_UNAVAILABLE";
      // Lock/revoke first: an uncertain late DB commit cannot publish deleted media.
      const resolution = await admin.rpc("quarantine_upload_file", {
        actor: user.id,
        batch,
        file,
        claim: attempt.lease_id,
      });
      rpcFailure(resolution.error);
      if (resolution.data.state === "ready") failure = undefined;
      else {
        const removed = await admin.storage.from("media").remove([
          resolution.data.media_path,
        ]);
        if (removed.error) throw new HttpError(503); // retain quarantine/reservation for safe recovery
        const failed = await admin.rpc("fail_upload_file", {
          actor: user.id,
          batch,
          file,
          claim: resolution.data.lease_id,
          code: failure,
        });
        rpcFailure(failed.error);
      }
    }
    if (!failure) {
      const removed = await admin.storage.from("staging").remove([
        attempt.staging_path,
      ]);
      if (!removed.error) {
        await admin.rpc("release_upload_staging", {
          actor: user.id,
          batch,
          file,
        });
      }
      // Cleanup failure keeps staging bytes charged and never rolls back a saved photo.
    }
  }
  const completed = await admin.rpc("complete_upload_command", signed);
  rpcFailure(completed.error);
  return completed.data;
}
