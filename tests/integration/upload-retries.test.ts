import {
  finalizePayload as finalize,
  uploadContext as context,
} from "../helpers/uploads";
import { expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { tinyJpeg } from "../helpers/images";
import { disposableSql } from "../helpers/disposableStack";
import { startBrowserImageHarness } from "../helpers/browserImage";
import { chromium } from "@playwright/test";
import {
  ImageMagick,
  MagickColors,
  MagickFormat,
} from "@imagemagick/magick-wasm";

declare global {
  interface Window {
    __loverPrepareImage: (file: File) => Promise<{
      file: File;
      width: number;
      height: number;
      sourceWidth: number;
      sourceHeight: number;
    }>;
  }
}

it("partial finalization reuses stable file identities and emits exactly one batch event/notice with preserved read state", async () => {
  const ctx = await context(),
    bytes = await tinyJpeg(),
    batch = await ctx.reserve(bytes, 2);
  try {
    expect(
      (await ctx.clients.first.storage.from("staging").upload(
        batch.files[0].path,
        bytes,
        { contentType: "image/jpeg" },
      )).error,
    ).toBeNull();
    const first = await ctx.execute("upload.finalize", finalize(batch));
    expect(first.files[0].state).toBe("ready");
    const pendingEnvelope = await ctx.issue(
      "upload.finalize",
      finalize(batch, 1),
    );
    const failedResponse = await ctx.send("first", pendingEnvelope);
    expect(failedResponse.status).toBe(200);
    const failed = await failedResponse.json();
    expect(failed.files[0]).toMatchObject({
      state: "failed",
      error_code: "NOT_UPLOADED",
    });
    const event = (await ctx.admin.from("change_events").select("id").eq(
      "resource_id",
      batch.batch_id,
    )).data!;
    expect(event).toHaveLength(1);
    const notices = await ctx.admin.from("notifications").select(
      "id,recipient_id",
    ).eq("event_id", event[0].id);
    expect(notices.data).toHaveLength(1);
    expect(notices.data![0].recipient_id).toBe(ctx.users.partner);
    const readAt = "2026-01-01T00:00:00+00:00";
    await ctx.admin.from("notifications").update({ read_at: readAt }).eq(
      "id",
      notices.data![0].id,
    );
    expect(
      (await ctx.clients.first.storage.from("staging").upload(
        batch.files[1].path,
        bytes,
        { contentType: "image/jpeg" },
      )).error,
    ).toBeNull();
    // A completed failed operation is immutable: retrying its envelope does not republish.
    expect(await (await ctx.send("first", pendingEnvelope)).json()).toEqual(
      failed,
    );
    const second = await ctx.execute("upload.finalize", finalize(batch, 1));
    expect(second.files[0].state).toBe("ready");
    expect(
      (await ctx.admin.from("change_events").select("id").eq(
        "resource_id",
        batch.batch_id,
      )).data,
    ).toHaveLength(1);
    const stable = (await ctx.admin.from("notifications").select("read_at").eq(
      "id",
      notices.data![0].id,
    )).data!;
    expect(stable[0].read_at).toBe(readAt);
    expect(
      (await ctx.admin.from("deliveries").select("id,state").eq(
        "notification_id",
        notices.data![0].id,
      )).data,
    ).toEqual([expect.objectContaining({ state: "disabled" })]);
    const status =
      (await ctx.clients.first.rpc("upload_status", { batch: batch.batch_id }))
        .data;
    expect(status).toMatchObject({ success_count: 2, failure_count: 0 });
    const photos =
      (await ctx.clients.partner.from("photos").select("id,storage_path").in(
        "id",
        batch.files.map((f: { file_id: string }) => f.file_id),
      )).data!;
    expect(photos).toHaveLength(2);
    expect(
      (await ctx.clients.partner.storage.from("media").download(
        photos[0].storage_path,
      )).error,
    ).toBeNull();
    expect(
      (await ctx.clients.outsider.storage.from("media").download(
        photos[0].storage_path,
      )).error,
    ).not.toBeNull();
    expect(
      (await ctx.clients.first.from("upload_files").select("file_id")).error,
    ).not.toBeNull();
    await ctx.execute("upload.close", { batch_id: batch.batch_id });
    expect(
      (await ctx.clients.partner.from("photos").select("id").in(
        "id",
        batch.files.map((f: { file_id: string }) => f.file_id),
      )).data,
    ).toHaveLength(2);
  } finally {
    await ctx.cleanup(batch.batch_id);
  }
});

it("concurrent exact finalization and response-loss replay publish once, deny other actors and reject modified identifiers", async () => {
  const ctx = await context(),
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
    expect(
      (await ctx.send("partner", {
        command: "operation.issue",
        payload: { command: "upload.finalize", payload: finalize(batch) },
      })).status,
    ).toBe(403);
    const envelope = await ctx.issue("upload.finalize", finalize(batch));
    expect(
      (await ctx.send("first", {
        ...envelope,
        payload: { ...envelope.payload, file_ids: [randomUUID()] },
      })).status,
    ).toBe(409);
    expect((await ctx.send("outsider", envelope)).status).toBe(409);
    const responses = await Promise.all([
      ctx.send("first", envelope),
      ctx.send("first", envelope),
    ]);
    expect(responses.some((r) => r.status === 200)).toBe(true);
    expect(responses.every((r) => [200, 409].includes(r.status))).toBe(true);
    const replay = await ctx.send("first", envelope);
    expect(replay.status).toBe(200);
    const result = await replay.json();
    expect(result.files[0].state).toBe("ready");
    expect(
      (await ctx.admin.from("photos").select("id").eq(
        "id",
        batch.files[0].file_id,
      )).data,
    ).toHaveLength(1);
    expect(
      (await ctx.admin.from("operation_receipts").select("operation_id").eq(
        "operation_id",
        envelope.operation_id,
      )).data,
    ).toHaveLength(1);
    expect(
      (await ctx.admin.from("change_events").select("id").eq(
        "resource_id",
        batch.batch_id,
      )).data,
    ).toHaveLength(1);
    expect(
      disposableSql(
        `select reserved_bytes from public.upload_reservations where batch_id='${batch.batch_id}';`,
      ),
    ).toBe("0");
  } finally {
    await ctx.cleanup(batch.batch_id);
  }
});

it("invalid bytes, close and expiry never publish photos or emit zero-success batch notifications", async () => {
  const ctx = await context(),
    bytes = new Uint8Array([255, 216, 255, 224, 0, 0]),
    batch = await ctx.reserve(bytes, 2);
  try {
    expect(
      (await ctx.clients.first.storage.from("staging").upload(
        batch.files[0].path,
        bytes,
        { contentType: "image/jpeg" },
      )).error,
    ).toBeNull();
    const invalid = await ctx.execute("upload.finalize", finalize(batch));
    expect(invalid.files[0]).toMatchObject({
      state: "failed",
      error_code: "INVALID_IMAGE",
    });
    await ctx.execute("upload.close", { batch_id: batch.batch_id });
    expect(
      (await ctx.send(
        "first",
        await ctx.issue("upload.finalize", finalize(batch, 1)),
      )).status,
    ).toBe(409);
    expect(
      (await ctx.admin.from("change_events").select("id").eq(
        "resource_id",
        batch.batch_id,
      )).data,
    ).toHaveLength(0);
  } finally {
    await ctx.cleanup(batch.batch_id);
  }
  const expired = await ctx.reserve(await tinyJpeg());
  try {
    const envelope = await ctx.issue("upload.finalize", finalize(expired));
    expect(
      (await ctx.admin.from("upload_batches").update({
        expires_at: new Date(Date.now() - 1000).toISOString(),
      }).eq("id", expired.batch_id)).error,
    ).toBeNull();
    expect((await ctx.send("first", envelope)).status).toBe(409);
    expect(
      (await ctx.admin.from("photos").select("id").eq(
        "id",
        expired.files[0].file_id,
      )).data,
    ).toHaveLength(0);
  } finally {
    await ctx.cleanup(expired.batch_id);
  }
});

it("24MP source is browser-prepared then validated and published in the actual limited Edge worker", async () => {
  const ctx = await context();
  await tinyJpeg(); // initialize the synthetic fixture encoder
  const source = ImageMagick.read(
    MagickColors.Pink,
    6000,
    4000,
    (image) =>
      image.write(
        MagickFormat.Jpeg,
        (bytes) => Buffer.from(bytes).toString("base64"),
      ),
  );
  const browser = await chromium.launch();
  let harness: Awaited<ReturnType<typeof startBrowserImageHarness>> | undefined;
  let prepared: {
    base64: string;
    width: number;
    height: number;
    sourceWidth: number;
    sourceHeight: number;
  };
  try {
    harness = await startBrowserImageHarness();
    const page = await browser.newPage();
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    const moduleResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/src/lib/prepareImage.ts"
    );
    await page.goto(harness.url);
    expect((await moduleResponse).status()).toBe(200);
    await page.waitForFunction(() =>
      typeof window.__loverPrepareImage === "function"
    );
    // Only native browser work/data crosses evaluate; module loading happens in the HTML page.
    prepared = await page.evaluate(async (source) => {
      const result = await window.__loverPrepareImage(
        new File(
          [Uint8Array.from(atob(source), (c) => c.charCodeAt(0))],
          "source.jpg",
          { type: "image/jpeg" },
        ),
      );
      const bytes = new Uint8Array(await result.file.arrayBuffer());
      const decoded = await createImageBitmap(result.file);
      const width = decoded.width, height = decoded.height;
      decoded.close();
      let binary = "";
      for (let at = 0; at < bytes.length; at += 8192) {
        binary += String.fromCharCode(...bytes.subarray(at, at + 8192));
      }
      return {
        base64: btoa(binary),
        width,
        height,
        sourceWidth: result.sourceWidth,
        sourceHeight: result.sourceHeight,
      };
    }, source);
    expect(browserErrors).toEqual([]);
  } finally {
    await browser.close();
    await harness?.close();
  }
  expect(prepared).toMatchObject({
    sourceWidth: 6000,
    sourceHeight: 4000,
    width: 1600,
    height: 1066,
  });
  expect(Math.max(prepared.width, prepared.height)).toBeLessThanOrEqual(1600);
  const bytes = Uint8Array.from(Buffer.from(prepared.base64, "base64")),
    batch = await ctx.reserve(bytes);
  try {
    expect(
      (await ctx.clients.first.storage.from("staging").upload(
        batch.files[0].path,
        bytes,
        { contentType: "image/jpeg" },
      )).error,
    ).toBeNull();
    const started = performance.now(),
      result = await ctx.execute("upload.finalize", finalize(batch));
    expect(result.files[0].state).toBe("ready");
    const photo = (await ctx.clients.partner.from("photos").select(
      "width,height,bytes,storage_path",
    ).eq(
      "id",
      result.files[0].photo_id,
    ).single()).data;
    expect(photo).toMatchObject({ width: 1600, height: 1066 });
    const download = await ctx.clients.partner.storage.from("media").download(
      photo!.storage_path,
    );
    expect(download.error).toBeNull();
    expect(download.data!.size).toBe(photo!.bytes);
    expect(
      (await ctx.clients.outsider.storage.from("media").download(
        photo!.storage_path,
      )).error,
    ).not.toBeNull();
    expect(
      (await ctx.clients.partner.storage.from("media").createSignedUrl(
        photo!.storage_path,
        60,
      )).error,
    ).not.toBeNull();
    console.log(
      JSON.stringify({
        gate: "actual-edge-finalization",
        sourcePixels: 24000000,
        preparedBytes: bytes.length,
        storedBytes: photo!.bytes,
        requestWallMs: Math.round(performance.now() - started),
      }),
    );
  } finally {
    await ctx.cleanup(batch.batch_id);
  }
});

it("unpublished orphan compensation preserves stable IDs and exact failed receipts", async () => {
  const ctx = await context(),
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
    const row = (await ctx.admin.from("upload_files").select("media_path").eq(
      "file_id",
      batch.files[0].file_id,
    ).single()).data!;
    expect(
      (await ctx.admin.storage.from("media").upload(
        row.media_path,
        new Uint8Array([255, 216, 255, 217]),
        { contentType: "image/jpeg" },
      )).error,
    ).toBeNull();
    expect(
      (await ctx.clients.partner.storage.from("media").download(row.media_path))
        .error,
    ).not.toBeNull();
    const envelope = await ctx.issue("upload.finalize", finalize(batch));
    const response = await ctx.send("first", envelope);
    expect(response.status).toBe(200);
    const failed = await response.json();
    expect(failed.files[0]).toMatchObject({
      state: "failed",
      error_code: "STORAGE_UNAVAILABLE",
    });
    expect(
      (await ctx.admin.storage.from("media").download(row.media_path)).error,
    ).not.toBeNull();
    const recovered = await ctx.execute("upload.finalize", finalize(batch));
    expect(recovered.files[0]).toMatchObject({
      state: "ready",
      photo_id: batch.files[0].file_id,
    });
    expect(await (await ctx.send("first", envelope)).json()).toEqual(failed);
    expect(
      (await ctx.admin.from("change_events").select("id").eq(
        "resource_id",
        batch.batch_id,
      )).data,
    ).toHaveLength(1);
  } finally {
    await ctx.cleanup(batch.batch_id);
  }
});

it("quarantine revokes late publication before compensating deletion", async () => {
  const ctx = await context(),
    bytes = await tinyJpeg(),
    batch = await ctx.reserve(bytes),
    file = batch.files[0].file_id;
  try {
    expect(
      (await ctx.clients.first.storage.from("staging").upload(
        batch.files[0].path,
        bytes,
        { contentType: "image/jpeg" },
      )).error,
    ).toBeNull();
    const claimed = await ctx.admin.rpc("claim_upload_file", {
      actor: ctx.users.first,
      batch: batch.batch_id,
      reservation: batch.reservation_id,
      file,
    });
    expect(claimed.error).toBeNull();
    const quarantined = await ctx.admin.rpc("quarantine_upload_file", {
      actor: ctx.users.first,
      batch: batch.batch_id,
      file,
      claim: claimed.data.lease_id,
    });
    expect(quarantined.error).toBeNull();
    const late = await ctx.admin.rpc("publish_upload_file", {
      actor: ctx.users.first,
      batch: batch.batch_id,
      reservation: batch.reservation_id,
      file,
      claim: claimed.data.lease_id,
      output_bytes: bytes.length,
      image_width: 24,
      image_height: 16,
      source_hash: createHash("sha256").update(bytes).digest("hex"),
    });
    expect(late.error?.message).toContain("UPLOAD_CONFLICT");
    const failed = await ctx.admin.rpc("fail_upload_file", {
      actor: ctx.users.first,
      batch: batch.batch_id,
      file,
      claim: quarantined.data.lease_id,
      code: "STORAGE_UNAVAILABLE",
    });
    expect(failed.error).toBeNull();
    expect(
      (await ctx.execute("upload.finalize", finalize(batch))).files[0].state,
    ).toBe("ready");
  } finally {
    await ctx.cleanup(batch.batch_id);
  }
});
