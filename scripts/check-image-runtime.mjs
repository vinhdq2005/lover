import { provisionCoupleLocal } from "../tests/helpers/localStack.ts";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  ImageMagick,
  initializeImageMagick,
  MagickColors,
  MagickFormat,
} from "@imagemagick/magick-wasm";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Local-only resource gate. Temporary instrumentation is always removed; no images are persisted.
const status = JSON.parse(
  execFileSync(process.execPath, [
    "node_modules/supabase/dist/supabase.js",
    "status",
    "--output",
    "json",
  ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }),
);
if (!status.API_URL?.startsWith("http://127.0.0.1:")) {
  throw new Error("Local stack required");
}
const workerSecret = readFileSync(".env.edge.local", "utf8").split("\n").find(
  (line) => line.startsWith("WORKER_SECRET="),
)?.slice(14);
if (!workerSecret) throw new Error("Ignored local test configuration required");
await provisionCoupleLocal();
const client = createClient(status.API_URL, status.PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});
const { data, error } = await client.auth.signInWithPassword({
  email: "first@example.test",
  password: "Local-Only-Test-Password-2026!",
});
if (error || !data.session) {
  throw new Error("Provision local synthetic test identities first");
}
await initializeImageMagick(
  readFileSync(
    new URL(
      "../node_modules/@imagemagick/magick-wasm/dist/x86/magick.wasm",
      import.meta.url,
    ),
  ),
);
const makeImage = (width, height) =>
  ImageMagick.read(MagickColors.Pink, width, height, (image) => {
    image.quality = 75;
    return image.write(MagickFormat.Jpeg, (bytes) => Uint8Array.from(bytes));
  });
const tiny = makeImage(24, 16), large = makeImage(6000, 4000);
const filename = "supabase/functions/api/handler.ts";
const original = readFileSync(filename, "utf8");
const anchor = /const body\s*=\s*await parseBody\(request\)/;
if (!anchor.test(original)) {
  throw new Error(
    "Unexpected local API structure; instrumentation not applied",
  );
}
const probe =
  `if(new URL(request.url).searchParams.has('local-image-probe')){if(Deno.env.get('APP_ORIGIN')!=='http://127.0.0.1:5173'||request.headers.get('x-worker-secret')!==Deno.env.get('WORKER_SECRET'))throw new HttpError(403);const {validateImage}=await import('../_shared/images.ts');const bytes=new Uint8Array(await request.arrayBuffer());const start=performance.now();const result=await validateImage(bytes,'image/jpeg');return Response.json({width:result.width,height:result.height,elapsedMs:Math.round(performance.now()-start)},{headers:{...cors,'Cache-Control':'no-store'}});}`;
mkdirSync("artifacts", { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5173");
  const prepared = await page.evaluate(async (source) => {
    const { prepareImage } = await import("/src/lib/prepareImage.ts");
    const input = Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
    const result = await prepareImage(
      new File([input], "synthetic-24mp.jpg", { type: "image/jpeg" }),
    );
    const bytes = new Uint8Array(await result.file.arrayBuffer());
    let binary = "";
    for (let at = 0; at < bytes.length; at += 8192) {
      binary += String.fromCharCode(...bytes.subarray(at, at + 8192));
    }
    return {
      base64: btoa(binary),
      sourceWidth: result.sourceWidth,
      sourceHeight: result.sourceHeight,
      width: result.width,
      height: result.height,
    };
  }, Buffer.from(large).toString("base64"));
  if (
    prepared.sourceWidth * prepared.sourceHeight !== 24000000 ||
    prepared.width > 1600 || prepared.height > 1600
  ) throw new Error("Invalid browser preparation");
  console.log(
    JSON.stringify({
      label: "browser-preparation",
      sourceWidth: prepared.sourceWidth,
      sourceHeight: prepared.sourceHeight,
      width: prepared.width,
      height: prepared.height,
    }),
  );
  const optimized = Uint8Array.from(Buffer.from(prepared.base64, "base64"));
  writeFileSync(filename, original.replace(anchor, (match) => probe + match));
  await new Promise((resolve) => setTimeout(resolve, 1500));
  for (
    const [label, bytes] of [["warmup", tiny], ["24MP", optimized], [
      "raw-24MP-rejected",
      large,
    ]]
  ) {
    const response = await fetch(
      status.API_URL + "/functions/v1/api?local-image-probe=1",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + data.session.access_token,
          apikey: status.PUBLISHABLE_KEY,
          Origin: "http://127.0.0.1:5173",
          "Content-Type": "image/jpeg",
          "x-worker-secret": workerSecret,
        },
        body: bytes,
      },
    );
    const result = await response.json();
    const record = {
      label,
      inputBytes: bytes.length,
      status: response.status,
      result,
    };
    console.log(JSON.stringify(record));
    writeFileSync(
      "artifacts/image-runtime-" + label + ".json",
      JSON.stringify(record, null, 2),
    );
    if (
      label === "raw-24MP-rejected"
        ? response.status !== 422
        : (!response.ok || result.elapsedMs >= 1900)
    ) {
      process.exitCode = 1;
      break;
    }
  }
} finally {
  writeFileSync(filename, original);
  await browser.close();
}
