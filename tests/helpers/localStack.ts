import {
  assertDisposableDirectory,
  disposableCommand,
  disposableContainer,
  disposableStatus,
} from "./disposableStack.ts";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
export function localStack() {
  const workdir = process.env.LOVER_TEST_WORKDIR;
  if (workdir) assertDisposableDirectory(workdir);
  const status = workdir ? disposableStatus() : JSON.parse(
    execFileSync(process.execPath, [
      "node_modules/supabase/dist/supabase.js",
      "status",
      "--output",
      "json",
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }),
  );
  if (!status.API_URL?.startsWith("http://127.0.0.1:")) {
    throw new Error("Local environment required");
  }
  return {
    databaseContainer: workdir ? disposableContainer : "supabase_db_lover",
    url: status.API_URL as string,
    key: status.PUBLISHABLE_KEY as string,
    admin: createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}
export async function provisionLocal() {
  const stack = localStack();
  let listing = await stack.admin.auth.admin.listUsers();
  for (let attempt = 0; listing.error && attempt < 30; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    listing = await stack.admin.auth.admin.listUsers();
  }
  const { data: existing, error } = listing;
  if (error) throw new Error("Local identities unavailable");
  const users: Record<string, string> = {};
  for (const name of ["first", "partner", "outsider"]) {
    const email = name + "@example.test";
    const old = existing.users.find((u) => u.email === email);
    if (old) {
      users[name] = old.id;
      continue;
    }
    const { data, error } = await stack.admin.auth.admin.createUser({
      email,
      password: "Local-Only-Test-Password-2026!",
      email_confirm: true,
    });
    if (error || !data.user) throw new Error("Test identity failed");
    users[name] = data.user.id;
  }
  const { error: bootstrap } = await stack.admin.rpc("bootstrap_operator", {
    first_id: users.first,
  });
  if (
    bootstrap && !bootstrap.message.includes("duplicate") &&
    !bootstrap.message.includes("SETUP_CLOSED")
  ) throw new Error("Local bootstrap failed");
  return { ...stack, users };
}

export async function provisionCoupleLocal() {
  const stack = await provisionLocal();
  const { data: couple } = await stack.admin.from("couples").select("id")
    .maybeSingle();
  const commit = (
    actor: string,
    command: string,
    payload: Record<string, unknown>,
    hash: string | null = null,
  ) =>
    stack.admin.rpc("commit_enrollment", {
      actor,
      command,
      payload,
      op: randomUUID(),
      request_hash: randomUUID(),
      token_expiry: new Date(Date.now() + 86400000).toISOString(),
      invite_hash: hash,
    });
  if (!couple) {
    const { error } = await commit(stack.users.first, "couple.create", {
      name: "Our Story",
      start_date: "2024-01-01",
      timezone: "Asia/Ho_Chi_Minh",
    });
    if (error) throw new Error("Local test couple setup failed");
  }
  const { data: member } = await stack.admin.from("memberships").select("slot")
    .eq("user_id", stack.users.partner).maybeSingle();
  if (!member) {
    await stack.admin.from("invitations").update({ state: "revoked" }).eq(
      "state",
      "pending",
    );
    const token = randomBytes(32).toString("hex");
    const invited = await commit(stack.users.first, "invitation.create", {
      recipient_email: "partner@example.test",
    }, createHash("sha256").update(token).digest("hex"));
    if (invited.error) throw new Error("Test invitation failed");
    const accepted = await commit(stack.users.partner, "invitation.accept", {
      token,
    });
    if (accepted.error) throw new Error("Test membership failed");
  }
  return stack;
}

export function resetLocalTestDatabase() {
  localStack();
  if (process.env.LOVER_TEST_WORKDIR) {
    disposableCommand(
      ["db", "reset", "--local", "--no-seed"],
      "isolated enrollment fixture reset",
    );
    return;
  }
  execFileSync(process.execPath, [
    "node_modules/supabase/dist/supabase.js",
    "db",
    "reset",
    "--local",
    "--no-seed",
  ], { stdio: ["ignore", "pipe", "pipe"], timeout: 120000 });
}
