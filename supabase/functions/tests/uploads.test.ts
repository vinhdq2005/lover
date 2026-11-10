import { uploadSchemas } from "../api/uploadSchemas.ts";
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Assertion failed");
}
const id = "00000000-0000-4000-8000-000000000001";
Deno.test("upload schemas bind exact reservation/file IDs and exclude client paths or actors", () => {
  const input = { batch_id: id, reservation_id: id, file_ids: [id] };
  assert(uploadSchemas["upload.finalize"].safeParse(input).success);
  for (
    const forged of [
      { ...input, actor_id: id },
      { ...input, path: "other" },
      { ...input, file_ids: [] },
      { ...input, file_ids: [id, id] },
      { batch_id: id, file_ids: [id] },
    ]
  ) assert(!uploadSchemas["upload.finalize"].safeParse(forged).success);
});
Deno.test("reservation bounds reject duplicate file identities and invalid bytes/types", () => {
  const file = {
    client_file_id: id,
    size: 10485760,
    declared_type: "image/jpeg",
  };
  assert(uploadSchemas["upload.reserve"].safeParse({ files: [file] }).success);
  for (
    const files of [[], [file, file], [{ ...file, size: 10485761 }], [{
      ...file,
      size: 0,
    }], [{ ...file, declared_type: "image/svg+xml" }]]
  ) assert(!uploadSchemas["upload.reserve"].safeParse({ files }).success);
});
