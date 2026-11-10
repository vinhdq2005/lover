import { mediaSchemas } from "../api/media.ts";
function assert(v: unknown): asserts v {
  if (!v) throw new Error("Assertion failed");
}
const target = {
  id: "00000000-0000-4000-8000-000000000001",
  expected_version: 1,
};
Deno.test("photo commands bind target/version and reject owner/path injection", () => {
  const input = {
    ...target,
    description: "Thương 💗",
    event_date: "2024-02-29",
    album_id: null,
  };
  assert(mediaSchemas["photo.update"].safeParse(input).success);
  for (
    const invalid of [
      { ...input, uploader_id: target.id },
      { ...input, storage_path: "forged" },
      { ...input, expected_version: 0 },
      { ...input, event_date: "2023-02-29" },
      { ...input, description: "a".repeat(2001) },
    ]
  ) assert(!mediaSchemas["photo.update"].safeParse(invalid).success);
});
Deno.test("album commands trim Unicode titles and require versions for existing rows", () => {
  assert(
    mediaSchemas["album.create"].safeParse({ title: "  Kỷ niệm 🌸  " }).success,
  );
  assert(!mediaSchemas["album.create"].safeParse({ title: "   " }).success);
  assert(
    !mediaSchemas["album.update"].safeParse({ id: target.id, title: "Album" })
      .success,
  );
  assert(
    !mediaSchemas["album.delete"].safeParse({
      ...target,
      creator_id: target.id,
    }).success,
  );
});
