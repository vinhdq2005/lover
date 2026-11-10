import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), prefs: vi.fn() }));
vi.mock(
  "../../src/lib/supabase",
  () => ({
    supabase: () => ({
      rpc: mocks.rpc,
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: mocks.prefs }) }),
      }),
    }),
  }),
);
import { useNotifications } from "../../src/features/notifications/useNotifications";
import { clearPrivateSession } from "../../src/lib/privateSession";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
it("polls only visible pages and logout invalidates a delayed private inbox response", async () => {
  vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  mocks.rpc.mockResolvedValue({ data: [], error: null });
  mocks.prefs.mockResolvedValue({ data: null, error: null });
  const hook = renderHook(() => useNotifications("user"));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(120000);
  });
  expect(mocks.rpc).not.toHaveBeenCalled();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60000);
  });
  expect(mocks.rpc).toHaveBeenCalledTimes(2);
  let complete!: (value: unknown) => void;
  mocks.rpc.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  let reload!: Promise<void>;
  act(() => {
    reload = hook.result.current.reload();
  });
  await act(async () => {
    clearPrivateSession();
    complete({ data: [{ id: "private" }], error: null });
    await reload;
  });
  expect(hook.result.current.items).toEqual([]);
});
