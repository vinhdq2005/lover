import { expect, test } from "@playwright/test";
import {
  ImageMagick,
  initializeImageMagick,
  MagickColors,
  MagickFormat,
} from "@imagemagick/magick-wasm";
import { readFileSync } from "node:fs";
let source: string;
test.beforeAll(async () => {
  await initializeImageMagick(
    readFileSync("node_modules/@imagemagick/magick-wasm/dist/x86/magick.wasm"),
  );
  source = ImageMagick.read(
    MagickColors.Pink,
    6000,
    4000,
    (image) =>
      image.write(
        MagickFormat.Jpeg,
        (bytes) => Buffer.from(bytes).toString("base64"),
      ),
  );
});
test("24MP browser preparation preserves aspect ratio and produces stable reusable upload bytes", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async (encoded) => {
    // Vite serves the same module that the upload UI will consume; no mocked canvas/decoder.
    // @ts-expect-error Browser-only Vite URL resolved at runtime.
    const { prepareImage } = await import("/src/lib/prepareImage.ts");
    const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    const prepared = await prepareImage(
      new File([bytes], "source.jpg", { type: "image/jpeg" }),
    );
    const bitmap = await createImageBitmap(prepared.file);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    const first = new Uint8Array(await prepared.file.arrayBuffer());
    const second = new Uint8Array(await prepared.file.arrayBuffer());
    return {
      sourceWidth: prepared.sourceWidth,
      sourceHeight: prepared.sourceHeight,
      ...dims,
      type: prepared.file.type,
      bytes: first.length,
      stable: first.every((v, i) => v === second[i]),
    };
  }, source);
  expect(result).toMatchObject({
    sourceWidth: 6000,
    sourceHeight: 4000,
    width: 1600,
    height: 1066,
    type: "image/jpeg",
    stable: true,
  });
  expect(result.bytes).toBeGreaterThan(0);
  expect(result.bytes).toBeLessThanOrEqual(10485760);
});
test("browser refuses oversized and spoofed sources before upload", async ({ page }) => {
  await page.goto("/");
  const rejected = await page.evaluate(async (encoded) => {
    // @ts-expect-error Browser-only Vite URL resolved at runtime.
    const { prepareImage } = await import("/src/lib/prepareImage.ts");
    const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    const files = [
      new File([new Uint8Array(10485761)], "large.jpg", { type: "image/jpeg" }),
      new File([bytes], "spoof.png", { type: "image/png" }),
      new File(["<svg/>"], "fake.jpg", { type: "image/jpeg" }),
    ];
    const results = [];
    for (const file of files) {
      try {
        await prepareImage(file);
        results.push(false);
      } catch {
        results.push(true);
      }
    }
    return results;
  }, source);
  expect(rejected).toEqual([true, true, true]);
});
