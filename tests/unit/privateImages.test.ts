import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  create: vi.fn(),
  revoke: vi.fn(),
}));
vi.mock(
  "../../src/lib/supabase",
  () => ({
    supabase: () => ({
      storage: { from: () => ({ download: mocks.download }) },
    }),
  }),
);
import { clearPrivateSession } from "../../src/lib/privateSession";
import { loadPrivateImage } from "../../src/lib/privateImages";
const NativeURL = URL;
beforeEach(() => {
  clearPrivateSession();
  vi.clearAllMocks();
  vi.stubGlobal(
    "URL",
    class extends NativeURL {
      static createObjectURL = mocks.create;
      static revokeObjectURL = mocks.revoke;
    },
  );
  mocks.create.mockImplementation(() =>
    "blob:test-" + mocks.create.mock.calls.length
  );
  mocks.download.mockResolvedValue({
    data: new Blob(["private bytes"]),
    error: null,
  });
});
it("closing each consumer revokes its own URL while shared active bytes stay usable", async () => {
  const a = await loadPrivateImage("same.jpg"),
    b = await loadPrivateImage("same.jpg");
  expect(a.url).not.toBe(b.url);
  expect(mocks.download).toHaveBeenCalledTimes(1);
  a.release();
  expect(mocks.revoke).toHaveBeenCalledWith(a.url);
  expect(mocks.revoke).not.toHaveBeenCalledWith(b.url);
  b.release();
  await loadPrivateImage("same.jpg");
  expect(mocks.download).toHaveBeenCalledTimes(2);
});
it("logout revokes every URL and rejects a late private download before creating an object URL", async () => {
  const a = await loadPrivateImage("a.jpg");
  let resolve!: (value: { data: Blob; error: null }) => void;
  mocks.download.mockImplementationOnce(() =>
    new Promise((res) => {
      resolve = res;
    })
  );
  const pending = loadPrivateImage("late.jpg");
  const rejected = expect(pending).rejects.toThrow("SESSION_EXPIRED");
  clearPrivateSession();
  resolve({ data: new Blob(["late"]), error: null });
  await rejected;
  expect(mocks.revoke).toHaveBeenCalledWith(a.url);
  expect(mocks.create).toHaveBeenCalledTimes(1);
});
it("caps active private blobs at 32 MiB and recovers capacity after consumers close", async () => {
  mocks.download.mockImplementation(async () => ({
    data: new Blob([new Uint8Array(10 * 1024 * 1024)]),
    error: null,
  }));
  const active = await Promise.all([
    loadPrivateImage("1"),
    loadPrivateImage("2"),
    loadPrivateImage("3"),
  ]);
  await expect(loadPrivateImage("4")).rejects.toThrow("IMAGE_MEMORY_LIMIT");
  active.forEach((image) => image.release());
  const recovered = await loadPrivateImage("4");
  expect(recovered.url).toContain("blob:");
  recovered.release();
});
