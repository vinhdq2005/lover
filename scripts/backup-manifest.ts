import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto";
export function seal(bytes: Uint8Array, password: string) {
  if (password.length < 16) throw new Error("BACKUP_PASSPHRASE_TOO_SHORT");
  const salt = randomBytes(16),
    iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", scryptSync(password, salt, 32), iv);
  return Buffer.concat([
    Buffer.from("LOVER-BACKUP-1\n"),
    salt,
    iv,
    cipher.update(bytes),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
}
export function unseal(bytes: Uint8Array, password: string) {
  const value = Buffer.from(bytes), header = Buffer.from("LOVER-BACKUP-1\n");
  if (!value.subarray(0, header.length).equals(header)) {
    throw new Error("INVALID_BACKUP_FORMAT");
  }
  const offset = header.length,
    salt = value.subarray(offset, offset + 16),
    iv = value.subarray(offset + 16, offset + 28),
    body = value.subarray(offset + 28, -16),
    tag = value.subarray(-16);
  const cipher = createDecipheriv(
    "aes-256-gcm",
    scryptSync(password, salt, 32),
    iv,
  );
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(body), cipher.final()]);
}
export function backupManifest(bytes: Uint8Array, createdAt = new Date()) {
  return {
    format: "lover-encrypted-export-v1",
    created_at: createdAt.toISOString(),
    expires_at: new Date(createdAt.getTime() + 30 * 86400000).toISOString(),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
  };
}
