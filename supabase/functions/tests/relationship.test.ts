import { relationshipSchemas } from "../api/relationship.ts";
function assert(v: unknown): asserts v {
  if (!v) throw new Error("Assertion failed");
}
Deno.test("relationship updates require version and valid calendar date", () => {
  const s = relationshipSchemas["couple.update"];
  assert(!s.safeParse({ start_date: "2024-01-01" }).success);
  assert(
    !s.safeParse({ expected_version: 1, start_date: "2024-02-30" }).success,
  );
  assert(
    s.safeParse({
      expected_version: 1,
      start_date: "2024-02-29",
      first_meeting_date: null,
    }).success,
  );
});
Deno.test("milestone titles reject blank and forged ownership", () => {
  assert(
    !relationshipSchemas["milestone.create"].safeParse({
      label: " ",
      original_date: "2024-01-01",
    }).success,
  );
  assert(
    !relationshipSchemas["milestone.create"].safeParse({
      label: "Test",
      original_date: "2024-01-01",
      actor_id: "forged",
    }).success,
  );
});
