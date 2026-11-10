import { z } from "zod";
import { profileInput } from "../_shared/validation.ts";
import { relationshipSchemas } from "./relationship.ts";
export const settingsSchemas: Record<string, z.ZodType> = {
  "profile.update": profileInput.extend({
    expected_version: z.int().positive(),
  }),
  "couple.update": (relationshipSchemas["couple.update"] as z.ZodObject).extend(
    { featured_photo_id: z.uuid().nullable().optional() },
  ),
};
