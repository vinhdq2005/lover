import {
  inspectImage,
  MAX_IMAGE_BYTES,
  MAX_STORED_EDGE,
} from "../../supabase/functions/_shared/imageHeader";

/** Keep this result stable for retries; reserve/upload these bytes, never the source file. */
export async function prepareImage(file: File) {
  if (file.size > MAX_IMAGE_BYTES) throw new Error("IMAGE_TOO_LARGE");
  const source = inspectImage(
    new Uint8Array(await file.arrayBuffer()),
    file.type || undefined,
  );
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const canvas = document.createElement("canvas");
  try {
    if (bitmap.width * bitmap.height !== source.width * source.height) {
      throw new Error("INVALID_IMAGE_DIMENSIONS");
    }
    const scale = Math.min(
      1,
      MAX_STORED_EDGE / Math.max(bitmap.width, bitmap.height),
    );
    canvas.width = Math.max(1, Math.floor(bitmap.width * scale));
    canvas.height = Math.max(1, Math.floor(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("IMAGE_PREPARATION_UNAVAILABLE");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("IMAGE_PREPARATION_FAILED")),
        "image/jpeg",
        0.85,
      )
    );
    if (blob.size > MAX_IMAGE_BYTES) throw new Error("IMAGE_TOO_LARGE");
    return {
      file: new File([blob], "photo.jpg", { type: "image/jpeg" }),
      sourceWidth: source.width,
      sourceHeight: source.height,
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    bitmap.close();
    canvas.width = canvas.height = 0;
  }
}
