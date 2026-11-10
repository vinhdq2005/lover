import { entrySchemas } from "../api/entries.ts";
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Entry contract assertion failed");
}
const input = {
  kind: "letter",
  title: "Gửi em 💗",
  content: "Một ngày bình yên",
  event_date: "2024-02-29",
};
Deno.test("entries preserve Vietnamese and count Unicode code points at exact limits", () => {
  const schema = entrySchemas["entry.create"];
  assert(schema.safeParse(input).success);
  assert(
    schema.safeParse({
      ...input,
      title: "💗".repeat(200),
      content: "💗".repeat(50000),
    }).success,
  );
  assert(!schema.safeParse({ ...input, title: "💗".repeat(201) }).success);
  assert(!schema.safeParse({ ...input, content: "💗".repeat(50001) }).success);
  assert(!schema.safeParse({ ...input, content: " \n\t " }).success);
  assert(!schema.safeParse({ ...input, title: " " }).success);
});
Deno.test("entries reject invalid dates, kinds and forged sharing or author fields", () => {
  for (
    const patch of [
      { kind: "secret" },
      { event_date: "2023-02-29" },
      { author_id: crypto.randomUUID() },
      { couple_id: crypto.randomUUID() },
      { private: true },
    ]
  ) {
    assert(
      !entrySchemas["entry.create"].safeParse({ ...input, ...patch }).success,
    );
  }
});
Deno.test("entry mutations require target and positive expected version", () => {
  assert(!entrySchemas["entry.update"].safeParse(input).success);
  assert(
    !entrySchemas["entry.delete"].safeParse({ id: crypto.randomUUID() })
      .success,
  );
  assert(
    entrySchemas["entry.update"].safeParse({
      ...input,
      id: crypto.randomUUID(),
      expected_version: 1,
    }).success,
  );
  assert(
    !entrySchemas["entry.delete"].safeParse({
      id: crypto.randomUUID(),
      expected_version: 0,
    }).success,
  );
});
