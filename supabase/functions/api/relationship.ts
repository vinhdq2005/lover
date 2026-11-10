import { z } from "zod";
import { dateOnly, textField } from "../_shared/validation.ts";
const version = z.int().positive();
const id = z.uuid();
export const relationshipSchemas: Record<string, z.ZodType> = {
  "couple.update": z.strictObject({
    expected_version: version,
    name: textField(1, 100).optional(),
    start_date: dateOnly.optional(),
    first_meeting_date: dateOnly.nullable().optional(),
    timezone: z.string().min(1).max(100).optional(),
  }),
  "milestone.create": z.strictObject({
    label: textField(1, 200),
    original_date: dateOnly,
  }),
  "milestone.update": z.strictObject({
    id,
    expected_version: version,
    label: textField(1, 200),
    original_date: dateOnly,
  }),
  "milestone.delete": z.strictObject({ id, expected_version: version }),
};
