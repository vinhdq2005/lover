import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { finalizePayload, uploadContext } from "../helpers/uploads";
import { tinyJpeg } from "../helpers/images";
import { disposableSql } from "../helpers/disposableStack";
function secret() {
  const path = process.env.LOVER_TEST_EDGE_ENVFILE;
  if (!path) throw new Error("Disposable environment required");
  return readFileSync(path, "utf8").split(/\r?\n/).find((line) =>
    line.startsWith("WORKER_SECRET=")
  )!.slice("WORKER_SECRET=".length);
}
async function worker(
  ctx: Awaited<ReturnType<typeof uploadContext>>,
  key = secret(),
) {
  return fetch(ctx.url + "/functions/v1/maintenance", {
    method: "POST",
    headers: { apikey: ctx.key, "x-worker-secret": key },
  });
}
it("maintenance requires the worker secret and honors an exclusive lease", async () => {
  const ctx = await uploadContext();
  expect((await worker(ctx, "sb_publishable_fake")).status).toBe(403);
  const lease = await ctx.admin.rpc("begin_media_maintenance");
  expect(lease.error).toBeNull();
  expect(lease.data).toBeTruthy();
  try {
    const busy = await worker(ctx);
    expect(busy.status).toBe(200);
    expect(await busy.json()).toMatchObject({ state: "busy", processed: 0 });
  } finally {
    await ctx.admin.rpc("end_media_maintenance", { lease: lease.data });
  }
});
it("expired orphaned staging/media is removed before reservations are released, with idempotent recovery", async () => {
  const ctx = await uploadContext(),
    bytes = await tinyJpeg(),
    batch = await ctx.reserve(bytes, 2);
  try {
    const file = (await ctx.admin.from("upload_files").select("media_path").eq(
      "file_id",
      batch.files[0].file_id,
    ).single()).data!;
    expect(
      (await ctx.clients.first.storage.from("staging").upload(
        batch.files[0].path,
        bytes,
        { contentType: "image/jpeg" },
      )).error,
    ).toBeNull();
    expect(
      (await ctx.admin.storage.from("media").upload(file.media_path, bytes, {
        contentType: "image/jpeg",
      })).error,
    ).toBeNull();
    expect(
      (await ctx.admin.from("upload_batches").update({
        expires_at: new Date(Date.now() - 240000).toISOString(),
      }).eq("id", batch.batch_id)).error,
    ).toBeNull();
    const response = await worker(ctx);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      state: "complete",
      failed: 0,
    });
    expect(
      (await ctx.clients.first.rpc("upload_status", { batch: batch.batch_id }))
        .data,
    ).toMatchObject({ state: "expired" });
    expect(
      (await ctx.admin.storage.from("staging").download(batch.files[0].path))
        .error,
    ).not.toBeNull();
    expect(
      (await ctx.admin.storage.from("media").download(file.media_path)).error,
    ).not.toBeNull();
    expect(
      disposableSql(
        `select reserved_bytes from public.upload_reservations where batch_id='${batch.batch_id}';`,
      ),
    ).toBe("0");
    expect(
      (await ctx.admin.from("upload_files").select("cleanup_done").eq(
        "batch_id",
        batch.batch_id,
      )).data,
    ).toEqual([
      expect.objectContaining({ cleanup_done: true }),
      expect.objectContaining({ cleanup_done: true }),
    ]);
    const repeated = await worker(ctx);
    expect(repeated.status).toBe(200);
    expect(await repeated.json()).toMatchObject({ failed: 0 });
    expect(
      (await ctx.admin.from("change_events").select("id").eq(
        "resource_id",
        batch.batch_id,
      )).data,
    ).toHaveLength(0);
  } finally {
    await ctx.cleanup(batch.batch_id);
  }
});
it("deleting photos are physically removed once; missing ready objects preserve relationship metadata", async () => {
  const ctx = await uploadContext(),
    bytes = await tinyJpeg(),
    batch = await ctx.reserve(bytes);
  try {
    expect(
      (await ctx.clients.first.storage.from("staging").upload(
        batch.files[0].path,
        bytes,
        { contentType: "image/jpeg" },
      )).error,
    ).toBeNull();
    const ready = await ctx.execute("upload.finalize", finalizePayload(batch)),
      id = ready.files[0].photo_id;
    const photo =
      (await ctx.admin.from("photos").select("storage_path").eq("id", id)
        .single()).data!;
    expect(
      (await ctx.admin.storage.from("media").remove([photo.storage_path]))
        .error,
    ).toBeNull();
    const reconciled = await worker(ctx);
    expect(reconciled.status).toBe(200);
    expect(await reconciled.json()).toMatchObject({ failed: 0 });
    expect(
      (await ctx.admin.from("photos").select("state,storage_missing").eq(
        "id",
        id,
      ).single()).data,
    ).toEqual({ state: "ready", storage_missing: true });
    await ctx.execute("photo.delete", { id, expected_version: 1 });
    const events =
      (await ctx.admin.from("change_events").select("id").eq("resource_id", id))
        .data!.length;
    const removed = await worker(ctx);
    expect(removed.status).toBe(200);
    expect(await removed.json()).toMatchObject({ failed: 0 });
    expect(
      (await ctx.admin.from("photos").select("state,description").eq("id", id)
        .single()).data,
    ).toEqual({ state: "deleted", description: "" });
    expect(
      (await ctx.clients.partner.from("photos").select("id").eq("id", id)).data,
    ).toHaveLength(0);
    expect(
      (await ctx.admin.from("change_events").select("id").eq("resource_id", id))
        .data,
    ).toHaveLength(events);
    const repeated = await worker(ctx);
    expect(repeated.status).toBe(200);
    expect(await repeated.json()).toMatchObject({ failed: 0 });
  } finally {
    await ctx.cleanup(batch.batch_id);
  }
});
