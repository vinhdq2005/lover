import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { clearPrivateSession } from "../../src/lib/privateSession";
const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  prepare: vi.fn(),
  upload: vi.fn(),
}));
vi.mock(
  "../../src/lib/commands",
  () => ({
    prepareCommand: (command: string, payload: Record<string, unknown>) => ({
      command,
      payload,
    }),
    executeCommand: mocks.execute,
  }),
);
vi.mock("../../src/lib/prepareImage", () => ({ prepareImage: mocks.prepare }));
vi.mock(
  "../../src/lib/uploadTransport",
  () => ({ uploadPreparedFile: mocks.upload }),
);
import { useUploads } from "../../src/features/gallery/useUploads";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.prepare.mockImplementation(async () => ({
    file: new File(["prepared"], "photo.jpg", { type: "image/jpeg" }),
  }));
  mocks.upload.mockImplementation(
    async (_path: string, _file: File, progress: (n: number) => void) => {
      progress(90);
    },
  );
});
it("partial retry keeps prepared bytes and server IDs, skips saved files and closes once", async () => {
  let failed = false;
  mocks.execute.mockImplementation(
    async (op: { command: string; payload: Record<string, unknown> }) => {
      if (op.command === "upload.reserve") {
        return {
          batch_id: "batch",
          reservation_id: "reservation",
          files: (op.payload.files as { client_file_id: string }[]).map((
            file,
            index,
          ) => ({ ...file, file_id: "file" + index, path: "path" + index })),
        };
      }
      if (op.command === "upload.close") return { state: "closed" };
      const id = (op.payload.file_ids as string[])[0];
      if (id === "file1" && !failed) {
        failed = true;
        return { files: [{ state: "failed", error_code: "NOT_UPLOADED" }] };
      }
      return { files: [{ state: "ready", photo_id: id }] };
    },
  );
  const { result, unmount } = renderHook(() => useUploads(vi.fn()));
  await act(async () => {
    await result.current.start([
      new File(["a"], "a.jpg"),
      new File(["b"], "b.jpg"),
    ]);
  });
  expect(result.current.rows.map((row) => row.state)).toEqual([
    "saved",
    "failed",
  ]);
  const preparedB = mocks.upload.mock.calls[1][1];
  await act(async () => {
    await result.current.retry();
  });
  expect(result.current.rows.map((row) => row.state)).toEqual([
    "saved",
    "saved",
  ]);
  expect(result.current.closed).toBe(true);
  expect(mocks.prepare).toHaveBeenCalledTimes(2);
  expect(mocks.upload.mock.calls.map((call) => call[0])).toEqual([
    "path0",
    "path1",
    "path1",
  ]);
  expect(mocks.upload.mock.calls[2][1]).toBe(preparedB);
  expect(
    mocks.execute.mock.calls.filter((call) =>
      call[0].command === "upload.reserve"
    ),
  ).toHaveLength(1);
  expect(
    mocks.execute.mock.calls.filter((call) =>
      call[0].command === "upload.close"
    ),
  ).toHaveLength(1);
  const retries = mocks.execute.mock.calls.filter((call) =>
    call[0].payload.file_ids?.[0] === "file1"
  );
  expect(retries[0][0]).not.toBe(retries[1][0]);
  unmount();
});
it("rejects over-20 selection before preparation or reservation", async () => {
  const { result, unmount } = renderHook(() => useUploads(vi.fn()));
  await act(async () => {
    await result.current.start(
      Array.from({ length: 21 }, () => new File(["x"], "x.jpg")),
    );
  });
  expect(result.current.error).toContain("20");
  expect(mocks.prepare).not.toHaveBeenCalled();
  expect(mocks.execute).not.toHaveBeenCalled();
  unmount();
});
it("session cleanup prevents delayed preparation from restoring files or issuing commands", async () => {
  let resolve!: (value: { file: File }) => void;
  mocks.prepare.mockImplementation(() =>
    new Promise((res) => {
      resolve = res;
    })
  );
  const { result, unmount } = renderHook(() => useUploads(vi.fn()));
  let operation!: Promise<void>;
  await act(async () => {
    operation = result.current.start([new File(["x"], "x.jpg")]);
  });
  act(() => clearPrivateSession());
  await act(async () => {
    resolve({
      file: new File(["prepared"], "photo.jpg", { type: "image/jpeg" }),
    });
    await operation;
  });
  expect(result.current.rows).toEqual([]);
  expect(mocks.execute).not.toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
  unmount();
});
