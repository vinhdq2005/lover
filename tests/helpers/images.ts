import { readFileSync } from "node:fs";
import {
  ImageMagick,
  initializeImageMagick,
  MagickColors,
  MagickFormat,
} from "@imagemagick/magick-wasm";
let ready: Promise<void> | undefined;
export async function tinyJpeg() {
  ready ??= initializeImageMagick(
    readFileSync("node_modules/@imagemagick/magick-wasm/dist/x86/magick.wasm"),
  );
  await ready;
  return ImageMagick.read(
    MagickColors.Pink,
    24,
    16,
    (image) =>
      image.write(MagickFormat.Jpeg, (bytes) => Uint8Array.from(bytes)),
  );
}
