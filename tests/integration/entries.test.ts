import { expect, it } from "vitest";
import { uploadContext } from "../helpers/uploads";
import { disposableSql } from "../helpers/disposableStack";

it("real entry API preserves shared Unicode, author ownership, replay and stale-version events", async () => {
  const ctx = await uploadContext();
  try {
    const input = {
      kind: "letter",
      title: "Thư cho em 💗",
      content: "é <script>window.pwned=true</script>\n" +
        "💗".repeat(50000 - 40),
      event_date: "2024-02-29",
    };
    const op = await ctx.issue("entry.create", input);
    const response = await ctx.send("first", op);
    expect(response.status).toBe(200);
    const { id } = await response.json();
    expect((await ctx.send("first", op)).status).toBe(200);
    const shared = await ctx.clients.partner.from("entries").select("*").eq(
      "id",
      id,
    ).single();
    expect(shared.error).toBeNull();
    expect(shared.data?.content).toBe(input.content);
    expect(shared.data?.author_id).toBe(ctx.users.first);
    const hidden = await ctx.clients.outsider.from("entries").select("id").eq(
      "id",
      id,
    );
    expect(hidden.error).toBeNull();
    expect(hidden.data).toEqual([]);
    expect(
      (await ctx.send("partner", {
        command: "operation.issue",
        payload: {
          command: "entry.delete",
          payload: { id, expected_version: 1 },
        },
      })).status,
    ).toBe(403);
    expect(
      (await ctx.clients.partner.from("entries").update({ title: "forged" }).eq(
        "id",
        id,
      )).error,
    ).not.toBeNull();
    expect(
      (await ctx.send("first", {
        ...op,
        payload: { ...input, title: "modified" },
      })).status,
    ).not.toBe(200);
    const stale = await ctx.issue("entry.update", {
      ...input,
      id,
      expected_version: 1,
      title: "Stale tab",
    });
    await ctx.execute("entry.update", {
      ...input,
      id,
      expected_version: 1,
      title: "Đã sửa",
    });
    expect((await ctx.send("first", stale)).status).toBe(409);
    await ctx.execute("entry.update", {
      ...input,
      id,
      expected_version: 2,
      title: "Đã sửa",
    });
    const events = await ctx.admin.from("change_events").select("id").eq(
      "resource_id",
      id,
    );
    expect(events.error).toBeNull();
    expect(events.data).toHaveLength(2); // create + changed update, never retry/no-op/stale.
    const notices = await ctx.admin.from("notifications").select("recipient_id")
      .in("event_id", events.data!.map((event) => event.id));
    expect(notices.data).toEqual([{ recipient_id: ctx.users.partner }, {
      recipient_id: ctx.users.partner,
    }]);
    const deletion = await ctx.issue("entry.delete", {
      id,
      expected_version: 2,
    });
    expect((await ctx.send("first", deletion)).status).toBe(200);
    expect((await ctx.send("first", deletion)).status).toBe(200);
    expect(
      (await ctx.clients.partner.from("entries").select("id").eq("id", id))
        .data,
    ).toEqual([]);
  } finally {
    disposableSql(
      "begin; delete from public.entries; delete from public.change_events where category='entry'; delete from public.operation_receipts where command like 'entry.%'; commit;",
    );
  }
});
