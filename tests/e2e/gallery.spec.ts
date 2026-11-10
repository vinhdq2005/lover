import { expect, type Page, test } from "@playwright/test";
import { provisionCoupleLocal } from "../helpers/localStack";
import { tinyJpeg } from "../helpers/images";
import { cleanGalleryFixture } from "../helpers/galleryFixture";
test.beforeEach(async () => {
  await cleanGalleryFixture();
  await provisionCoupleLocal();
});
test.afterEach(async ({ page }) => {
  // Stop requests before removing this test's private objects and records.
  await page.close();
  await cleanGalleryFixture();
});
async function login(page: Page, role = "first") {
  await page.goto("/gallery");
  await page.getByLabel("Email", { exact: true }).fill(role + "@example.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(
    "Local-Only-Test-Password-2026!",
  );
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Thư viện ảnh", exact: true }))
    .toBeVisible();
}
async function logout(page: Page) {
  const response = page.waitForResponse((response) =>
    response.url().includes("/auth/v1/logout") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  expect((await response).ok()).toBe(true);
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  for (const route of ["/gallery", "/timeline"]) {
    await page.goto(route);
    await expect(page.getByRole("textbox", { name: "Email", exact: true })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(0);
  }
}
test(
  "private gallery supports partial retry, albums, viewer, partner denial and memory reference cleanup",
  async ({ page }, info) => {
    test.setTimeout(120000);
    await login(page);
    let uploads = 0;
    await page.route("**/storage/v1/object/staging/**", async (route) => {
      if (route.request().method() === "POST" && ++uploads === 2) {
        await route.abort("failed");
      } else await route.continue();
    });
    const bytes = Buffer.from(await tinyJpeg());
    await page.getByLabel("Chọn ảnh", { exact: true }).setInputFiles([
      { name: "first.jpg", mimeType: "image/jpeg", buffer: bytes },
      { name: "second.jpg", mimeType: "image/jpeg", buffer: bytes },
      {
        name: "invalid.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from("<svg/>"),
      },
    ]);
    await expect(page.getByText("first.jpg: Đã lưu", { exact: true }))
      .toBeVisible();
    await expect(page.getByText("second.jpg: Chưa lưu", { exact: true }))
      .toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Tiến độ first.jpg" }))
      .toHaveAttribute("value", "100");
    await page.getByRole("button", {
      name: "Thử lại ảnh chưa lưu",
      exact: true,
    }).click();
    await expect(
      page.getByText("Đã hoàn tất đợt tải. Bạn có thể chọn thêm ảnh.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(uploads).toBe(3);
    await expect(page.getByRole("article")).toHaveCount(2);
    const album = "Bộ ảnh " + info.project.name,
      description = "Khoảnh khắc 💗 " + info.project.name,
      memory = "Kỷ niệm ảnh " + info.project.name;
    await page.getByLabel("Tên album", { exact: true }).fill(album);
    await page.getByRole("button", { name: "Tạo album", exact: true }).click();
    await expect(page.getByRole("option", { name: album, exact: true }))
      .toHaveCount(1);
    await page.getByRole("article").first().getByRole("button", {
      name: "Sửa ảnh",
      exact: true,
    }).click();
    await page.getByLabel("Mô tả ảnh", { exact: true }).fill(description);
    await page.getByLabel("Ngày chụp", { exact: true }).fill("2024-02-14");
    const albumSelect = page.getByRole("combobox", { name: "Album của ảnh", exact: true });
    await expect(albumSelect).toBeVisible();
    await expect(albumSelect).toBeEnabled();
    await expect(albumSelect.getByRole("option", { name: album, exact: true })).toHaveCount(1);
    await albumSelect.selectOption({
      label: album,
    });
    await page.getByRole("button", { name: "Lưu thông tin ảnh", exact: true })
      .click();
    const described = page.getByRole("article", {
      name: description,
      exact: true,
    });
    await expect(described).toBeVisible();
    await described.getByRole("button", { name: "Mở ảnh", exact: true })
      .click();
    const viewer = page.getByRole("dialog", {
      name: "Ảnh kỷ niệm",
      exact: true,
    });
    await expect(viewer).toBeVisible();
    await expect(viewer.getByRole("img")).toBeVisible();
    await viewer.press("ArrowLeft");
    await expect(viewer.getByText("1 / 2", { exact: true })).toBeVisible();
    await viewer.press("ArrowRight");
    await expect(viewer.getByText("2 / 2", { exact: true })).toBeVisible();
    await viewer.getByRole("button", { name: "Đóng ảnh", exact: true }).click();
    await expect(viewer).not.toBeVisible();
    await page.getByRole("link", { name: "Kỷ niệm", exact: true }).click();
    await page.getByLabel("Tiêu đề", { exact: true }).fill(memory);
    await page.getByLabel("Ngày diễn ra", { exact: true }).fill("2024-02-14");
    await page.getByLabel(description, { exact: true }).check();
    await page.getByRole("button", { name: "Lưu kỷ niệm", exact: true })
      .click();
    const memoryCard = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: memory, exact: true }),
    });
    await memoryCard.scrollIntoViewIfNeeded();
    await expect(
      memoryCard.getByRole("img", { name: description, exact: true }),
    ).toBeVisible();
    await logout(page);
    await login(page, "partner");
    await expect(page.getByRole("article", { name: description, exact: true }))
      .toBeVisible();
    await expect(page.getByRole("button", { name: "Sửa ảnh", exact: true }))
      .toHaveCount(0);
    await expect(page.getByRole("button", { name: "Xóa ảnh", exact: true }))
      .toHaveCount(0);
    await logout(page);
    await login(page);
    await described.getByRole("button", { name: "Xóa ảnh", exact: true })
      .click();
    await page.getByRole("dialog", { name: "Xóa ảnh này?", exact: true })
      .getByRole("button", { name: "Xác nhận", exact: true }).click();
    await expect(described).toHaveCount(0);
    await expect(page.getByRole("article")).toHaveCount(1);
    await page.getByRole("article").first().getByRole("button", {
      name: "Sửa ảnh",
      exact: true,
    }).click();
    await albumSelect.selectOption({
      label: album,
    });
    await page.getByRole("button", { name: "Lưu thông tin ảnh", exact: true })
      .click();
    await expect(
      page.getByRole("form", { name: "Sửa thông tin ảnh", exact: true }),
    ).toHaveCount(0);
    const albumFilter = page.getByRole("combobox", { name: "Lọc album", exact: true });
    await expect(albumFilter).toBeVisible();
    await expect(albumFilter).toBeEnabled();
    await expect(albumFilter).toHaveAccessibleName("Lọc album");
    await expect(page.getByLabel("Lọc album", { exact: true })).toHaveCount(1);
    await expect(albumFilter.getByRole("option", { name: album, exact: true })).toHaveCount(1);
    await albumFilter.selectOption({
      label: album,
    });
    await page.getByRole("button", { name: "Xóa album", exact: true }).click();
    await page.getByRole("dialog", { name: "Xóa album này?", exact: true })
      .getByRole("button", { name: "Xác nhận", exact: true }).click();
    await expect(albumFilter).toHaveValue("");
    await expect(page.getByRole("article")).toHaveCount(1);
    await page.getByRole("article").first().getByRole("button", {
      name: "Xóa ảnh",
      exact: true,
    }).click();
    await page.getByRole("dialog", { name: "Xóa ảnh này?", exact: true })
      .getByRole("button", { name: "Xác nhận", exact: true }).click();
    await expect(page.getByRole("article")).toHaveCount(0);
    await page.getByRole("link", { name: "Kỷ niệm", exact: true }).click();
    await memoryCard.scrollIntoViewIfNeeded();
    await expect(memoryCard.getByRole("img")).toHaveCount(0);
    await memoryCard.getByRole("button", { name: "Xóa", exact: true }).click();
    await page.getByRole("dialog", { name: "Xóa kỷ niệm này?", exact: true })
      .getByRole("button", { name: "Xác nhận", exact: true }).click();
    await expect(page.getByRole("heading", { name: memory, exact: true }))
      .toHaveCount(0);
  },
);
