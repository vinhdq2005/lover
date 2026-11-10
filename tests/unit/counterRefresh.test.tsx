import { expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { Temporal } from "@js-temporal/polyfill";
import { coupleToday } from "../../src/lib/relationshipDates";
import { useRelationshipCounter } from "../../src/features/home/useRelationshipCounter";
it("uses couple timezone independent of device date", () => {
  const instant = Temporal.Instant.from("2024-01-01T17:00:00Z");
  expect(coupleToday("Asia/Ho_Chi_Minh", instant)).toBe("2024-01-02");
  expect(coupleToday("America/Los_Angeles", instant)).toBe("2024-01-01");
});
it("refreshes at couple midnight and on visible resume", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2024-01-01T16:59:59Z"));
  const { result } = renderHook(() =>
    useRelationshipCounter("2024-01-01", "Asia/Ho_Chi_Minh")
  );
  expect(result.current.days).toBe(0);
  await act(async () => {
    vi.advanceTimersByTime(2000);
  });
  expect(result.current.days).toBe(1);
  cleanup();
  vi.useRealTimers();
});
