import { expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StatePanel } from "../../src/components/StatePanel";
it("announces actionable errors and calls retry", () => {
  let called = 0;
  render(<StatePanel kind="error" message="Error" onRetry={() => called++} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Error");
  fireEvent.click(screen.getByRole("button"));
  expect(called).toBe(1);
  cleanup();
});
it("announces loading without pretending success", () => {
  render(<StatePanel kind="loading" message="Loading" />);
  expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  cleanup();
});
