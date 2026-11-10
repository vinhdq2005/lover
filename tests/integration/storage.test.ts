import { expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { provisionCoupleLocal } from "../helpers/localStack";
import { tinyJpeg } from "../helpers/images";
import { disposableSql } from "../helpers/disposableStack";

function cleanupBatch(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Invalid fixture batch");
  disposableSql(`begin;
    update private.usage_budget set reserved_bytes=reserved_bytes-coalesce((select reserved_bytes from public.upload_reservations where batch_id='${id}'),0) where scope='media';
    delete from public.upload_files where batch_id='${id}';
    delete from public.upload_reservations where batch_id='${id}';
    delete from public.upload_batches where id='${id}';commit;`);
}

it("private Storage enforces reservation owner/path, ready reads, no signed/public links and immutable staging", async () => {
  const stack = await provisionCoupleLocal(), bytes = await tinyJpeg();
  const clients = Object.fromEntries(
    await Promise.all(["first", "partner", "outsider"].map(async (name) => {
      const client = createClient(stack.url, stack.key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await client.auth.signInWithPassword({
        email: name + "@example.test",
        password: "Local-Only-Test-Password-2026!",
      });
      expect(error).toBeNull();
      return [name, client];
    })),
  );
  const reserve = async (op: string) =>
    stack.admin.rpc("reserve_upload", {
      actor: stack.users.first,
      payload: {
        files: [{
          client_file_id: randomUUID(),
          size: bytes.length,
          declared_type: "image/jpeg",
        }],
      },
      op,
      request_hash: op,
      token_expiry: new Date(Date.now() + 86400000).toISOString(),
    });
  const op = randomUUID();
  const { data: batch, error } = await reserve(op);
  expect(error).toBeNull();
  const path = batch.files[0].path,
    mediaPath = "test/" + randomUUID() + ".jpg",
    photoId = randomUUID();
  try {
    expect(
      (await clients.outsider.storage.from("staging").upload(path, bytes, {
        contentType: "image/jpeg",
      })).error,
    ).not.toBeNull();
    expect(
      (await clients.partner.storage.from("staging").upload(path, bytes, {
        contentType: "image/jpeg",
      })).error,
    ).not.toBeNull();
    expect(
      (await clients.first.storage.from("staging").upload(
        path + "-forged",
        bytes,
        { contentType: "image/jpeg" },
      )).error,
    ).not.toBeNull();
    expect(
      (await clients.first.storage.from("staging").upload(path, bytes, {
        contentType: "image/jpeg",
        cacheControl: "0",
      })).error,
    ).toBeNull();
    expect(
      (await clients.first.storage.from("staging").upload(path, bytes, {
        contentType: "image/jpeg",
        upsert: true,
      })).error,
    ).not.toBeNull();
    expect((await clients.first.storage.from("staging").download(path)).error)
      .not.toBeNull();
    expect(
      (await clients.first.storage.from("staging").createSignedUrl(path, 60))
        .error,
    ).not.toBeNull();
    expect(
      (await stack.admin.storage.from("media").upload(mediaPath, bytes, {
        contentType: "image/jpeg",
        cacheControl: "0",
      })).error,
    ).toBeNull();
    expect(
      (await clients.first.storage.from("media").download(mediaPath)).error,
    ).not.toBeNull();
    const inserted = await stack.admin.from("photos").insert({
      id: photoId,
      couple_id: (await stack.admin.from("memberships").select("couple_id").eq(
        "user_id",
        stack.users.first,
      ).single()).data!.couple_id,
      uploader_id: stack.users.first,
      storage_path: mediaPath,
      event_date: "2024-01-01",
      bytes: bytes.length,
      format: "image/jpeg",
      width: 24,
      height: 16,
    });
    expect(inserted.error).toBeNull();
    expect(
      (await clients.partner.storage.from("media").download(mediaPath)).error,
    ).toBeNull();
    expect(
      (await clients.outsider.storage.from("media").download(mediaPath)).error,
    ).not.toBeNull();
    expect(
      (await clients.first.storage.from("media").createSignedUrl(mediaPath, 60))
        .error,
    ).not.toBeNull();
    const publicUrl =
      clients.first.storage.from("media").getPublicUrl(mediaPath).data
        .publicUrl;
    expect((await fetch(publicUrl)).ok).toBe(false);
    expect(
      (await clients.first.storage.from("media").upload(mediaPath, bytes, {
        contentType: "image/jpeg",
        upsert: true,
      })).error,
    ).not.toBeNull();
    await stack.admin.from("photos").update({ state: "deleting" }).eq(
      "id",
      photoId,
    );
    expect(
      (await clients.partner.storage.from("media").download(mediaPath)).error,
    ).not.toBeNull();
  } finally {
    await stack.admin.storage.from("staging").remove([path]);
    await stack.admin.storage.from("media").remove([mediaPath]);
    await stack.admin.from("photos").delete().eq("id", photoId);
    cleanupBatch(batch.batch_id);
  }
});

it("reservation exact replay is idempotent; conflicting duplicates and expired operations fail without reserving more capacity", async () => {
  const stack = await provisionCoupleLocal();
  const op = randomUUID(),
    payload = {
      files: [{
        client_file_id: randomUUID(),
        size: 100,
        declared_type: "image/jpeg",
      }],
    };
  const call = (
    hash: string,
    expiry = new Date(Date.now() + 86400000).toISOString(),
  ) =>
    stack.admin.rpc("reserve_upload", {
      actor: stack.users.first,
      payload,
      op,
      request_hash: hash,
      token_expiry: expiry,
    });
  const first = await call("canonical-test-hash");
  expect(first.error).toBeNull();
  try {
    const replay = await call("canonical-test-hash");
    expect(replay.error).toBeNull();
    expect(replay.data).toEqual(first.data);
    const conflict = await call("modified-payload-hash");
    expect(conflict.error?.message).toContain("OPERATION_CONFLICT");
    const expired = await call(
      "canonical-test-hash",
      new Date(Date.now() - 1000).toISOString(),
    );
    expect(expired.error?.message).toContain("INVALID_OPERATION");
    expect(
      (await stack.admin.from("upload_batches").select("id").eq(
        "id",
        first.data.batch_id,
      )).data,
    ).toHaveLength(1);
    expect(
      disposableSql(
        `select reserved_bytes from public.upload_reservations where batch_id='${first.data.batch_id}';`,
      ),
    ).toBe(String(10485760 + 100));
    expect(
      (await stack.admin.from("operation_receipts").select("operation_id").eq(
        "operation_id",
        op,
      )).data,
    ).toHaveLength(1);
  } finally {
    cleanupBatch(first.data.batch_id);
  }
});

it("partial staging retries only the failed file, preserves completed bytes and denies an expired reservation", async () => {
  const stack = await provisionCoupleLocal(), bytes = await tinyJpeg();
  const client = createClient(stack.url, stack.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  expect(
    (await client.auth.signInWithPassword({
      email: "first@example.test",
      password: "Local-Only-Test-Password-2026!",
    })).error,
  ).toBeNull();
  const op = randomUUID();
  const reserved = await stack.admin.rpc("reserve_upload", {
    actor: stack.users.first,
    payload: {
      files: Array.from(
        { length: 3 },
        () => ({
          client_file_id: randomUUID(),
          size: bytes.length,
          declared_type: "image/jpeg",
        }),
      ),
    },
    op,
    request_hash: op,
    token_expiry: new Date(Date.now() + 86400000).toISOString(),
  });
  expect(reserved.error).toBeNull();
  const batch = reserved.data,
    paths = batch.files.map((f: { path: string }) => f.path);
  const upload = (index: number, type = "image/jpeg") =>
    client.storage.from("staging").upload(paths[index], bytes, {
      contentType: type,
      cacheControl: "0",
    });
  try {
    expect((await upload(0)).error).toBeNull();
    expect((await upload(1, "application/pdf")).error).not.toBeNull();
    expect((await upload(1)).error).toBeNull();
    expect((await upload(0)).error).not.toBeNull(); // lost-response retry cannot overwrite/recreate A
    const stored = await stack.admin.storage.from("staging").download(paths[0]);
    expect(stored.error).toBeNull();
    expect(new Uint8Array(await stored.data!.arrayBuffer())).toEqual(bytes);
    expect(
      (await stack.admin.storage.from("staging").list(
        paths[0].split("/").slice(0, -1).join("/"),
      )).data,
    ).toHaveLength(2);
    const past = new Date(Date.now() - 1000).toISOString();
    expect(
      (await stack.admin.from("upload_batches").update({ expires_at: past }).eq(
        "id",
        batch.batch_id,
      )).error,
    ).toBeNull();
    expect(
      (await stack.admin.from("upload_reservations").update({
        expires_at: past,
      }).eq("batch_id", batch.batch_id)).error,
    ).toBeNull();
    expect((await upload(2)).error).not.toBeNull();
    expect((await client.storage.from("staging").download(paths[0])).error).not
      .toBeNull();
  } finally {
    expect((await stack.admin.storage.from("staging").remove(paths)).error)
      .toBeNull();
    cleanupBatch(batch.batch_id);
  }
});

it("concurrent quota reservations serialize at the 800 MiB cap", async () => {
  const stack = await provisionCoupleLocal();
  // Three independent 400 MiB reservations race for an isolated 800 MiB budget.
  const ids: string[] = [];
  try {
    const payload = {
      files: Array.from(
        { length: 20 },
        () => ({
          client_file_id: randomUUID(),
          size: 10485760,
          declared_type: "image/jpeg",
        }),
      ),
    };
    const results = await Promise.all([1, 2, 3].map(async () => {
      const op = randomUUID();
      return stack.admin.rpc("reserve_upload", {
        actor: stack.users.first,
        payload,
        op,
        request_hash: op,
        token_expiry: new Date(Date.now() + 86400000).toISOString(),
      });
    }));
    for (const result of results) {
      if (result.data) ids.push(result.data.batch_id);
    }
    // Two exact 400 MiB reservations fit; the third must fail, even concurrently.
    expect(ids).toHaveLength(2);
    expect(results.filter((r) => r.error?.message.includes("QUOTA_EXCEEDED")))
      .toHaveLength(1);
  } finally {
    for (const id of ids) {
      cleanupBatch(id);
    }
  }
});
