import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
export function safeBundle(text: string) {
  if (
    /sb_secret_[A-Za-z0-9_-]+|xkeysib-[A-Za-z0-9_-]{10,}|Local-Only-Test-Password|PRIVATE-NOT-IN-|OPERATION_SIGNING_KEY=|BREVO_API_KEY=|WORKER_SECRET=|data:image\/(?:jpeg|png|webp);base64/
      .test(text)
  ) return false;
  for (
    const token
      of text.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? []
  ) {
    try {
      if (
        JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())
          .role !== "anon"
      ) return false;
    } catch {
      return false;
    }
  }
  return true;
}
export function inspectBuild(root = resolve("dist")) {
  let files = 0;
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else {
        files++;
        if (
          entry.name.endsWith(".map") || entry.name.startsWith(".env") || /\.(jpe?g|png|webp|heic|avif|sql|dump|zip)$/i.test(entry.name) ||
          !safeBundle(readFileSync(path).toString("utf8"))
        ) {
          throw new Error(
            "BUILD_INSPECTION_FAILED: privileged credential, private fixture or source map",
          );
        }
      }
    }
  }
  walk(root);
  return files;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  console.log(
    "Build inspected: " + inspectBuild() +
      " files; no prohibited credentials/fixtures/maps found.",
  );
}
