import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { assertMigrationOrder } from "../../scripts/migration-order.ts";
import { readdirSync } from "node:fs";

export const disposableRoot = resolve(".test-stack");
export const disposableProject = "lover-integration";
export const disposableContainer = "supabase_db_lover-integration";
export const bootstrapLog = resolve("artifacts/integration-bootstrap.log");
const marker = "lover-disposable-integration-v1";
const cli = resolve("node_modules/supabase/dist/supabase.js");

export function redact(value: string) {
  return value.replace(
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    "[REDACTED_JWT]",
  )
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[REDACTED_KEY]")
    .replace(/(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+@/g, "$1[REDACTED]@");
}
export function assertDisposableStatus(
  status: { API_URL?: string; DB_URL?: string },
) {
  const api = new URL(status.API_URL ?? "invalid");
  const db = new URL(status.DB_URL ?? "invalid");
  if (
    api.protocol !== "http:" || api.hostname !== "127.0.0.1" ||
    api.port !== "55321" ||
    !["postgres:", "postgresql:"].includes(db.protocol) ||
    db.hostname !== "127.0.0.1" || db.port !== "55322"
  ) {
    throw new Error("DISPOSABLE_LOCAL_TARGET_REQUIRED");
  }
}
export function assertDisposableDirectory(workdir: string) {
  if (
    resolve(workdir) !== disposableRoot ||
    !existsSync(resolve(disposableRoot, "disposable.json")) ||
    JSON.parse(readFileSync(resolve(disposableRoot, "disposable.json"), "utf8"))
        .kind !== marker
  ) {
    throw new Error("DISPOSABLE_WORKSPACE_MARKER_REQUIRED");
  }
  const config = readFileSync(
    resolve(disposableRoot, "supabase/config.toml"),
    "utf8",
  );
  if (
    !config.includes(`project_id = "${disposableProject}"`) ||
    !config.includes("port = 55321") || !config.includes("port = 55322")
  ) {
    throw new Error("DISPOSABLE_CONFIG_REQUIRED");
  }
}
export function disposableCommand(
  args: string[],
  label: string,
  timeout = 180000,
) {
  assertDisposableDirectory(disposableRoot);
  const result = spawnSync(process.execPath, [
    cli,
    ...args,
    "--workdir",
    disposableRoot,
  ], { encoding: "utf8", timeout, env: { ...process.env } });
  const output = redact(
    (args[0] === "start"
      ? "[start stdout withheld: contains generated local credentials]"
      : result.stdout ?? "") + "\n" + (result.stderr ?? ""),
  );
  appendFileSync(
    bootstrapLog,
    `\n[${label}] exit=${result.status}\n${output}\n`,
  );
  if (result.status !== 0) throw new Error(`${label}\n${output}`);
  return result.stdout;
}
export function disposableStatus() {
  assertDisposableDirectory(disposableRoot);
  const result = spawnSync(process.execPath, [
    cli,
    "status",
    "--output",
    "json",
    "--workdir",
    disposableRoot,
  ], { encoding: "utf8", timeout: 30000 });
  if (result.status !== 0) throw new Error("DISPOSABLE_STACK_UNAVAILABLE");
  const status = JSON.parse(result.stdout);
  assertDisposableStatus(status);
  return status;
}
export function disposableSql(sql: string) {
  assertDisposableDirectory(disposableRoot);
  assertDisposableStatus(disposableStatus());
  const result = spawnSync("docker", [
    "exec",
    "-i",
    disposableContainer,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-At",
  ], { input: sql, encoding: "utf8", timeout: 120000 });
  if (result.status !== 0) throw new Error(redact(result.stderr));
  return result.stdout.trim();
}
export function initializeDisposableDirectory() {
  if (
    existsSync(disposableRoot) &&
    !existsSync(resolve(disposableRoot, "disposable.json"))
  ) throw new Error("REFUSING_TO_OVERWRITE_UNMARKED_TEST_DIRECTORY");
  if (
    existsSync(resolve(disposableRoot, "disposable.json")) &&
    JSON.parse(readFileSync(resolve(disposableRoot, "disposable.json"), "utf8"))
        .kind !== marker
  ) throw new Error("REFUSING_TO_OVERWRITE_FOREIGN_TEST_MARKER");
  mkdirSync(resolve(disposableRoot, "supabase"), { recursive: true });
  mkdirSync("artifacts", { recursive: true });
  writeFileSync(
    resolve(disposableRoot, "disposable.json"),
    JSON.stringify({ kind: marker, project: disposableProject }),
  );
}
export function createDisposableWorkspace() {
  initializeDisposableDirectory();
  let config = readFileSync("supabase/config.toml", "utf8").replace(
    'project_id = "lover"',
    `project_id = "${disposableProject}"`,
  )
    .replace(/\b543(\d\d)\b/g, "553$1").replace(
      "inspector_port = 8083",
      "inspector_port = 8084",
    );
  for (const section of ["studio", "realtime", "local_smtp", "analytics"]) {
    const start = config.indexOf(`[${section}]`),
      end = config.indexOf("\n[", start + 1);
    const block = config.slice(start, end < 0 ? undefined : end).replace(
      /enabled = true/,
      "enabled = false",
    );
    config = config.slice(0, start) + block +
      (end < 0 ? "" : config.slice(end));
  }
  writeFileSync(resolve(disposableRoot, "supabase/config.toml"), config);
  const files = readdirSync("supabase/migrations").filter((x) =>
    x.endsWith(".sql")
  ).sort();
  assertMigrationOrder(files);
  const target = resolve(disposableRoot, "supabase/migrations");
  if (
    existsSync(target) &&
    readdirSync(target).some((f) => f.endsWith(".sql") && !files.includes(f))
  ) throw new Error("STALE_DISPOSABLE_MIGRATION_REQUIRES_REVIEW");
  for (const name of ["migrations", "tests", "functions"]) {
    cpSync(
      resolve("supabase", name),
      resolve(disposableRoot, "supabase", name),
      { recursive: true },
    );
  }
  cpSync("supabase/seed.sql", resolve(disposableRoot, "supabase/seed.sql"));
  writeFileSync(
    bootstrapLog,
    "Disposable local integration setup; development project is never reset.\n",
  );
}
