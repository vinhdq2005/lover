import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireWorker } from "../_shared/workerAuth.ts";
import { errorResponse, HttpError } from "../_shared/http.ts";
import { configuredProvider } from "../_shared/mail/config.ts";
export function createNotificationWorker(
  overrides: {
    provider?: ReturnType<typeof configuredProvider>;
    secret?: string;
    admin?: SupabaseClient;
  } = {},
) {
  return async (request: Request) => {
    try {
      requireWorker(request, overrides.secret ?? Deno.env.get("WORKER_SECRET"));
      const configured = overrides.provider ?? configuredProvider();
      const admin = overrides.admin ??
        createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
      const claims = await admin.rpc("claim_email", {
        delivery_enabled: configured.enabled,
      });
      if (claims.error) throw new HttpError(503);
      let processed = 0;
      for (
        const job of (claims.data ?? []) as {
          id: string;
          lease: string;
          eventKey: string;
        }[]
      ) {
        const target = await admin.rpc("email_target", {
          delivery: job.id,
          lease: job.lease,
        });
        if (target.error) throw new HttpError(503);
        const result = target.data
          ? await configured.provider.sendNotification({
            eventKey: job.eventKey,
            recipientVerifiedEmail: target.data,
          })
          : { state: "disabled" as const };
        const done = await admin.rpc("finish_email", {
          delivery: job.id,
          lease: job.lease,
          outcome: result.state,
          provider_id: result.state === "accepted" ? result.providerId : null,
          retryable: result.state === "rejected" && result.retryable,
          safe_code: result.state === "rejected" ? result.code : null,
        });
        if (done.error) throw new HttpError(503);
        processed++;
      }
      return Response.json({ processed }, {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      return errorResponse(error instanceof HttpError ? error.status : 503);
    }
  };
}
