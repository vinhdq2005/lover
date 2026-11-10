/** Validate future media dependencies without accepting indexOf(missing) === -1. */
export function assertMigrationOrder(files: readonly string[]) {
  const sorted = [...files].sort();
  for (const required of ["0001_identity.sql", "0002_foundation.sql"]) {
    if (!sorted.includes(required)) {
      throw new Error(`Missing migration: ${required}`);
    }
  }
  if (sorted.includes("0011_storage_policies.sql")) {
    const reservations = sorted.indexOf("0010_upload_reservations.sql");
    if (
      reservations < 0 ||
      reservations >= sorted.indexOf("0011_storage_policies.sql")
    ) {
      throw new Error("Upload reservations must exist before storage policies");
    }
  }
}
