import { provisionCoupleLocal } from "../tests/helpers/localStack.ts";
import {
  disposableRoot,
  disposableSql,
} from "../tests/helpers/disposableStack.ts";
import { tinyJpeg } from "../tests/helpers/images.ts";
import { randomUUID } from "node:crypto";
export async function seedPerformance() {
  if (process.env.LOVER_TEST_WORKDIR !== disposableRoot) {
    throw new Error("DISPOSABLE_PERFORMANCE_ONLY");
  }
  const ctx = await provisionCoupleLocal(),
    couple = (await ctx.admin.from("couples").select("id").single()).data!.id,
    bytes = await tinyJpeg();
  if (
    !/^[0-9a-f-]{36}$/.test(couple) ||
    !Object.values(ctx.users).every((id) => /^[0-9a-f-]{36}$/.test(id))
  ) throw new Error("INVALID_FIXTURE_ID");
  const photos = Array.from({ length: 2000 }, (_, i) => {
    const id = randomUUID();
    return {
      id,
      couple_id: couple,
      uploader_id: ctx.users.first,
      storage_path: couple + "/performance-" + id + ".jpg",
      description: "Synthetic photo " + i,
      event_date: "2024-01-01",
      bytes: bytes.length,
      format: "image/jpeg",
      width: 24,
      height: 16,
    };
  });
  if (bytes.length * photos.length > 20 * 1024 * 1024) {
    throw new Error("PERFORMANCE_FIXTURE_BYTE_CAP");
  }
  for (let offset = 0; offset < photos.length; offset += 20) {
    await Promise.all(
      photos.slice(offset, offset + 20).map(async (photo) => {
        const r = await ctx.admin.storage.from("media").upload(
          photo.storage_path,
          bytes,
          { contentType: "image/jpeg" },
        );
        if (r.error) throw new Error("PERFORMANCE_STORAGE_SEED_FAILED");
      }),
    );
  }
  for (let offset = 0; offset < photos.length; offset += 100) {
    const r = await ctx.admin.from("photos").insert(
      photos.slice(offset, offset + 100),
    );
    if (r.error) throw new Error("PERFORMANCE_PHOTO_SEED_FAILED");
  }
  const memories = Array.from(
    { length: 1000 },
    (_, i) => ({
      couple_id: couple,
      creator_id: ctx.users.first,
      title: "Synthetic memory " + i,
      description: "Synthetic performance fixture",
      event_date: "2024-01-01",
    }),
  );
  for (let offset = 0; offset < memories.length; offset += 100) {
    const r = await ctx.admin.from("memories").insert(
      memories.slice(offset, offset + 100),
    );
    if (r.error) throw new Error("PERFORMANCE_MEMORY_SEED_FAILED");
  }
  disposableSql(
    "update private.usage_budget set committed_bytes=" +
      (bytes.length * photos.length) + ",reserved_bytes=0 where scope='media';",
  );
  return {
    memories: 1000,
    photos: 2000,
    storageBytes: bytes.length * photos.length,
  };
}
