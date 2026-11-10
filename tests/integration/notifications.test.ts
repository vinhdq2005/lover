import { expect, it } from "vitest";
import { uploadContext, finalizePayload } from "../helpers/uploads";
import { tinyJpeg } from "../helpers/images";
import { disposableSql } from "../helpers/disposableStack";
it("recipient inbox, email opt-in and concurrent leased/quota/dedupe recovery use no real sender", async () => {
  const ctx = await uploadContext();
  const reset = () =>
    disposableSql(
      "begin; update private.notification_config set email_enabled=false; update private.usage_budget set email_attempts=0,day=null where scope='email'; delete from public.change_events; delete from public.notification_preferences; commit;",
    );
  reset();
  try {
    await ctx.execute("memory.create", {
      title: "Synthetic notice",
      description: "Never email this private text",
      event_date: "2024-01-01",
    });
    expect((await ctx.clients.first.rpc("notification_inbox")).data).toEqual(
      [],
    );
    expect((await ctx.clients.outsider.rpc("notification_inbox")).data).toEqual(
      [],
    );
    const inbox = await ctx.clients.partner.rpc("notification_inbox");
    expect(inbox.error).toBeNull();
    expect(inbox.data).toHaveLength(1);
    expect(inbox.data[0].delivery_state).toBe("disabled");
    const read = await ctx.issue("notification.mark_read", {
      notification_id: inbox.data[0].id,
    }, "partner");
    expect((await ctx.send("partner", read)).status).toBe(200);
    expect((await ctx.send("partner", read)).status).toBe(200);
    expect(
      (await ctx.clients.partner.rpc("notification_inbox")).data[0].read_at,
    ).toBeTruthy();
    expect(
      (await ctx.send("first", {
        command: "operation.issue",
        payload: {
          command: "notification.mark_read",
          payload: { notification_id: inbox.data[0].id },
        },
      })).status,
    ).toBe(403);
    const preference = await ctx.issue("notification.preferences", {
      expected_version: 0,
      email_enabled: true,
    }, "partner");
    expect((await ctx.send("partner", preference)).status).toBe(200);
    disposableSql("update private.notification_config set email_enabled=true;");
    expect(
      (await ctx.admin.rpc("claim_email", { delivery_enabled: true })).data,
    ).toEqual([]); // disabled history never replays
    await ctx.execute("entry.create", {
      kind: "letter",
      title: "Private title",
      content: "Private body",
      event_date: "2024-01-01",
    });
    const concurrent = await Promise.all([
      ctx.admin.rpc("claim_email", { delivery_enabled: true }),
      ctx.admin.rpc("claim_email", { delivery_enabled: true }),
    ]);
    concurrent.forEach((r) => expect(r.error).toBeNull());
    const jobs = concurrent.flatMap((r) => r.data);
    expect(jobs).toHaveLength(1);
    const job = jobs[0];
    expect(
      (await ctx.admin.rpc("email_target", {
        delivery: job.id,
        lease: job.lease,
      })).data,
    ).toBe("partner@example.test");
    expect(
      (await ctx.admin.rpc("finish_email", {
        delivery: job.id,
        lease: job.lease,
        outcome: "unknown",
      })).error,
    ).toBeNull();
    disposableSql(
      "update public.deliveries set next_attempt_at=now()-interval '1 second' where state='unknown';",
    );
    const retry = await ctx.admin.rpc("claim_email", {
      delivery_enabled: true,
    });
    expect(retry.error).toBeNull();
    expect(retry.data).toHaveLength(1);
    expect(retry.data[0].eventKey).toBe(job.eventKey);
    expect(
      (await ctx.admin.rpc("finish_email", {
        delivery: job.id,
        lease: retry.data[0].lease,
        outcome: "unknown",
      })).error,
    ).toBeNull();
    disposableSql(
      "update public.deliveries set first_attempt_at=now()-interval '31 minutes',next_attempt_at=now()-interval '1 second' where state='unknown';",
    );
    expect(
      (await ctx.admin.rpc("claim_email", { delivery_enabled: true })).data,
    ).toEqual([]);
    expect(
      (await ctx.admin.from("deliveries").select("error_code").eq("id", job.id)
        .single()).data?.error_code,
    ).toBe("DEDUPE_EXPIRED");
    await ctx.execute("album.create", { title: "Quota fixture" });
    disposableSql(
      "update private.usage_budget set email_attempts=100 where scope='email';",
    );
    expect(
      (await ctx.admin.rpc("claim_email", { delivery_enabled: true })).data,
    ).toEqual([]);
    expect(
      (await ctx.admin.from("deliveries").select("state").eq(
        "state",
        "deferred_quota",
      )).data,
    ).toHaveLength(1);
    expect((await ctx.clients.partner.rpc("notification_inbox")).data)
      .toHaveLength(3);
    expect((await ctx.clients.partner.from("deliveries").select("id")).error)
      .not.toBeNull();
  } finally {
    reset();
  }
});
it("later upload successes update recipient summary without another email disposition", async () => {
  const ctx=await uploadContext(), bytes=await tinyJpeg(), batch=await ctx.reserve(bytes,2);
  try {
    disposableSql("update private.notification_config set email_enabled=true;update private.usage_budget set email_attempts=0,day=null where scope='email';delete from public.change_events;");
    await ctx.admin.from("notification_preferences").upsert({user_id:ctx.users.partner,email_enabled:true});
    for(const file of batch.files) expect((await ctx.clients.first.storage.from("staging").upload(file.path,bytes,{contentType:"image/jpeg"})).error).toBeNull();
    await ctx.execute("upload.finalize",finalizePayload(batch,0));
    const first=await ctx.clients.partner.rpc("notification_inbox");expect(first.data).toHaveLength(1);
    const claim=await ctx.admin.rpc("claim_email",{delivery_enabled:true});expect(claim.data).toHaveLength(1);
    const job=claim.data[0];expect((await ctx.admin.rpc("finish_email",{delivery:job.id,lease:job.lease,outcome:"accepted",provider_id:"mock-batch-only"})).error).toBeNull();
    const read=await ctx.issue("notification.mark_read",{notification_id:first.data[0].id},"partner");expect((await ctx.send("partner",read)).status).toBe(200);
    await ctx.execute("upload.finalize",finalizePayload(batch,1));
    const later=await ctx.clients.partner.rpc("notification_inbox");expect(later.data).toHaveLength(1);expect(later.data[0].id).toBe(first.data[0].id);
    expect(later.data[0].read_at).toBeTruthy();expect(later.data[0].upload_summary.success_count).toBe(2);
    expect(later.data[0].delivery_state).toBe("accepted");expect((await ctx.admin.rpc("claim_email",{delivery_enabled:true})).data).toEqual([]);
  } finally {await ctx.cleanup(batch.batch_id);disposableSql("update private.notification_config set email_enabled=false;delete from public.notification_preferences;update private.usage_budget set email_attempts=0,day=null where scope='email';");}
});
