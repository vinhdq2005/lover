import { Image } from "npm:imagescript@3.13.1";
import { inspectImage, MAX_STORED_EDGE } from "./imageHeader.ts";
import { HttpError } from "./http.ts";
// Pure TypeScript codecs require no WASM initialization.
export function initializeDecoder() {
  return Promise.resolve();
}
export async function validateImage(bytes: Uint8Array, claimedMime?: string) {
  const header = inspectImage(bytes, claimedMime);
  if (header.width > MAX_STORED_EDGE || header.height > MAX_STORED_EDGE) {
    throw new HttpError(422);
  }
  const mime = header.mime;
  await initializeDecoder();
  try {
    const image = await Image.decode(bytes, {
      maxPixels: MAX_STORED_EDGE * MAX_STORED_EDGE,
      threads: 1,
      applyOrientation: true,
    });
    const width = image.width, height = image.height;
    if (
      width < 1 || height < 1 || width > MAX_STORED_EDGE ||
      height > MAX_STORED_EDGE ||
      width * height !== header.width * header.height
    ) {
      throw new HttpError(422);
    }
    const scale = Math.min(1, 1600 / Math.max(width, height));
    if (scale < 1) {
      image.resize(
        Math.max(1, Math.floor(width * scale)),
        Math.max(1, Math.floor(height * scale)),
      );
    }
    const preview = await image.encodeJPEG({ quality: 75, metadata: {} });
    return { width, height, mime, preview };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(422);
  }
}
