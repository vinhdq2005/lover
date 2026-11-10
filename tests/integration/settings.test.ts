import { expect, it } from "vitest";
import { finalizePayload, uploadContext } from "../helpers/uploads";
import { tinyJpeg } from "../helpers/images";
it("settings enforce own profile, ready images, shared conflicts and no-op receipts through real Edge", async () => {
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
    await ctx.execute("upload.finalize", finalizePayload(batch));
    const first = (await ctx.admin.from("profiles").select("version").eq(
      "user_id",
      ctx.users.first,
    ).single()).data!;
    const profile = await ctx.issue("profile.update", {
      expected_version: first.version,
      display_name: "Mình 💗",
      avatar_photo_id: batch.files[0].file_id,
    });
    expect((await ctx.send("first", profile)).status).toBe(200);
    expect((await ctx.send("first", profile)).status).toBe(200);
    expect(
      (await ctx.send("first", {
        command: "operation.issue",
        payload: {
          command: "profile.update",
          payload: {
            display_name: "forged",
            expected_version: 1,
            user_id: ctx.users.partner,
          },
        },
      })).status,
    ).toBe(400);
    const partner = (await ctx.admin.from("profiles").select("version").eq(
      "user_id",
      ctx.users.partner,
    ).single()).data!;
    const forbiddenAvatar = await ctx.issue("profile.update", {
      expected_version: partner.version,
      display_name: "Partner",
      avatar_photo_id: batch.files[0].file_id,
    }, "partner");
    expect((await ctx.send("partner", forbiddenAvatar)).status).toBe(400);
    const couple = (await ctx.admin.from("couples").select("version").single())
      .data!;
    const shared = {
      expected_version: couple.version,
      name: "Nhà chung 💗",
      featured_photo_id: batch.files[0].file_id,
    };
    const stale = await ctx.issue("couple.update", {
      ...shared,
      name: "Stale",
    });
    const partnerChange = await ctx.issue("couple.update", shared, "partner");
    expect((await ctx.send("partner", partnerChange)).status).toBe(200);
    expect((await ctx.send("first", stale)).status).toBe(409);
    const eventsBefore =
      (await ctx.admin.from("change_events").select("id")).data!.length;
    await ctx.execute("couple.update", {
      ...shared,
      expected_version: couple.version + 1,
    });
    expect((await ctx.admin.from("change_events").select("id")).data)
      .toHaveLength(eventsBefore);
    expect(
      (await ctx.clients.partner.from("profiles").select("display_name").eq(
        "user_id",
        ctx.users.first,
      ).single()).data?.display_name,
    ).toBe("Mình 💗");
    expect((await ctx.clients.outsider.from("profiles").select("user_id")).data)
      .toEqual([]);
    expect(
      (await ctx.send("outsider", {
        command: "operation.issue",
        payload: { command: "couple.update", payload: shared },
      })).status,
    ).toBe(403);
    await ctx.execute("photo.delete", {
      id: batch.files[0].file_id,
      expected_version: 1,
    });
    const refreshed =
      (await ctx.admin.from("couples").select("version,featured_photo_id")
        .single()).data!;
    expect(refreshed.featured_photo_id).toBeNull();
    const removed = await ctx.issue("couple.update", {
      expected_version: refreshed.version,
      featured_photo_id: batch.files[0].file_id,
    });
    expect((await ctx.send("first", removed)).status).toBe(400);
  } finally {
    await ctx.cleanup(batch.batch_id);
  }
});
