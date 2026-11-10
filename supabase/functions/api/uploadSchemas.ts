import { z } from "zod";
const uuid = z.uuid();
export const uploadSchemas: Record<string, z.ZodType> = {
  "upload.reserve": z.strictObject({
    files: z.array(z.strictObject({
      client_file_id: uuid,
      size: z.int().min(1).max(10485760),
      declared_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
    })).min(1).max(20).refine((files) =>
      new Set(files.map((file) => file.client_file_id)).size === files.length
    ),
  }),
  // One decode per request keeps CPU/memory bounded; the batch may contain twenty files.
  "upload.finalize": z.strictObject({
    batch_id: uuid,
    reservation_id: uuid,
    file_ids: z.array(uuid).length(1),
  }),
  "upload.close": z.strictObject({ batch_id: uuid }),
};
