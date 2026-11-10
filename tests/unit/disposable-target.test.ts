import { expect, it } from "vitest";
import {
  assertDisposableDirectory,
  assertDisposableStatus,
  redact,
} from "../helpers/disposableStack";
it("accepts only the isolated loopback API and database ports", () => {
  expect(() =>
    assertDisposableStatus({
      API_URL: "http://127.0.0.1:55321",
      DB_URL: "postgresql://postgres:local@127.0.0.1:55322/postgres",
    })
  ).not.toThrow();
  for (
    const target of [
      {
        API_URL: "http://127.0.0.1:54321",
        DB_URL: "postgresql://postgres:local@127.0.0.1:54322/postgres",
      },
      {
        API_URL: "https://project.supabase.co",
        DB_URL: "postgresql://postgres:local@127.0.0.1:55322/postgres",
      },
      {
        API_URL: "http://127.0.0.1:55321",
        DB_URL: "postgresql://postgres:local@remote.example:55322/postgres",
      },
    ]
  ) {
    expect(() => assertDisposableStatus(target)).toThrow(
      "DISPOSABLE_LOCAL_TARGET_REQUIRED",
    );
  }
});
it("refuses the development workspace as a disposable reset target", () => {
  expect(() => assertDisposableDirectory(process.cwd())).toThrow(
    "DISPOSABLE_WORKSPACE_MARKER_REQUIRED",
  );
});
it("redacts API credentials from persisted bootstrap logs", () => {
  expect(
    redact(
      "sb_secret_abc123 postgresql://user:password@127.0.0.1:55322/postgres",
    ),
  ).not.toContain("password");
  expect(redact("sb_secret_abc123")).not.toContain("abc123");
});
