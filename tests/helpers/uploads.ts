import { expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { provisionCoupleLocal } from "./localStack";
import { disposableSql } from "./disposableStack";
export async function uploadContext() {
  const stack = await provisionCoupleLocal();
  const clients: Record<string, ReturnType<typeof createClient>> = {},
    tokens: Record<string, string> = {};
  for (const role of ["first", "partner", "outsider"]) {
    const client = createClient(stack.url, stack.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signed = await client.auth.signInWithPassword({
      email: role + "@example.test",
      password: "Local-Only-Test-Password-2026!",
    });
    expect(signed.error).toBeNull();
    clients[role] = client;
    tokens[role] = signed.data.session!.access_token;
  }
  const send = (role: string, body: unknown) =>
    fetch(stack.url + "/functions/v1/api", {
      method: "POST",
      headers: {
        Origin: "http://127.0.0.1:5173",
        apikey: stack.key,
        Authorization: "Bearer " + tokens[role],
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  const issue = async (
    command: string,
    payload: Record<string, unknown>,
    role = "first",
  ) => {
    const response = await send(role, {
      command: "operation.issue",
      payload: { command, payload },
    });
    expect(
      response.status,
      `operation.issue ${command} returned HTTP ${response.status}`,
    ).toBe(200);
    const issued = await response.json();
    return {
      command,
      payload,
      operation_id: issued.operation_id,
      operation_token: issued.token,
    };
  };
  const execute = async (command: string, payload: Record<string, unknown>) => {
    const envelope = await issue(command, payload),
      response = await send("first", envelope);
    expect(
      response.status,
      `${command} returned HTTP ${response.status}: ${
        response.ok ? "" : await response.clone().text()
      }`,
    ).toBe(200);
    return response.json();
  };
  const reserve = async (bytes: Uint8Array, count = 1) =>
    execute("upload.reserve", {
      files: Array.from(
        { length: count },
        () => ({
          client_file_id: randomUUID(),
          size: bytes.length,
          declared_type: "image/jpeg",
        }),
      ),
    });
  const cleanup = async (batchId: string) => {
    if (!/^[0-9a-f-]{36}$/.test(batchId)) {
      throw new Error("Invalid fixture batch");
    }
    const records = await stack.admin.from("upload_files").select(
      "file_id,staging_path,media_path",
    ).eq("batch_id", batchId);
    expect(records.error).toBeNull();
    const files = records.data ?? [];
    for (const bucket of ["staging", "media"]) {
      if (files.length) {
        expect(
          (await stack.admin.storage.from(bucket).remove(
            files.map((f) =>
              bucket === "staging" ? f.staging_path : f.media_path
            ),
          )).error,
        ).toBeNull();
      }
    }
    const ids = files.map((f) => {
      if (!/^[0-9a-f-]{36}$/.test(f.file_id)) {
        throw new Error("Invalid fixture file");
      }
      return "'" + f.file_id + "'";
    }).join(",") || "null";
    disposableSql(`begin;
      update private.usage_budget set reserved_bytes=reserved_bytes-coalesce((select reserved_bytes from public.upload_reservations where batch_id='${batchId}'),0),committed_bytes=committed_bytes-coalesce((select sum(bytes) from public.photos where state<>'deleted' and id in(${ids})),0)-coalesce((select sum(staging_bytes) from public.upload_files where batch_id='${batchId}'),0) where scope='media';
      delete from public.upload_files where batch_id='${batchId}';delete from public.upload_reservations where batch_id='${batchId}';delete from public.upload_batches where id='${batchId}';delete from public.photos where id in(${ids});delete from public.change_events where category='upload' and resource_id='${batchId}';delete from public.operation_receipts where result_reference->>'batch_id'='${batchId}';commit;`);
  };
  return { ...stack, clients, send, issue, execute, reserve, cleanup };
}
export function finalizePayload(
  batch: {
    batch_id: string;
    reservation_id: string;
    files: { file_id: string }[];
  },
  index = 0,
) {
  return {
    batch_id: batch.batch_id,
    reservation_id: batch.reservation_id,
    file_ids: [batch.files[index].file_id],
  };
}
