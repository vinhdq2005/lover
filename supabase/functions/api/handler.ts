import { payloads } from "./operations.ts";
import { commitMutation } from "../_shared/commit.ts";
import { commitEnrollment } from "./enrollment.ts";
import { issue } from "./operations.ts";
import { commitUpload } from "./uploads.ts";
import { afterCommitSignal } from "../_shared/dispatch.ts";
import { authenticatedUser } from "../_shared/auth.ts";
import {
  corsHeaders,
  errorResponse,
  HttpError,
  parseBody,
} from "../_shared/http.ts";
interface ApiDependencies {
  authenticate: (request: Request) => Promise<unknown>;
  issue: typeof issue;
  enrollment: typeof commitEnrollment;
  mutation: typeof commitMutation;
  uploads: typeof commitUpload;
  origin: () => string | undefined;
}
export function createApiHandler(overrides: Partial<ApiDependencies> = {}) {
  const deps = {
    authenticate: authenticatedUser,
    issue,
    enrollment: commitEnrollment,
    mutation: commitMutation,
    uploads: commitUpload,
    origin: () => Deno.env.get("APP_ORIGIN"),
    ...overrides,
  };
  return async (request: Request) => {
    let cors: Record<string, string> = {};
    try {
      const origin = deps.origin();
      if (!origin) throw new HttpError(503);
      cors = corsHeaders(request.headers.get("Origin"), origin);
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors });
      }
      if (request.method !== "POST") throw new HttpError(400);
      await deps.authenticate(request);
      const body = await parseBody(request) as {
        command?: string;
        payload?: unknown;
      };
      if (body?.command === "operation.issue") {
        return Response.json(await deps.issue(request, body.payload), {
          headers: { ...cors, "Cache-Control": "no-store" },
        });
      }
      if (
        body?.command &&
        [
          "couple.create",
          "invitation.create",
          "invitation.revoke",
          "invitation.accept",
        ].includes(body.command)
      ) {
        const result = await deps.enrollment(request, body); afterCommitSignal();
        return Response.json(result, {
          headers: { ...cors, "Cache-Control": "no-store" },
        });
      }
      if (body?.command?.startsWith("upload.")) {
        const result = await deps.uploads(request, body); afterCommitSignal();
        return Response.json(result, {
          headers: { ...cors, "Cache-Control": "no-store" },
        });
      }
      if (body?.command && payloads[body.command]) {
        const result = await deps.mutation(request, body, payloads[body.command]); afterCommitSignal();
        return Response.json(
          result,
          { headers: { ...cors, "Cache-Control": "no-store" } },
        );
      }
      throw new HttpError(503);
    } catch (error) {
      const response = errorResponse(
        error instanceof HttpError ? error.status : 503,
      );
      for (const [key, value] of Object.entries(cors)) {
        response.headers.set(key, value);
      }
      return response;
    }
  };
}
