import { HttpError } from "./http.ts";
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_SOURCE_PIXELS = 24_000_000;
export const MAX_STORED_EDGE = 1600;
const ascii = (b: Uint8Array, at: number, n: number) =>
  String.fromCharCode(...b.subarray(at, at + n));

/** Untrusted dimensions are inspected before allocating a decoder's pixel buffers. */
export function inspectImage(bytes: Uint8Array, claimedMime?: string) {
  try {
    return parseImageHeader(bytes, claimedMime);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(422);
  }
}
function parseImageHeader(bytes: Uint8Array, claimedMime?: string) {
  if (bytes.length > MAX_IMAGE_BYTES) throw new HttpError(413);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0, height = 0, mime: string;
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    mime = "image/jpeg";
    let at = 2;
    while (at + 4 <= bytes.length) {
      if (bytes[at++] !== 255) throw new HttpError(422);
      while (bytes[at] === 255) at++;
      const marker = bytes[at++];
      if (marker === 0xDA || marker === 0xD9) break;
      const size = view.getUint16(at);
      if (size < 2 || at + size > bytes.length) throw new HttpError(422);
      if ([0xC0, 0xC1, 0xC2].includes(marker)) {
        if (size < 8) throw new HttpError(422);
        height = view.getUint16(at + 3);
        width = view.getUint16(at + 5);
        break;
      }
      at += size;
    }
  } else if (bytes.length >= 33 && ascii(bytes, 0, 8) === "\x89PNG\r\n\x1a\n") {
    mime = "image/png";
    if (view.getUint32(8) !== 13 || ascii(bytes, 12, 4) !== "IHDR") {
      throw new HttpError(422);
    }
    width = view.getUint32(16);
    height = view.getUint32(20);
    let at = 8, ended = false;
    while (at + 12 <= bytes.length) {
      const size = view.getUint32(at), type = ascii(bytes, at + 4, 4);
      if (size > bytes.length - at - 12 || type === "acTL") {
        throw new HttpError(422);
      }
      at += size + 12;
      if (type === "IEND") {
        ended = true;
        break;
      }
    }
    if (!ended || at !== bytes.length) throw new HttpError(422);
  } else if (
    bytes.length >= 30 && ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  ) {
    mime = "image/webp";
    if (view.getUint32(4, true) + 8 !== bytes.length) throw new HttpError(422);
    let at = 12;
    while (at + 8 <= bytes.length) {
      const type = ascii(bytes, at, 4),
        size = view.getUint32(at + 4, true),
        start = at + 8;
      if (size > bytes.length - start || type === "ANIM" || type === "ANMF") {
        throw new HttpError(422);
      }
      if (type === "VP8X" && size >= 10) {
        if (bytes[start] & 2) throw new HttpError(422);
        width = 1 + bytes[start + 4] + (bytes[start + 5] << 8) +
          (bytes[start + 6] << 16);
        height = 1 + bytes[start + 7] + (bytes[start + 8] << 8) +
          (bytes[start + 9] << 16);
      } else if (type === "VP8 " && size >= 10 && !width) {
        if (ascii(bytes, start + 3, 3) !== "\x9d\x01\x2a") {
          throw new HttpError(422);
        }
        width = view.getUint16(start + 6, true) & 0x3FFF;
        height = view.getUint16(start + 8, true) & 0x3FFF;
      } else if (type === "VP8L" && size >= 5 && !width) {
        if (bytes[start] !== 0x2F) throw new HttpError(422);
        const bits = view.getUint32(start + 1, true);
        width = (bits & 0x3FFF) + 1;
        height = ((bits >>> 14) & 0x3FFF) + 1;
      }
      at = start + size + (size % 2);
    }
    if (at !== bytes.length) throw new HttpError(422);
  } else throw new HttpError(415);
  if (claimedMime && claimedMime !== mime) throw new HttpError(415);
  if (!width || !height || width * height > MAX_SOURCE_PIXELS) {
    throw new HttpError(422);
  }
  return { width, height, mime };
}
