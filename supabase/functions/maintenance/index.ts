import { createClient } from "@supabase/supabase-js";
import { requireWorker } from "../_shared/workerAuth.ts";
import { errorResponse, HttpError } from "../_shared/http.ts";
import { isMissingObject } from "../_shared/storageErrors.ts";
Deno.serve(async (request) => {
  try {
    requireWorker(request, Deno.env.get("WORKER_SECRET"));
    const url = Deno.env.get("SUPABASE_URL"),
      key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new HttpError(503);
    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const claimed = await admin.rpc("begin_media_maintenance");
    if (claimed.error) throw new HttpError(503);
    if (!claimed.data) {
      return Response.json({ state: "busy", processed: 0 }, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    const lease = claimed.data;
    let processed = 0, failed = 0;
    try {
      const candidates = await admin.rpc("media_cleanup_candidates", { lease });
      if (candidates.error) throw new HttpError(503);
      for (
        const job of candidates.data as {
          kind: string;
          id: string;
          paths: string[];
        }[]
      ) {
        if (job.kind === "reconcile") {
          const info = await admin.storage.from("media").info(job.paths[0]);
          const missing = isMissingObject(info.error);
          if (info.error && !missing) {
            failed++;
            continue;
          }
          const done = await admin.rpc("confirm_media_reconciliation", {
            lease,
            photo: job.id,
            missing: !!missing,
          });
          if (done.error) failed++;
          else processed++;
        } else {
          const groups = job.kind === "unpublished"
            ? [{ bucket: "staging", paths: [job.paths[0]] }, {
              bucket: "media",
              paths: [job.paths[1]],
            }]
            : [{
              bucket: job.kind === "staging" ? "staging" : "media",
              paths: job.paths,
            }];
          let removed = true;
          for (const group of groups) {
            if (
              (await admin.storage.from(group.bucket).remove(group.paths)).error
            ) {
              removed = false;
              break;
            }
          }
          if (!removed) {
            failed++;
            continue;
          }
          const done = await admin.rpc("confirm_media_cleanup", {
            lease,
            kind: job.kind,
            target: job.id,
          });
          if (done.error) failed++;
          else processed++;
        }
      }
    } finally {
      await admin.rpc("end_media_maintenance", { lease });
    }
    return Response.json({ state: "complete", processed, failed }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error instanceof HttpError ? error.status : 503);
  }
});
