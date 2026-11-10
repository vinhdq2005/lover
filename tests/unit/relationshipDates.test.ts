import { expect, it } from "vitest";
import {
  elapsedDays,
  upcomingMilestones,
} from "../../src/lib/relationshipDates";
it("uses date boundaries, not elapsed hours", () => {
  expect(elapsedDays("2024-01-01", "2024-01-01")).toBe(0);
  expect(elapsedDays("2024-03-09", "2024-03-11")).toBe(2);
  expect(elapsedDays("2024-02-28", "2024-03-01")).toBe(2);
});
it("keeps day-365 and annual dates distinct across a leap year", () => {
  const result = upcomingMilestones("2024-01-01", null, [], "2024-12-30", 5);
  expect(result.some((x) => x.date === "2024-12-31" && x.kind === "day")).toBe(
    true,
  );
  expect(
    result.some((x) => x.date === "2025-01-01" && x.kind === "anniversary"),
  ).toBe(true);
});
it("observes leap anniversaries February 28 and keeps same-day labels", () => {
  const result = upcomingMilestones(
    "2024-02-29",
    "2024-02-29",
    [],
    "2025-02-28",
    3,
  );
  expect(
    result.filter((x) =>
      x.date === "2025-02-28" && x.remaining === 0 && x.kind === "anniversary"
    ).length,
  ).toBe(2);
});
