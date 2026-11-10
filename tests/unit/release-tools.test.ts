import { expect, it } from "vitest";
import { safeBundle } from "../../scripts/check-build-secrets";
import { backupManifest, seal, unseal } from "../../scripts/backup-manifest";
import { hostingHeaders } from "../../scripts/write-hosting-headers";
it("hosted previews fail closed on production API reuse and CSP permits only the selected origin",()=>{
  const base={NETLIFY:"true",CONTEXT:"deploy-preview",VITE_SUPABASE_URL:"https://production.supabase.co",LOVER_PRODUCTION_SUPABASE_ORIGIN:"https://production.supabase.co",LOVER_PREVIEW_ISOLATED:"true"};
  expect(()=>hostingHeaders(base)).toThrow("ISOLATED_PREVIEW_CONFIGURATION_REQUIRED");
  expect(()=>hostingHeaders({...base,VITE_SUPABASE_URL:"http://127.0.0.1:54321"})).toThrow("HOSTED_HTTPS_REQUIRED");
  const headers=hostingHeaders({...base,VITE_SUPABASE_URL:"https://preview.supabase.co"});expect(headers).toContain("connect-src 'self' https://preview.supabase.co");expect(headers).not.toContain("production.supabase.co");expect(headers).not.toContain("unsafe-inline");
});
it("bundle gate rejects privileged keys/private fixtures while allowing public configuration", () => {
  expect(safeBundle("sb_secret_fake-key")).toBe(false);
  expect(safeBundle("xkeysib-test-secret-value-1234567890")).toBe(false);
  expect(safeBundle("Local-Only-Test-Password-2026!")).toBe(false);
  expect(safeBundle("sb_publishable_public")).toBe(true);
});
it("encrypted exports round-trip and reject tampering/wrong keys with a 30-day manifest", () => {
  const original = Buffer.from("synthetic relationship export"),
    password = "synthetic-passphrase-2026",
    encrypted = seal(original, password);
  expect(encrypted.includes(original)).toBe(false);
  expect(unseal(encrypted, password)).toEqual(original);
  expect(() => unseal(encrypted, "wrong-password-2026")).toThrow();
  const damaged = Buffer.from(encrypted);
  damaged[damaged.length - 1] ^= 1;
  expect(() => unseal(damaged, password)).toThrow();
  const manifest = backupManifest(encrypted, new Date("2026-11-10T00:00:00Z"));
  expect(manifest.expires_at).toBe("2026-12-10T00:00:00.000Z");
});
