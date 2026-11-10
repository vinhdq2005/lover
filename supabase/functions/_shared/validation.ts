import { z } from "zod";
export const codePointLength = (value: string) => Array.from(value).length;
export const textField = (min: number, max: number) =>
  z.string().transform((v) => v.trim()).refine(
    (v) => codePointLength(v) >= min && codePointLength(v) <= max,
    { message: "INVALID_TEXT_LENGTH" },
  );
export const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => {
  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return y >= 100 && date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}, { message: "INVALID_DATE" });
export const operationId = z.uuid();
export const memoryInput = z.strictObject({
  title: textField(1, 200),
  description: textField(0, 10000).default(""),
  event_date: dateOnly,
  photo_ids: z.array(z.uuid()).default([]),
});
export const profileInput = z.strictObject({
  display_name: textField(1, 100),
  avatar_photo_id: z.uuid().nullable().optional(),
});
export const entryInput = z.strictObject({
  kind: z.enum(["diary", "letter"]),
  title: textField(1, 200),
  content: textField(1, 50000),
  event_date: dateOnly,
});
export const albumInput = z.strictObject({ title: textField(1, 200) });
