import { relationshipSchemas } from "./relationship.ts";
import { memorySchemas } from "./memories.ts";
import { enrollmentSchemas } from "./enrollment.ts";
import { uploadSchemas } from "./uploadSchemas.ts";
import { mediaSchemas } from "./media.ts";
import { entrySchemas } from "./entries.ts";
import { settingsSchemas } from "./settings.ts";
import { notificationSchemas } from "./notifications.ts";
import { z } from "zod";
import { issueOperation } from "../_shared/operations.ts";
import { HttpError } from "../_shared/http.ts";
import { authenticatedUser } from "../_shared/auth.ts";
import {
  albumInput,
  dateOnly,
  entryInput,
  memoryInput,
  profileInput,
  textField,
} from "../_shared/validation.ts";
export const payloads: Record<string, z.ZodType> = {
  ...relationshipSchemas,
  ...memorySchemas,
  ...uploadSchemas,
  "couple.create": z.strictObject({
    name: textField(1, 100),
    start_date: dateOnly,
    timezone: z.string().min(1).max(100),
  }),
  "invitation.accept": z.strictObject({ token: z.string().min(32).max(200) }),
  "invitation.create": z.strictObject({ recipient_email: z.email() }),
  "invitation.revoke": z.strictObject({
    id: z.uuid(),
    expected_version: z.int().positive(),
  }),
  "memory.create": memoryInput,
  "entry.create": entryInput,
  "album.create": albumInput,
  "profile.update": profileInput.extend({
    expected_version: z.int().positive(),
  }),
  ...mediaSchemas,
  ...entrySchemas,
  ...settingsSchemas,
  ...notificationSchemas,
};
export async function issue(request: Request, raw: unknown) {
  const { user, client } = await authenticatedUser(request);
  const intentInput = z.strictObject({
    command: z.string(),
    payload: z.record(z.string(), z.unknown()),
  }).safeParse(raw);
  if (!intentInput.success) throw new HttpError(400);
  const schema = enrollmentSchemas[intentInput.data.command] ??
    payloads[intentInput.data.command];
  if (!schema) throw new HttpError(400);
  const parsed = schema.safeParse(intentInput.data.payload);
  if (!parsed.success) throw new HttpError(400);
  const intent = {
    command: intentInput.data.command,
    payload: parsed.data as Record<string, unknown>,
  };
  const { data: rate, error: rateError } = await client.rpc(
    "reserve_operation_issue",
  );
  if (rateError) throw new HttpError(503);
  if (!rate) throw new HttpError(429);
  const key = Deno.env.get("OPERATION_SIGNING_KEY"),
    keyId = Deno.env.get("OPERATION_SIGNING_KEY_ID");
  if (!key || !keyId) throw new HttpError(503);
  return issueOperation(
    user.id,
    intent,
    { key, keyId },
    async (_actor, input) => {
      const { data, error } = await client.rpc("authorize_operation_intent", {
        command: input.command,
        payload: input.payload,
      });
      return !error && data === true;
    },
  );
}
