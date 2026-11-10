import {
  appendFileSync,
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import {
  bootstrapLog,
  createDisposableWorkspace,
  disposableCommand,
  disposableRoot,
  disposableStatus,
  initializeDisposableDirectory,
  redact,
} from "../helpers/disposableStack";

export default async function setup() {
  const appOrigin = process.env.LOVER_TEST_APP_ORIGIN ??
    "http://127.0.0.1:5173";
  if (!/^http:\/\/127\.0\.0\.1:(5173|5175)$/.test(appOrigin)) {
    throw new Error("ISOLATED_TEST_ORIGIN_REQUIRED");
  }
  initializeDisposableDirectory();
  const lock = resolve(disposableRoot, "runner.lock");
  if (existsSync(lock)) {
    const pid = Number(readFileSync(lock, "utf8"));
    let alive = false;
    try {
      process.kill(pid, 0);
      alive = true;
    } catch { /* previous runner ended */ }
    if (alive) throw new Error("DISPOSABLE_TEST_RUN_ALREADY_ACTIVE");
    unlinkSync(lock);
  }
  const handle = openSync(lock, "wx");
  writeFileSync(handle, String(process.pid));
  closeSync(handle);
  let functions: ReturnType<typeof spawn> | undefined;
  const release = () => {
    functions?.kill();
    if (existsSync(lock)) unlinkSync(lock);
  };
  try {
    createDisposableWorkspace();
    console.log(
      "[setup 1/3] Starting disposable lover-integration on ports 55321/55322",
    );
    disposableCommand(["start"], "start disposable stack", 300000);
    disposableStatus(); // exact loopback URL/port guard before any reset
    console.log(
      "[setup 2/3] Clean local migration replay (all current migrations)",
    );
    disposableCommand(
      ["db", "reset", "--local", "--no-seed"],
      "clean migration replay",
    );
    console.log("[setup 3/3] SQL schema and authorization assertions");
    const sql = disposableCommand(["test", "db"], "SQL assertions");
    console.log(redact(sql));
    const envFile = resolve(disposableRoot, "edge.env");
    writeFileSync(
      envFile,
      "APP_ORIGIN=" + appOrigin +
        "\nEMAIL_PROVIDER=disabled\nEMAIL_DELIVERY_ENABLED=false\nEMAIL_DAILY_CAP=100\nOPERATION_SIGNING_KEY=" +
        randomBytes(48).toString("hex") +
        "\nOPERATION_SIGNING_KEY_ID=integration-v1\nWORKER_SECRET=" +
        randomBytes(48).toString("hex") + "\n",
    );
    functions = spawn(process.execPath, [
      resolve("node_modules/supabase/dist/supabase.js"),
      "functions",
      "serve",
      "--workdir",
      disposableRoot,
      "--env-file",
      envFile,
      "--no-verify-jwt",
    ], { stdio: ["ignore", "pipe", "pipe"] });
    for (const stream of [functions.stdout, functions.stderr]) {
      stream?.on(
        "data",
        (data) => appendFileSync(bootstrapLog, redact(String(data))),
      );
    }
    const status = disposableStatus();
    const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let ready = false;
    for (let attempt = 0; attempt < 90; attempt++) {
      const users = await admin.auth.admin.listUsers();
      const schema = await admin.from("upload_batches").select("id").limit(0);
      let edge = false;
      try {
        edge = (await fetch(status.API_URL + "/functions/v1/api", {
          method: "POST",
          headers: {
            Origin: appOrigin,
            apikey: status.PUBLISHABLE_KEY,
            Authorization: "Bearer invalid",
            "Content-Type": "application/json",
          },
          body: "{}",
          signal: AbortSignal.timeout(2000),
        })).status === 401;
      } catch { /* wait for local gateway */ }
      if (!users.error && !schema.error && edge) {
        ready = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) {
      throw new Error(
        "DISPOSABLE_AUTH_SCHEMA_EDGE_NOT_READY; see artifacts/integration-bootstrap.log",
      );
    }
    writeFileSync(
      resolve(disposableRoot, "ready.json"),
      JSON.stringify({ pid: process.pid, migrations: true, sql: true }),
    );
    console.log(
      "Disposable schema/Auth/Storage/Edge ready before test collection.",
    );
    return release;
  } catch (error) {
    release();
    throw error;
  }
}
