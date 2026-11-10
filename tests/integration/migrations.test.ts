import { expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertMigrationOrder } from "../../scripts/migration-order";
import { disposableRoot, disposableSql } from "../helpers/disposableStack";
it("global setup completed clean replay and SQL assertions before any integration test", () => {
  expect(
    JSON.parse(readFileSync(resolve(disposableRoot, "ready.json"), "utf8")),
  ).toMatchObject({ migrations: true, sql: true });
  assertMigrationOrder(
    readdirSync("supabase/migrations").filter((x) => x.endsWith(".sql")),
  );
  expect(
    disposableSql(
      "select count(*) from information_schema.tables where table_schema='public' and table_name in ('couples','memberships','notifications','operation_receipts');",
    ),
  ).toBe("4");
  expect(
    disposableSql(
      "select to_regclass('public.upload_batches') is not null and to_regclass('public.upload_files') is not null and to_regclass('public.upload_reservations') is not null;",
    ),
  ).toBe("t");
  expect(
    disposableSql(
      "select count(*) from pg_policies where schemaname='storage' and policyname in ('reserved_stage_insert','ready_media_download');",
    ),
  ).toBe("2");
});
