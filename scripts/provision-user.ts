import { createClient } from "@supabase/supabase-js";
const role = process.argv[2];
if (
  !["first", "partner"].includes(role) ||
  !process.argv.includes("--mailbox-verified")
) {
  throw new Error(
    "Use first|partner --mailbox-verified only after verifying mailbox control.",
  );
}
const url = process.env.SUPABASE_URL,
  service = process.env.SUPABASE_SERVICE_ROLE_KEY,
  email =
    process.env[role === "first" ? "LOVER_FIRST_EMAIL" : "LOVER_PARTNER_EMAIL"],
  password = process.env.LOVER_PROVISION_PASSWORD;
if (!url || !service || !email || !password || password.length < 12) {
  throw new Error(
    "Missing operator configuration or password shorter than 12 characters.",
  );
}
const client = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: list, error: listError } = await client.auth.admin.listUsers();
if (listError) throw new Error("Cannot inspect controlled accounts.");
const allowed = [process.env.LOVER_FIRST_EMAIL, process.env.LOVER_PARTNER_EMAIL]
  .filter(Boolean).map((v) => v!.toLowerCase());
if (
  list.users.some((u) => !u.email || !allowed.includes(u.email.toLowerCase()))
) {
  throw new Error(
    "Unexpected accounts exist; review enrollment before proceeding.",
  );
}
const existing = list.users.find((u) =>
  u.email?.toLowerCase() === email.toLowerCase()
);
let id = existing?.id;
if (!id) {
  if (list.users.length >= 2) throw new Error("Two account maximum reached.");
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error("Provisioning failed.");
  id = data.user.id;
}
if (role === "first") {
  const { error } = await client.rpc("bootstrap_operator", { first_id: id });
  if (error) {
    throw new Error(
      "Bootstrap closed or already authorized. Do not reset bootstrap from browser.",
    );
  }
}
console.log("Controlled identity provisioned. No credentials were printed.");
