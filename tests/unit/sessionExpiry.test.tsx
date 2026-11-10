import { expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { SessionProvider, useSession } from "../../src/app/SessionProvider";
import { registerPrivateCleanup } from "../../src/lib/privateSession";
const mock = vi.hoisted(() => ({
  expiresAt: Math.floor(Date.now() / 1000) + 2,
}));
vi.mock("../../src/lib/supabase", () => ({
  supabase: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { expires_at: mock.expiresAt, user: { id: "test" } } },
        error: null,
      }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
  }),
}));
function View() {
  const value = useSession();
  return <span>{value.session ? "Private" : "Locked"}</span>;
}
it("clears loaded private state when session expires", async () => {
  vi.useFakeTimers();
  let count = 0;
  const off = registerPrivateCleanup(() => count++);
  render(
    <SessionProvider>
      <View />
    </SessionProvider>,
  );
  await act(async () => {});
  expect(screen.getByText("Private")).toBeVisible();
  await act(async () => {
    vi.advanceTimersByTime(3000);
  });
  expect(screen.getByText("Locked")).toBeVisible();
  expect(count).toBeGreaterThan(0);
  off();
  cleanup();
  vi.useRealTimers();
});
