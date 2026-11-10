import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock(
  "../../src/lib/supabase",
  () => ({ supabase: () => ({ from: mocks.from }) }),
);
import {
  SettingsProvider,
  useSettings,
} from "../../src/features/settings/useSettings";
import { useCouple } from "../../src/features/home/useCouple";
import { clearPrivateSession } from "../../src/lib/privateSession";
function deferred() {
  let complete!: (value: { data: unknown; error: null }) => void;
  const promise = new Promise<{ data: unknown; error: null }>((resolve) => {
    complete = resolve;
  });
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(() => promise),
    single: vi.fn(() => promise),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return { query, complete };
}
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("a late profile/avatar response cannot revive private data after logout", async () => {
  const request = deferred();
  mocks.from.mockReturnValue(request.query);
  const hook = renderHook(() => useSettings(), {
    wrapper: ({ children }) => (
      <SettingsProvider coupleId="couple">{children}</SettingsProvider>
    ),
  });
  await act(async () => {
    clearPrivateSession();
    request.complete({
      data: [{
        user_id: "first",
        display_name: "Private",
        avatar_photo_id: "deleted",
        version: 1,
        avatar: { storage_path: "private.jpg" },
      }],
      error: null,
    });
  });
  expect(hook.result.current.profiles).toEqual([]);
});
it("couple reload ignores older/deleted-image responses and logout invalidates pending reads", async () => {
  const old = deferred(), newer = deferred(), late = deferred();
  mocks.from.mockReturnValueOnce(old.query).mockReturnValueOnce(newer.query)
    .mockReturnValueOnce(late.query);
  const hook = renderHook(() => useCouple("couple"));
  let loading!: Promise<void>;
  act(() => {
    loading = hook.result.current.reload();
  });
  await act(async () => {
    newer.complete({
      data: { id: "couple", version: 3, featured_photo_id: null },
      error: null,
    });
    await loading;
    old.complete({
      data: { id: "couple", version: 2, featured_photo_id: "deleted" },
      error: null,
    });
  });
  expect(hook.result.current.couple?.version).toBe(3);
  expect(hook.result.current.couple?.featured_photo_id).toBeNull();
  act(() => {
    loading = hook.result.current.reload();
  });
  await act(async () => {
    clearPrivateSession();
    late.complete({ data: { id: "couple", version: 4 }, error: null });
    await loading;
  });
  expect(hook.result.current.couple).toBeNull();
});
