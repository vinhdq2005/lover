import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { backupManifest, seal, unseal } from "../../scripts/backup-manifest";
import { finalizePayload, uploadContext } from "../helpers/uploads";
import { tinyJpeg } from "../helpers/images";
import {
  disposableContainer,
  disposableSql,
  disposableStatus,
} from "../helpers/disposableStack";
it("encrypted real DB/private-media export restores only inside the disposable project with RLS intact", async () => {
  const ctx = await uploadContext(),
    source = await tinyJpeg(),
    batch = await ctx.reserve(source);
  let memoryId:string|undefined,entryId:string|undefined;
  try {
    expect(
      (await ctx.clients.first.storage.from("staging").upload(
        batch.files[0].path,
        source,
        { contentType: "image/jpeg" },
      )).error,
    ).toBeNull();
    await ctx.execute("upload.finalize", finalizePayload(batch));
    memoryId=(await ctx.execute("memory.create",{title:"Synthetic restore memory",description:"Preserve tiếng Việt é 💗",event_date:"2024-01-01"})).id;
    entryId=(await ctx.execute("entry.create",{kind:"letter",title:"Synthetic restore letter",content:"Preserve shared letter 💗",event_date:"2024-01-01"})).id;
    disposableSql(
      "update private.notification_config set email_enabled=false;",
    );
    disposableStatus();
    const dump = spawnSync("docker", [
      "exec",
      disposableContainer,
      "pg_dump",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-Fc",
      "--data-only",
      "--table=public.*",
      "--table=private.*",
      "--table=auth.users",
      "--table=auth.identities",
    ], { maxBuffer: 32 * 1024 * 1024 });
    expect(dump.status, "disposable pg_dump exit").toBe(0);
    const objects: { bucket_id: string; name: string }[] = JSON.parse(
      disposableSql(
        "select coalesce(json_agg(json_build_object('bucket_id',bucket_id,'name',name)),'[]') from storage.objects where bucket_id in('media','staging');",
      ),
    );
    const media = [];
    for (const object of objects) {
      const result = await ctx.admin.storage.from(object.bucket_id).download(
        object.name,
      );
      expect(result.error).toBeNull();
      media.push({
        ...object,
        bytes: Buffer.from(await result.data!.arrayBuffer()).toString("base64"),
      });
    }
    expect(media.length).toBeGreaterThan(0);
    const password = "synthetic-backup-passphrase-2026",
      archive = seal(
        Buffer.from(
          JSON.stringify({ database: dump.stdout.toString("base64"), media }),
        ),
        password,
      ),
      manifest = backupManifest(archive);
    expect(manifest.bytes).toBe(archive.length);
    const restored = JSON.parse(unseal(archive, password).toString());
    // Remove through Storage API before Auth CASCADE, never orphan physical private files.
    for (const bucket of ["media", "staging"]) {
      const paths = objects.filter((o) => o.bucket_id === bucket).map((o) =>
        o.name
      );
      if (paths.length) {
        expect((await ctx.admin.storage.from(bucket).remove(paths)).error)
          .toBeNull();
      }
    }
    const tables: string[] = JSON.parse(
      disposableSql(
        "select json_agg(format('%I.%I',schemaname,tablename)) from pg_tables where schemaname in('public','private') or (schemaname='auth' and tablename in('users','identities'));",
      ),
    );
    disposableSql("truncate " + tables.join(",") + " cascade;");
    disposableStatus();
    const restore = spawnSync("docker", [
      "exec",
      "-i",
      disposableContainer,
      "pg_restore",
      "-U",
      "supabase_admin",
      "-d",
      "postgres",
      "--data-only",
      "--disable-triggers",
      "--no-owner",
      "--no-acl",
    ], {
      input: Buffer.from(restored.database, "base64"),
      maxBuffer: 32 * 1024 * 1024,
    });
    expect(
      restore.status,
      "disposable pg_restore exit (private output withheld; " + (restore.stderr.toString().includes("system trigger") ? "SYSTEM_TRIGGER_PRIVILEGE" : restore.stderr.toString().includes("must be owner") ? "TABLE_OWNER_PRIVILEGE" : "RESTORE_STATUS") + ")",
    ).toBe(0);
    for (const object of restored.media) {
      const bytes = Buffer.from(object.bytes, "base64");
      expect(
        (await ctx.admin.storage.from(object.bucket_id).upload(
          object.name,
          bytes,
          { contentType: "image/jpeg" },
        )).error,
      ).toBeNull();
      const downloaded = await ctx.admin.storage.from(object.bucket_id)
        .download(object.name);
      expect(downloaded.error).toBeNull();
      expect(
        createHash("sha256").update(
          Buffer.from(await downloaded.data!.arrayBuffer()),
        ).digest("hex"),
      ).toBe(createHash("sha256").update(bytes).digest("hex"));
    }
    for (const role of ["first", "partner", "outsider"]) {
      const client = createClient(ctx.url, ctx.key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const signed = await client.auth.signInWithPassword({
        email: role + "@example.test",
        password: "Local-Only-Test-Password-2026!",
      });
      expect(signed.error).toBeNull();
      const read = await client.from("photos").select("id,storage_path").eq(
        "id",
        batch.files[0].file_id,
      );
      expect(read.error).toBeNull();
      expect(read.data).toHaveLength(role === "outsider" ? 0 : 1);
      const memories=await client.from("memories").select("description").eq("id",memoryId!);
      const entries=await client.from("entries").select("content").eq("id",entryId!);
      expect(memories.data).toEqual(role==="outsider"?[]:[{description:"Preserve tiếng Việt é 💗"}]);
      expect(entries.data).toEqual(role==="outsider"?[]:[{content:"Preserve shared letter 💗"}]);
      if (role !== "outsider") {
        expect(
          (await client.storage.from("media").download(
            read.data![0].storage_path,
          )).error,
        ).toBeNull();
      } else {
        const mediaPath=restored.media.find((object:{bucket_id:string})=>object.bucket_id==="media").name;
        expect((await client.storage.from("media").download(mediaPath)).error).not.toBeNull();
      }
    }
  } finally {
    await ctx.cleanup(batch.batch_id);
    if(memoryId)await ctx.admin.from("memories").delete().eq("id",memoryId);
    if(entryId)await ctx.admin.from("entries").delete().eq("id",entryId);
  }
});
