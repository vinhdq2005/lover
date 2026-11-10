import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ execute: vi.fn(), gallery: vi.fn() }));
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
vi.mock(
  "../../src/features/gallery/useGallery",
  () => ({ useGallery: mocks.gallery }),
);
import { ProfileForm } from "../../src/features/settings/ProfileForm";
import { SharedProfileForm } from "../../src/features/settings/SharedProfileForm";
import { RelationshipSettings } from "../../src/features/settings/RelationshipSettings";
const profile = {
  user_id: "first",
  display_name: "Mình",
  avatar_photo_id: null,
  version: 1,
  avatar: null,
};
const couple = {
  id: "couple",
  name: "Our Story",
  start_date: "2024-01-01",
  first_meeting_date: null,
  timezone: "Asia/Ho_Chi_Minh",
  featured_photo_id: null,
  version: 1,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.execute.mockResolvedValue({});
  mocks.gallery.mockReturnValue({
    photos: [{ id: "own", uploader_id: "first", description: "Ảnh của mình" }, {
      id: "partner",
      uploader_id: "second",
      description: "Ảnh người thương",
    }],
    loading: false,
    error: false,
    more: false,
  });
});
afterEach(cleanup);
it("a background profile refresh preserves a dirty draft and its original expected version", async () => {
  mocks.execute.mockRejectedValue(new Error("CONFLICT"));
  const view = render(
    <ProfileForm
      profile={profile}
      actorId="first"
      coupleId="couple"
      onSaved={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Tên hiển thị" }), {
    target: { value: "Draft" },
  });
  view.rerender(
    <ProfileForm
      profile={{ ...profile, display_name: "New server name", version: 2 }}
      actorId="first"
      coupleId="couple"
      onSaved={vi.fn()}
    />,
  );
  expect(screen.getByRole("textbox", { name: "Tên hiển thị" })).toHaveValue(
    "Draft",
  );
  fireEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ của tôi" }));
  await screen.findByRole("alert");
  expect(mocks.execute).toHaveBeenCalledWith(
    expect.objectContaining({
      payload: expect.objectContaining({
        display_name: "Draft",
        expected_version: 1,
      }),
    }),
  );
});
it("partner profile has no editable form or command path", () => {
  render(
    <ProfileForm
      profile={profile}
      actorId="second"
      coupleId="couple"
      onSaved={vi.fn()}
    />,
  );
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(mocks.execute).not.toHaveBeenCalled();
});
it("own avatar picker excludes partner uploads and binds version without identity fields", async () => {
  render(
    <ProfileForm
      profile={profile}
      actorId="first"
      coupleId="couple"
      onSaved={vi.fn()}
    />,
  );
  expect(screen.queryByRole("option", { name: "Ảnh người thương" })).not
    .toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Ảnh đại diện" }), {
    target: { value: "own" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ của tôi" }));
  await waitFor(() =>
    expect(mocks.execute).toHaveBeenCalledWith({
      command: "profile.update",
      payload: {
        display_name: "Mình",
        avatar_photo_id: "own",
        expected_version: 1,
      },
    })
  );
  expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
});
it("shared selector includes either member's images and a failed save preserves the draft", async () => {
  mocks.execute.mockRejectedValue(new Error("CONFLICT"));
  render(<SharedProfileForm couple={couple} onSaved={vi.fn()} />);
  fireEvent.change(
    screen.getByRole("textbox", { name: "Tên không gian chung" }),
    { target: { value: "Tên mới 💗" } },
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Ảnh nổi bật" }), {
    target: { value: "partner" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ chung" }));
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.getByRole("textbox", { name: "Tên không gian chung" }))
    .toHaveValue("Tên mới 💗");
});
it("relationship form still emits the original date command", async () => {
  render(<RelationshipSettings couple={couple} onSaved={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Lưu ngày kỷ niệm" }));
  await waitFor(() =>
    expect(mocks.execute).toHaveBeenCalledWith({
      command: "couple.update",
      payload: {
        expected_version: 1,
        start_date: "2024-01-01",
        first_meeting_date: null,
        timezone: "Asia/Ho_Chi_Minh",
      },
    })
  );
});
