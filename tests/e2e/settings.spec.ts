import { expect, type Page, test } from "@playwright/test";
import { provisionCoupleLocal } from "../helpers/localStack";
import { cleanGalleryFixture } from "../helpers/galleryFixture";
import { tinyJpeg } from "../helpers/images";
test.beforeEach(async () => {
  await cleanGalleryFixture();
  await provisionCoupleLocal();
});
test.afterEach(async ({ page }) => {
  await page.close();
  await cleanGalleryFixture();
});
async function login(page: Page, role: string) {
  await page.goto("/settings");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(
    role + "@example.test",
  );
  await page.getByLabel("Mật khẩu", { exact: true }).fill(
    "Local-Only-Test-Password-2026!",
  );
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Cài đặt của chúng mình", exact: true }),
  ).toBeVisible();
}
async function logout(page: Page) {
  const response = page.waitForResponse((r) =>
    r.url().includes("/auth/v1/logout") && r.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  expect((await response).ok()).toBe(true);
  await expect(page.getByRole("textbox", { name: "Email", exact: true }))
    .toBeVisible();
}
test("own profiles and shared names/dates/milestones/photos refresh across both partners", async ({ page }) => {
  await login(page, "first");
  await page.getByRole("link", { name: "Thư viện ảnh", exact: true }).click();
  await page.getByLabel("Chọn ảnh", { exact: true }).setInputFiles({
    name: "profile.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(await tinyJpeg()),
  });
  await expect(page.getByText("profile.jpg: Đã lưu", { exact: true }))
    .toBeVisible();
  await page.getByRole("article").first().getByRole("button", {
    name: "Sửa ảnh",
    exact: true,
  }).click();
  await page.getByLabel("Mô tả ảnh", { exact: true }).fill(
    "Ảnh riêng của mình",
  );
  await page.getByRole("button", { name: "Lưu thông tin ảnh", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Ảnh riêng của mình", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Cài đặt", exact: true }).click();
  await page.getByRole("textbox", { name: "Tên hiển thị", exact: true }).fill(
    "Minh 💗",
  );
  await page.getByRole("combobox", { name: "Ảnh đại diện", exact: true })
    .selectOption({ label: "Ảnh riêng của mình" });
  await page.getByRole("button", { name: "Lưu hồ sơ của tôi", exact: true })
    .click();
  await expect(page.getByText("Đã lưu.", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Tên không gian chung", exact: true })
    .fill("Nhà của chúng mình");
  await page.getByRole("combobox", { name: "Ảnh nổi bật", exact: true })
    .selectOption({ label: "Ảnh riêng của mình" });
  await page.getByRole("button", { name: "Lưu hồ sơ chung", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Lưu hồ sơ chung", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Ngày yêu nhau", { exact: true }).fill("2024-02-29");
  await page.getByLabel("Ngày gặp đầu tiên", { exact: true }).fill(
    "2023-01-01",
  );
  await page.getByRole("button", { name: "Lưu ngày kỷ niệm", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Lưu ngày kỷ niệm", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Tên ngày kỷ niệm", { exact: true }).fill(
    "Ngày đặc biệt của hai ta",
  );
  await page.getByLabel("Ngày kỷ niệm gốc", { exact: true }).fill("2024-03-01");
  await page.getByRole("button", { name: "Thêm ngày đặc biệt", exact: true })
    .click();
  await expect(
    page.getByText("Ngày đặc biệt của hai ta — 2024-03-01", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Câu chuyện", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nhà của chúng mình", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Ảnh đại diện Minh 💗", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Ảnh riêng của mình", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Từ 2024-02-29", { exact: true })).toBeVisible();
  await logout(page);
  await login(page, "partner");
  await expect(
    page.getByRole("textbox", { name: "Tên không gian chung", exact: true }),
  ).toHaveValue("Nhà của chúng mình");
  await expect(
    page.getByRole("option", { name: "Ảnh riêng của mình", exact: true }),
  ).toHaveCount(1); // featured only, never own avatar.
  await page.getByRole("textbox", { name: "Tên hiển thị", exact: true }).fill(
    "An 💗",
  );
  await page.getByRole("button", { name: "Lưu hồ sơ của tôi", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Lưu hồ sơ của tôi", exact: true }),
  ).toBeEnabled();
  await page.getByRole("textbox", { name: "Tên không gian chung", exact: true })
    .fill("Nhà hai người");
  await page.getByRole("button", { name: "Lưu hồ sơ chung", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Lưu hồ sơ chung", exact: true }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "Câu chuyện", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nhà hai người", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("An 💗", { exact: true })).toBeVisible();
  await logout(page);
  await login(page, "first");
  await expect(page.getByRole("textbox", { name: "Tên hiển thị", exact: true }))
    .toHaveValue("Minh 💗");
  await expect(
    page.getByRole("textbox", { name: "Tên không gian chung", exact: true }),
  ).toHaveValue("Nhà hai người");
  await page.getByRole("link", { name: "Thư viện ảnh", exact: true }).click();
  await page.getByRole("article", { name: "Ảnh riêng của mình", exact: true })
    .getByRole("button", { name: "Xóa ảnh", exact: true }).click();
  await page.getByRole("dialog", { name: "Xóa ảnh này?", exact: true })
    .getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.getByRole("link", { name: "Câu chuyện", exact: true }).click();
  await expect(page.getByRole("img")).toHaveCount(0);
  await expect(page.getByText(/Chưa có ảnh nổi bật/)).toBeVisible();
});
