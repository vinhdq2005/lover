import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock(
  "../../src/lib/commands",
  () => ({
    prepareCommand: (command: string, payload: unknown) => ({
      command,
      payload,
    }),
    executeCommand: mocks.execute,
  }),
);
import { EntryForm } from "../../src/features/diary/EntryForm";
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
function fill(title: string, content: string) {
  fireEvent.change(screen.getByLabelText("Tiêu đề bài viết"), {
    target: { value: title },
  });
  fireEvent.change(screen.getByLabelText("Nội dung bài viết"), {
    target: { value: content },
  });
  fireEvent.change(screen.getByLabelText("Ngày viết"), {
    target: { value: "2024-02-29" },
  });
}
it("pending saves freeze the submitted draft so new edits cannot be cleared by an older response", async () => {
  let complete!: (value: unknown) => void;
  mocks.execute.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
  render(<EntryForm onSaved={vi.fn()} />);
  fill("Đang lưu", "Giữ nội dung này");
  fireEvent.click(screen.getByRole("button", { name: "Lưu bài viết" }));
  expect(screen.getByLabelText("Tiêu đề bài viết")).toBeDisabled();
  expect(screen.getByLabelText("Nội dung bài viết")).toBeDisabled();
  expect(screen.getByRole("combobox", { name: "Loại bài viết" })).toBeDisabled();
  complete({});
  await waitFor(() => expect(screen.getByLabelText("Tiêu đề bài viết")).toBeEnabled());
});
it("failed saves retain Vietnamese text and offer reconciliation without false success", async () => {
  mocks.execute.mockRejectedValue(new Error("CONFLICT"));
  const saved = vi.fn();
  render(<EntryForm onSaved={saved} />);
  fill("Thương 💗", "Những ngày bình yên é");
  fireEvent.click(screen.getByRole("button", { name: "Lưu bài viết" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Nội dung của bạn vẫn được giữ",
  );
  expect(screen.getByLabelText("Nội dung bài viết")).toHaveValue(
    "Những ngày bình yên é",
  );
  expect(saved).not.toHaveBeenCalled();
});
it("whitespace is rejected while the 200-code-point emoji title is submitted", async () => {
  mocks.execute.mockResolvedValue({});
  render(<EntryForm onSaved={vi.fn()} />);
  fill("Title", " \n\t");
  fireEvent.click(screen.getByRole("button", { name: "Lưu bài viết" }));
  expect(mocks.execute).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toBeVisible();
  fill("💗".repeat(200), "Chào em");
  fireEvent.change(screen.getByRole("combobox", { name: "Loại bài viết" }), {
    target: { value: "letter" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu bài viết" }));
  await waitFor(() =>
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "entry.create",
        payload: expect.objectContaining({
          kind: "letter",
          title: "💗".repeat(200),
        }),
      }),
    )
  );
});
it("editing binds the original version and resource, with no author or couple injection", async () => {
  mocks.execute.mockResolvedValue({});
  const saved = vi.fn();
  render(
    <EntryForm
      entry={{
        id: "entry-id",
        author_id: "actor",
        kind: "diary",
        title: "Before",
        content: "text",
        event_date: "2024-01-01",
        created_at: "2024-01-01",
        version: 7,
      }}
      onSaved={saved}
    />,
  );
  fill("After", "Đã sửa");
  fireEvent.click(screen.getByRole("button", { name: "Lưu bài viết" }));
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(mocks.execute).toHaveBeenCalledWith({
    command: "entry.update",
    payload: {
      id: "entry-id",
      expected_version: 7,
      kind: "diary",
      title: "After",
      content: "Đã sửa",
      event_date: "2024-02-29",
    },
  });
});
