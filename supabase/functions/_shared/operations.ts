import { HttpError } from "./http.ts";
export type Intent = { command: string; payload: Record<string, unknown> };
export type Key = { key: string; keyId: string };
type Authorize = (actor: string, intent: Intent) => Promise<boolean>;
type Claims = {
  id: string;
  actor: string;
  command: string;
  hash: string;
  issuedAt: number;
  expiresAt: number;
  kid: string;
};
const encoder = new TextEncoder();
const lifetime = 30 * 86400000;
function reject(): never {
  throw new HttpError(409);
}
function canonical(value: unknown): string {
  if (
    value === null || typeof value === "string" || typeof value === "boolean"
  ) return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) reject();
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (
    typeof value === "object" && value &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return "{" + Object.keys(value).sort().map((k) =>
      JSON.stringify(k) + ":" + canonical((value as Record<string, unknown>)[k])
    ).join(",") + "}";
  }
  return reject();
}
function base64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll(
    "/",
    "_",
  ).replaceAll("=", "");
}
function decode(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) reject();
  try {
    return Uint8Array.from(
      atob(value.replaceAll("-", "+").replaceAll("_", "/")),
      (c) => c.charCodeAt(0),
    );
  } catch {
    return reject();
  }
}
async function signingKey(config: Key) {
  if (config.key.length < 32 || !config.keyId) reject();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(config.key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
async function intentHash(intent: Intent) {
  if (
    !/^[a-z]+\.[a-z_]+$/.test(intent.command) || !intent.payload ||
    Array.isArray(intent.payload)
  ) reject();
  const text = canonical(intent);
  if (encoder.encode(text).length > 262144) reject();
  return base64(
    new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text))),
  );
}
export async function issueOperation(
  actor: string,
  intent: Intent,
  config: Key,
  authorize: Authorize,
  now = Date.now(),
) {
  const hash = await intentHash(intent);
  if (!await authorize(actor, intent)) throw new HttpError(403);
  const claims: Claims = {
    id: crypto.randomUUID(),
    actor,
    command: intent.command,
    hash,
    issuedAt: now,
    expiresAt: now + lifetime,
    kid: config.keyId,
  };
  const payload = base64(encoder.encode(JSON.stringify(claims)));
  const signature = base64(
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        await signingKey(config),
        encoder.encode(payload),
      ),
    ),
  );
  return {
    operation_id: claims.id,
    token: payload + "." + signature,
    expires_at: new Date(claims.expiresAt).toISOString(),
  };
}
export async function verifyOperation(
  token: string,
  actor: string,
  intent: Intent,
  config: Key,
  authorize: Authorize,
  now = Date.now(),
) {
  if (token.length > 4096) reject();
  const parts = token.split(".");
  if (parts.length !== 2) reject();
  if (
    !await crypto.subtle.verify(
      "HMAC",
      await signingKey(config),
      decode(parts[1]),
      encoder.encode(parts[0]),
    )
  ) reject();
  let claims: Claims;
  try {
    claims = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(decode(parts[0])),
    );
  } catch {
    return reject();
  }
  if (
    claims.actor !== actor || claims.command !== intent.command ||
    claims.kid !== config.keyId || !Number.isFinite(claims.expiresAt) ||
    !Number.isFinite(claims.issuedAt) ||
    claims.expiresAt - claims.issuedAt !== lifetime || claims.issuedAt > now ||
    now >= claims.expiresAt || claims.hash !== await intentHash(intent)
  ) reject();
  if (!await authorize(actor, intent)) throw new HttpError(403);
  return claims;
}
