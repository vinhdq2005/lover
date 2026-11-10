import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const status = JSON.parse(
  execFileSync(process.execPath, [
    "node_modules/supabase/dist/supabase.js",
    "status",
    "--output",
    "json",
  ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }),
);
if (!status.API_URL?.startsWith("http://127.0.0.1:")) {
  throw new Error("Local stack only");
}
writeFileSync(
  ".env.local",
  "VITE_SUPABASE_URL=" + status.API_URL + "\nVITE_SUPABASE_PUBLISHABLE_KEY=" +
    status.PUBLISHABLE_KEY + "\n",
);
writeFileSync(
  ".env.edge.local",
  "APP_ORIGIN=http://127.0.0.1:5173\nEMAIL_PROVIDER=disabled\nEMAIL_DELIVERY_ENABLED=false\nEMAIL_DAILY_CAP=100\nOPERATION_SIGNING_KEY=" +
    randomBytes(48).toString("hex") +
    "\nOPERATION_SIGNING_KEY_ID=local-v1\nWORKER_SECRET=" +
    randomBytes(48).toString("hex") + "\n",
);
console.log(
  "Ignored local configuration written; no credential values displayed.",
);
