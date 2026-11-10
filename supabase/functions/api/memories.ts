import { z } from "zod";
import { memoryInput } from "../_shared/validation.ts";
export const memorySchemas: Record<string, z.ZodType> = {
  "memory.create": memoryInput,
  "memory.update": memoryInput.extend({
    id: z.uuid(),
    expected_version: z.int().positive(),
  }),
  "memory.delete": z.strictObject({
    id: z.uuid(),
    expected_version: z.int().positive(),
  }),
};
