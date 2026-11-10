import { createClient } from "@supabase/supabase-js";
export type OperatorEnv = Record<string, string | undefined>;
export function adminKeyFormat(key: string): "secret" | "legacy_service_role" {
  if (/^sb_secret_[A-Za-z0-9_-]{16,}$/.test(key)) return "secret";
  try {
    const parts = key.split(".");
    if (parts.length === 3 && parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) {
      const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
      const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      if (header.alg === "HS256" && parts[2].length === 43 && claims.role === "service_role") return "legacy_service_role";
    }
  } catch { /* Format classification only; the server must validate the credential. */ }
  throw new Error("OPERATOR_INVALID_ADMIN_KEY_FORMAT: use a new server-only sb_secret_ key from the intended project.");
}
export function operatorConfiguration(env: OperatorEnv, role: string, checkOnly: boolean) {
  const key = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.SUPABASE_URL || !key) throw new Error("OPERATOR_MISSING_ADMIN_CONFIGURATION");
  if (env.SUPABASE_SECRET_KEY && env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_SECRET_KEY !== env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("OPERATOR_CONFLICTING_ADMIN_KEYS");
  adminKeyFormat(key);
  let url: URL;
  try { url = new URL(env.SUPABASE_URL); } catch { throw new Error("OPERATOR_INVALID_PROJECT_URL"); }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
    !(url.protocol === "https:" || url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))) throw new Error("OPERATOR_INVALID_PROJECT_URL");
  const first = env.LOVER_FIRST_EMAIL?.trim().toLowerCase(), partner = env.LOVER_PARTNER_EMAIL?.trim().toLowerCase();
  if (!first || !partner || first === partner || !first.includes("@") || !partner.includes("@")) throw new Error("OPERATOR_REQUIRES_TWO_DISTINCT_EMAILS");
  if (!checkOnly && (!env.LOVER_PROVISION_PASSWORD || env.LOVER_PROVISION_PASSWORD.length < 12)) throw new Error("OPERATOR_PASSWORD_MINIMUM_12");
  return { url: url.origin, key, allowed: [first, partner], email: role === "first" ? first : partner, password: env.LOVER_PROVISION_PASSWORD };
}
const codes = new Set(["bad_jwt", "invalid_credentials", "not_admin", "unexpected_failure", "request_timeout", "over_request_rate_limit", "user_already_exists", "email_exists", "weak_password", "42501", "PGRST301", "PGRST302"]);
export function operatorDiagnostic(stage: string, error: unknown, responseStatus?: number) {
  const item = error && typeof error === "object" ? error as { status?: unknown; code?: unknown } : {};
  const status = Number.isInteger(responseStatus) && responseStatus! >= 100 && responseStatus! <= 599 ? responseStatus! : typeof item.status === "number" && Number.isInteger(item.status) && item.status >= 100 && item.status <= 599 ? item.status : 0;
  const code = typeof item.code === "string" && codes.has(item.code) ? item.code : "UNAVAILABLE";
  const category = status === 0 ? "connectivity_or_unclassified" : status === 401 ? "credential_or_project_mismatch" : status === 403 ? "permission_denied" : status === 404 ? "project_or_endpoint" : status >= 500 ? "upstream_unavailable" : "request_rejected";
  // Never stringify SDK errors, messages, request URLs, response bodies or headers.
  return `OPERATOR_${stage}: status=${status} code=${code} category=${category}`;
}
export async function runOperator(args: string[], env: OperatorEnv, fetcher: typeof fetch = fetch) {
  const role = args[0], checkOnly = args.includes("--check");
  if (!["first", "partner"].includes(role) || !args.includes("--mailbox-verified")) throw new Error("Use first|partner --mailbox-verified [--check] only after verifying mailbox control.");
  const config = operatorConfiguration(env, role, checkOnly);
  let status: number | undefined;
  const client = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      status = undefined;
      const response = await fetcher(input, { ...init, signal: AbortSignal.timeout(15000) });
      status = response.status;
      return response;
    } },
  });
  const { data: list, error: listError } = await client.auth.admin.listUsers({ page: 1, perPage: 3 });
  if (listError) throw new Error(operatorDiagnostic("LIST_USERS_FAILED", listError, status));
  if (list.users.length > 2 || list.users.some(user => !user.email || !config.allowed.includes(user.email.toLowerCase()))) throw new Error("Unexpected accounts exist; review enrollment before proceeding.");
  if (checkOnly) return "Admin account inspection succeeded. Read-only check; no users or bootstrap state changed.";
  const existing = list.users.find(user => user.email?.toLowerCase() === config.email);
  let id = existing?.id;
  if (!id) {
    if (list.users.length >= 2) throw new Error("Two account maximum reached.");
    const { data, error } = await client.auth.admin.createUser({ email: config.email, password: config.password!, email_confirm: true });
    if (error || !data.user) throw new Error(operatorDiagnostic("CREATE_USER_FAILED", error, status));
    id = data.user.id;
  }
  if (role === "first") {
    const { error } = await client.rpc("bootstrap_operator", { first_id: id });
    if (error) throw new Error(operatorDiagnostic("BOOTSTRAP_FAILED", error, status));
  }
  return "Controlled identity provisioned. No credentials were printed.";
}
