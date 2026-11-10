import { settingsSchemas } from "../api/settings.ts";
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Settings contract failed");
}
Deno.test("profile names count code points and mutations require positive versions", () => {
  const schema = settingsSchemas["profile.update"];
  assert(
    schema.safeParse({ display_name: "💗".repeat(100), expected_version: 1 })
      .success,
  );
  for (
    const patch of [{ display_name: " " }, { display_name: "💗".repeat(101) }, {
      expected_version: 0,
    }, { expected_version: undefined }]
  ) {
    assert(
      !schema.safeParse({ display_name: "Tên", expected_version: 1, ...patch })
        .success,
    );
  }
});
Deno.test("profile cannot target another identity or change email; references must be UUID or null", () => {
  for (
    const patch of [
      { user_id: crypto.randomUUID() },
      { email: "other@example.test" },
      { couple_id: crypto.randomUUID() },
      { avatar_photo_id: "foreign/path.jpg" },
    ]
  ) {
    assert(
      !settingsSchemas["profile.update"].safeParse({
        display_name: "Tên",
        expected_version: 1,
        ...patch,
      }).success,
    );
  }
  assert(
    settingsSchemas["profile.update"].safeParse({
      display_name: "Tên",
      expected_version: 1,
      avatar_photo_id: null,
    }).success,
  );
});
Deno.test("shared settings preserve date schema and bind version and photo identifiers", () => {
  const schema = settingsSchemas["couple.update"];
  assert(
    schema.safeParse({
      name: "Chúng mình",
      expected_version: 2,
      featured_photo_id: crypto.randomUUID(),
    }).success,
  );
  assert(
    !schema.safeParse({ expected_version: 1, name: "💗".repeat(101) }).success,
  );
  assert(
    !schema.safeParse({ expected_version: 1, start_date: "2023-02-29" })
      .success,
  );
  assert(
    !schema.safeParse({
      expected_version: 1,
      featured_photo_id: "storage/path",
    }).success,
  );
});
