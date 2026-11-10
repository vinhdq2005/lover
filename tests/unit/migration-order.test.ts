import { expect, it } from "vitest";
import { assertMigrationOrder } from "../../scripts/migration-order";
const foundation = ["0001_identity.sql", "0002_foundation.sql"];
it("rejects storage policies without their reservation migration", () => {
  expect(() =>
    assertMigrationOrder([...foundation, "0011_storage_policies.sql"])
  )
    .toThrow("Upload reservations");
});
it("allows the foundation and dependency-complete media sequence", () => {
  expect(() => assertMigrationOrder(foundation)).not.toThrow();
  expect(() =>
    assertMigrationOrder([
      ...foundation,
      "0010_upload_reservations.sql",
      "0011_storage_policies.sql",
    ])
  )
    .not.toThrow();
});
it("rejects missing foundation dependencies", () => {
  expect(() => assertMigrationOrder(["0002_foundation.sql"])).toThrow(
    "0001_identity.sql",
  );
});
