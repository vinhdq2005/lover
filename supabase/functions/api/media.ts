import { z } from "zod";
import { dateOnly, textField } from "../_shared/validation.ts";
const target = { id: z.uuid(), expected_version: z.int().positive() };
export const mediaSchemas: Record<string, z.ZodType> = {
  "album.create": z.strictObject({ title: textField(1, 200) }),
  "album.update": z.strictObject({ ...target, title: textField(1, 200) }),
  "album.delete": z.strictObject(target),
  "photo.update": z.strictObject({
    ...target,
    description: textField(0, 2000),
    event_date: dateOnly,
    album_id: z.uuid().nullable(),
  }),
  "photo.delete": z.strictObject(target),
};
