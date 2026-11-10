import { z } from "zod";
import { entryInput } from "../_shared/validation.ts";
export const entrySchemas: Record<string, z.ZodType> = {
  "entry.create": entryInput,
  "entry.update": entryInput.extend({
    id: z.uuid(),
    expected_version: z.int().positive(),
  }),
  "entry.delete": z.strictObject({
    id: z.uuid(),
    expected_version: z.int().positive(),
  }),
};
