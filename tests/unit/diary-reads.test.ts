import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock(
  "../../src/lib/supabase",
  () => ({ supabase: () => ({ from: mocks.from }) }),
);
import { type Entry, useEntries } from "../../src/features/diary/useEntries";
import { clearPrivateSession } from "../../src/lib/privateSession";
function request() {
  let complete!: (value: { data: Entry[]; error: null }) => void;
  const promise = new Promise<{ data: Entry[]; error: null }>((resolve) => {
    complete = resolve;
  });
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    or: vi.fn(),
    then: promise.then.bind(promise),
  };
  for (const name of ["select", "eq", "order", "limit", "or"] as const) {
    query[name].mockReturnValue(query);
  }
  return { query, complete };
}
const item: Entry = {
  id: "60000000-0000-4000-8000-000000000061",
  author_id: "actor",
  title: "Private",
  content: "text",
  kind: "diary",
  event_date: "2024-02-29",
  created_at: "2024-02-29T12:00:00Z",
  version: 1,
};
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
it("logout invalidates an in-flight read before private content can return", async () => {
  const pending = request();
  mocks.from.mockReturnValue(pending.query);
  const hook = renderHook(() => useEntries("couple"));
  await act(async () => {
    clearPrivateSession();
    pending.complete({ data: [item], error: null });
  });
  expect(hook.result.current.items).toEqual([]);
  expect(hook.result.current.loading).toBe(false);
});
it("pagination uses descending date/time/id and an exclusive cursor; stale reload cannot win", async () => {
  const first = request(),
    stale = request(),
    latest = request(),
    next = request();
  mocks.from.mockReturnValueOnce(first.query).mockReturnValueOnce(stale.query)
    .mockReturnValueOnce(latest.query).mockReturnValueOnce(next.query);
  const hook = renderHook(() => useEntries("couple"));
  await act(async () => first.complete({ data: [item], error: null }));
  expect(first.query.order.mock.calls.map((call) => call[0])).toEqual([
    "event_date",
    "created_at",
    "id",
  ]);
  expect(first.query.limit).toHaveBeenCalledWith(30);
  let a!: Promise<void>, b!: Promise<void>;
  act(() => {
    a = hook.result.current.reload();
    b = hook.result.current.reload();
  });
  await act(async () => {
    latest.complete({ data: [{ ...item, title: "New" }], error: null });
    await b;
    stale.complete({ data: [item], error: null });
    await a;
  });
  await waitFor(() => expect(hook.result.current.items[0].title).toBe("New"));
  let page!: Promise<void>;
  act(() => {
    page = hook.result.current.next();
  });
  expect(next.query.or).toHaveBeenCalledWith(
    expect.stringContaining("id.lt." + item.id),
  );
  await act(async () => {
    next.complete({ data: [], error: null });
    await page;
  });
});
