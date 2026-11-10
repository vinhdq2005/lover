// @vitest-environment node
import { expect, it, vi } from "vitest";
import { adminKeyFormat, operatorConfiguration, operatorDiagnostic, runOperator } from "../../scripts/operator-provision";
const env = { SUPABASE_URL: "https://operator-fixture.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_synthetic_operator_fixture_123456", LOVER_FIRST_EMAIL: "first@example.test", LOVER_PARTNER_EMAIL: "partner@example.test" };
const args = ["first", "--mailbox-verified", "--check"];
it("rejects missing, malformed, public and ambiguous admin credentials before any request", async () => {
  const fetcher = vi.fn();
  for (const key of [undefined, "", "x".repeat(60), "sb_publishable_public_key_fixture", "sbp_personal_access_token_fixture"]) {
    await expect(runOperator(args, { ...env, SUPABASE_SECRET_KEY: key }, fetcher)).rejects.toThrow(/OPERATOR_(MISSING_ADMIN_CONFIGURATION|INVALID_ADMIN_KEY_FORMAT)/);
  }
  await expect(runOperator(args, { ...env, SUPABASE_SERVICE_ROLE_KEY: "different-stale-key" }, fetcher)).rejects.toThrow("OPERATOR_CONFLICTING_ADMIN_KEYS");
  expect(fetcher).not.toHaveBeenCalled();
});
it("recognizes legacy service-role JWT shape without treating decoding as authentication", () => {
  const jwt = (role: string) => Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url") + "." + Buffer.from(JSON.stringify({ role })).toString("base64url") + "." + "x".repeat(43);
  expect(adminKeyFormat(jwt("service_role"))).toBe("legacy_service_role");
  expect(() => adminKeyFormat(jwt("anon"))).toThrow("INVALID_ADMIN_KEY_FORMAT");
  expect(adminKeyFormat(env.SUPABASE_SECRET_KEY)).toBe("secret");
});
it("requires a safe project origin, distinct identities and a provisioning password", () => {
  for (const url of ["bad-url", "http://remote.example.test", "https://user:password@example.test", "https://example.test/auth/v1", "https://example.test/?secret=private"]) expect(() => operatorConfiguration({ ...env, SUPABASE_URL: url }, "first", true)).toThrow("OPERATOR_INVALID_PROJECT_URL");
  expect(() => operatorConfiguration({ ...env, LOVER_PARTNER_EMAIL: env.LOVER_FIRST_EMAIL }, "first", true)).toThrow("TWO_DISTINCT_EMAILS");
  for (const password of [undefined, "short"]) expect(() => operatorConfiguration({ ...env, LOVER_PROVISION_PASSWORD: password }, "first", false)).toThrow("PASSWORD_MINIMUM_12");
});
it("modern secret uses the actual SDK admin GET and check mode never writes", async () => {
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    expect(url.pathname).toBe("/auth/v1/admin/users");
    expect(init?.method).toBe("GET");
    expect(new Headers(init?.headers).get("apikey")).toBe(env.SUPABASE_SECRET_KEY);
    return Response.json({ users: [], aud: "authenticated" });
  });
  await expect(runOperator(args, env, fetcher)).resolves.toContain("Read-only check");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([401, 403, 404, 503])("HTTP %s diagnostics retain status but discard private provider messages", async status => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ error_code: "bad_jwt", message: env.SUPABASE_SECRET_KEY + " private-person@example.test password-private" }, { status }));
  const error = await runOperator(args, env, fetcher).catch(error => error as Error);
  expect(String(error)).toContain(`status=${status}`);
  expect(String(error)).not.toMatch(/sb_secret_|private-person|password-private/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("connectivity exceptions are sanitized and never trigger provisioning", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => { throw new Error("private network message " + env.SUPABASE_SECRET_KEY); });
  const error = await runOperator(args, env, fetcher).catch(error => error as Error);
  expect(String(error)).toContain("status=0");
  expect(String(error)).not.toContain(env.SUPABASE_SECRET_KEY);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("unknown diagnostic codes cannot smuggle tokens or personal data", () => {
  expect(operatorDiagnostic("LIST_USERS_FAILED", { status: 401, code: env.SUPABASE_SECRET_KEY, message: "private" })).toBe("OPERATOR_LIST_USERS_FAILED: status=401 code=UNAVAILABLE category=credential_or_project_mismatch");
});
it("unexpected accounts stop before any create or bootstrap request", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ users: [{ email: "outsider@example.test" }], aud: "authenticated" }));
  await expect(runOperator(["first", "--mailbox-verified"], { ...env, LOVER_PROVISION_PASSWORD: "synthetic-password-only" }, fetcher)).rejects.toThrow("Unexpected accounts");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
