import { z } from "zod";
const target = z.strictObject({ notification_id: z.uuid() });
export const notificationSchemas: Record<string, z.ZodType> = {
  "notification.mark_read": target,
  "notification.retry_email": target,
  "notification.preferences": z.strictObject({ email_enabled: z.boolean(), expected_version: z.int().nonnegative() }),
};
