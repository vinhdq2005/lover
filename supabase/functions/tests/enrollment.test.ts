import { enrollmentPayload } from "../api/enrollment.ts";
function assert(v: unknown): asserts v {
  if (!v) throw new Error("Assertion failed");
}
Deno.test("couple setup rejects a forged identity and missing start date", () => {
  assert(
    !enrollmentPayload("couple.create", { name: "Test", actor_id: "forged" })
      .success,
  );
});
Deno.test("invitation requires actual matching-intent fields", () => {
  assert(
    enrollmentPayload("invitation.accept", { token: "x".repeat(48) }).success,
  );
  assert(
    !enrollmentPayload("invitation.create", { recipient_email: "invalid" })
      .success,
  );
});
Deno.test("enrollment schemas reject browser-supplied identity scope and recipient IDs", () => {
  for (
    const field of [
      "actor_id",
      "couple_id",
      "recipient_id",
      "token_hash",
      "expires_at",
    ]
  ) {
    assert(
      !enrollmentPayload("invitation.create", {
        recipient_email: "partner@example.test",
        [field]: "forged",
      }).success,
    );
    assert(
      !enrollmentPayload("invitation.accept", {
        token: "x".repeat(48),
        [field]: "forged",
      }).success,
    );
  }
});
