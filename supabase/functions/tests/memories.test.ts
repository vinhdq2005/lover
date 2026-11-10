import { memorySchemas } from "../api/memories.ts";
function assert(v: unknown): asserts v {
  if (!v) throw new Error("Assertion failed");
}
Deno.test("memory edits bind row/version and cannot inject creator", () => {
  assert(
    !memorySchemas["memory.update"].safeParse({
      title: "Test",
      event_date: "2024-01-01",
    }).success,
  );
  assert(
    !memorySchemas["memory.create"].safeParse({
      title: "Test",
      event_date: "2024-01-01",
      creator_id: "forged",
    }).success,
  );
});
