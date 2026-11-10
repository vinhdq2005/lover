import {
  ImageMagick,
  initializeImageMagick,
  MagickColors,
  MagickFormat,
} from "npm:@imagemagick/magick-wasm@0.0.46";
import { initializeDecoder, validateImage } from "../_shared/images.ts";
import { inspectImage } from "../_shared/imageHeader.ts";
import { HttpError } from "../_shared/http.ts";
const fixtureReady = initializeImageMagick(
  await Deno.readFile(
    new URL(
      import.meta.resolve("npm:@imagemagick/magick-wasm@0.0.46/magick.wasm"),
    ),
  ),
);
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Assertion failed");
}
Deno.test("actual JPEG PNG and WebP decode into bounded previews", async () => {
  await initializeDecoder();
  await fixtureReady;
  for (
    const format of [MagickFormat.Jpeg, MagickFormat.Png, MagickFormat.WebP]
  ) {
    const bytes = ImageMagick.read(
      MagickColors.Pink,
      24,
      16,
      (img) => img.write(format, (data) => Uint8Array.from(data)),
    );
    const result = await validateImage(bytes);
    assert(result.width === 24 && result.height === 16);
    assert(result.preview.length > 0);
  }
});
Deno.test("rejects disguised unsupported oversized and corrupted files", async () => {
  for (
    const bytes of [
      new TextEncoder().encode("<svg>unsafe</svg>"),
      new Uint8Array(10485761),
      new Uint8Array([255, 216, 255, 224, 0, 0]),
    ]
  ) {
    let rejected = false;
    try {
      await validateImage(bytes);
    } catch {
      rejected = true;
    }
    assert(rejected);
  }
});

Deno.test("24MP source is accepted by header limits but raw Edge decode is rejected before allocation", async () => {
  await initializeDecoder();
  await fixtureReady;
  const bytes = ImageMagick.read(MagickColors.Pink, 6000, 4000, (image) => {
    image.quality = 75;
    return image.write(MagickFormat.Jpeg, (data) => Uint8Array.from(data));
  });
  assert(bytes.length <= 10485760);
  const header = inspectImage(bytes);
  assert(header.width * header.height === 24000000);
  try {
    await validateImage(bytes);
    throw new Error("Raw source was decoded");
  } catch (error) {
    assert(error instanceof HttpError && error.status === 422);
  }
});
Deno.test("stored-size maximum fully decodes with bounded preview and no metadata", async () => {
  await fixtureReady;
  const bytes = ImageMagick.read(
    MagickColors.Pink,
    1600,
    1600,
    (img) => img.write(MagickFormat.Jpeg, (data) => Uint8Array.from(data)),
  );
  const result = await validateImage(bytes, "image/jpeg");
  assert(result.width === 1600 && result.height === 1600);
  assert(inspectImage(result.preview).width === 1600);
  let rejected = false;
  try {
    await validateImage(bytes, "image/png");
  } catch (error) {
    rejected = error instanceof HttpError && error.status === 415;
  }
  assert(rejected);
});
Deno.test("oversized dimensions and truncated JPEG headers fail before decoding", () => {
  for (
    const bytes of [
      new Uint8Array([255, 216, 255, 255, 255, 255]),
      new Uint8Array([255, 216, 255, 192, 0, 8, 8, 0x13, 0x89, 0x13, 0x88, 0]),
    ]
  ) {
    let rejected = false;
    try {
      inspectImage(bytes);
    } catch (error) {
      rejected = error instanceof HttpError && error.status === 422;
    }
    assert(rejected);
  }
});
Deno.test("animated PNG and WebP markers are rejected before decoder allocation", async () => {
  await fixtureReady;
  const png = ImageMagick.read(
    MagickColors.Pink,
    24,
    16,
    (img) => img.write(MagickFormat.Png, (data) => Uint8Array.from(data)),
  );
  const apng = new Uint8Array(png.length + 20);
  apng.set(png.subarray(0, 33));
  new DataView(apng.buffer).setUint32(33, 8);
  apng.set(new TextEncoder().encode("acTL"), 37);
  apng.set(png.subarray(33), 53);
  const webp = ImageMagick.read(
    MagickColors.Pink,
    24,
    16,
    (img) => img.write(MagickFormat.WebP, (data) => Uint8Array.from(data)),
  );
  const animated = new Uint8Array(webp.length + 18);
  animated.set(webp.subarray(0, 12));
  animated.set(new TextEncoder().encode("VP8X"), 12);
  new DataView(animated.buffer).setUint32(16, 10, true);
  animated[20] = 2;
  animated[24] = 23;
  animated[27] = 15;
  animated.set(webp.subarray(12), 30);
  new DataView(animated.buffer).setUint32(4, animated.length - 8, true);
  for (const bytes of [apng, animated]) {
    let rejected = false;
    try {
      await validateImage(bytes);
    } catch (error) {
      rejected = error instanceof HttpError && error.status === 422;
    }
    assert(rejected);
  }
});
