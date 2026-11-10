import { expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { provisionLocal, resetLocalTestDatabase } from "../helpers/localStack";
it("serializes acceptance and rejects wrong recipient/third member", async () => {
  resetLocalTestDatabase();
  const { admin, users } = await provisionLocal();
  const commit = (
    actor: string,
    command: string,
    payload: Record<string, unknown>,
    hash?: string,
  ) =>
    admin.rpc("commit_enrollment", {
      actor,
      command,
      payload,
      op: randomUUID(),
      request_hash: randomUUID(),
      token_expiry: new Date(Date.now() + 86400000).toISOString(),
      invite_hash: hash ?? null,
    });
  const created = await commit(users.first, "couple.create", {
    name: "Test couple",
    start_date: "2024-01-01",
    timezone: "Asia/Ho_Chi_Minh",
  });
  expect(created.error).toBeNull();
  const token = "race-invitation-token-".repeat(3);
  const invite = await commit(users.first, "invitation.create", {
    recipient_email: "partner@example.test",
  }, createHash("sha256").update(token).digest("hex"));
  expect(invite.error).toBeNull();
  const outsider = await commit(users.outsider, "invitation.accept", { token });
  expect(outsider.error).not.toBeNull();
  const accepted = await Promise.all([
    commit(users.partner, "invitation.accept", { token }),
    commit(users.partner, "invitation.accept", { token }),
  ]);
  expect(accepted.filter((x) => !x.error)).toHaveLength(1);
  const { data: members } = await admin.from("memberships").select("slot");
  expect(members).toHaveLength(2);
  const replay = await commit(users.outsider, "invitation.accept", { token });
  expect(replay.error).not.toBeNull();
});
