import { describe, expect, it } from "vitest";
import {
  dateOnly,
  memoryInput,
  operationId,
  textField,
} from "../../src/lib/validation";
describe("trusted input boundaries", () => {
  it("counts Unicode code points without dropping Vietnamese or emoji", () => {
    const name = textField(1, 3);
    expect(name.parse("  Yêu ")).toBe("Yêu");
    expect(name.parse("💗💗💗")).toBe("💗💗💗");
    expect(name.safeParse("💗💗💗💗").success).toBe(false);
  });
  it("rejects whitespace-only required text and preserves plain text", () => {
    expect(textField(1, 200).safeParse("  ").success).toBe(false);
    expect(textField(1, 200).parse("<script>alert(1)</script>")).toBe(
      "<script>alert(1)</script>",
    );
  });
  it("rejects invalid calendar dates", () => {
    expect(dateOnly.safeParse("2025-02-29").success).toBe(false);
    expect(dateOnly.parse("2024-02-29")).toBe("2024-02-29");
    expect(dateOnly.safeParse("2024-2-1").success).toBe(false);
  });
  it("rejects actor injection and incomplete memory input", () => {
    expect(
      memoryInput.safeParse({
        title: "K? ni?m",
        description: "",
        event_date: "2024-01-01",
        actor_id: "forged",
      }).success,
    ).toBe(false);
    expect(
      memoryInput.safeParse({ title: "", event_date: "2024-01-01" }).success,
    ).toBe(false);
  });
  it("requires a UUID operation identity", () => {
    expect(operationId.safeParse("forged").success).toBe(false);
    expect(
      operationId.safeParse("00000000-0000-4000-8000-000000000001").success,
    ).toBe(true);
  });
});
