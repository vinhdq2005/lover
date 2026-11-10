import { expect, type Page, test } from "@playwright/test";
import { provisionCoupleLocal } from "../helpers/localStack";
import { cleanGalleryFixture } from "../helpers/galleryFixture";
test.beforeEach(async () => {
  await cleanGalleryFixture();
  await provisionCoupleLocal();
});
test.afterEach(async ({ page }) => {
  await page.close();
  await cleanGalleryFixture();
});
async function login(page: Page, role: string) {
  await page.goto("/diary");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(
    role + "@example.test",
  );
  await page.getByLabel("Mật khẩu", { exact: true }).fill(
    "Local-Only-Test-Password-2026!",
  );
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nhật ký và thư tình", exact: true }),
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
  await page.goto("/diary");
  await expect(page.getByRole("textbox", { name: "Email", exact: true }))
    .toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
}
test("both authors share diary/letters safely, with author edits and confirmed deletion", async ({ page }) => {
  const hostile =
    'Tiếng Việt é 💗 <script>window.__diaryUnsafe=true</script>\n<img src=x onerror="window.__diaryUnsafe=true">';
  await login(page, "first");
  await page.getByRole("combobox", { name: "Loại bài viết", exact: true })
    .selectOption("letter");
  await page.getByLabel("Tiêu đề bài viết", { exact: true }).fill(
    "Gửi người thương 💗",
  );
  await page.getByLabel("Ngày viết", { exact: true }).fill("2024-02-29");
  await page.getByLabel("Nội dung bài viết", { exact: true }).fill(hostile);
  await page.getByRole("button", { name: "Lưu bài viết", exact: true }).click();
  const letter = page.getByRole("article", {
    name: "Gửi người thương 💗",
    exact: true,
  });
  await expect(letter).toBeVisible();
  await letter.getByText("Đọc bài viết", { exact: true }).click();
  await expect(letter.getByText(hostile, { exact: true })).toBeVisible();
  await expect(letter.locator("script,img")).toHaveCount(0);
  expect(await page.evaluate(() => "__diaryUnsafe" in window)).toBe(false);
  await logout(page);
  await login(page, "partner");
  await expect(letter).toBeVisible();
  await expect(
    letter.getByRole("button", { name: "Sửa bài viết", exact: true }),
  ).toHaveCount(0);
  await expect(
    letter.getByRole("button", { name: "Xóa bài viết", exact: true }),
  ).toHaveCount(0);
  await letter.getByText("Đọc bài viết", { exact: true }).click();
  await expect(letter.getByText(hostile, { exact: true })).toBeVisible();
  await page.getByLabel("Tiêu đề bài viết", { exact: true }).fill(
    "Ngày bình yên",
  );
  await page.getByLabel("Ngày viết", { exact: true }).fill("2024-03-01");
  await page.getByLabel("Nội dung bài viết", { exact: true }).fill(
    "Cùng nhau viết tiếp câu chuyện.",
  );
  await page.getByRole("button", { name: "Lưu bài viết", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page.getByRole("article").first()).toHaveAccessibleName(
    "Ngày bình yên",
  );
  await logout(page);
  await login(page, "first");
  await expect(
    page.getByRole("article", { name: "Ngày bình yên", exact: true }),
  ).toBeVisible();
  await letter.getByRole("button", { name: "Sửa bài viết", exact: true })
    .click();
  await page.getByLabel("Tiêu đề bài viết", { exact: true }).fill("Thư đã sửa");
  await page.getByRole("button", { name: "Lưu bài viết", exact: true }).click();
  const edited = page.getByRole("article", { name: "Thư đã sửa", exact: true });
  await expect(edited).toBeVisible();
  await edited.getByRole("button", { name: "Xóa bài viết", exact: true })
    .click();
  const confirm = page.getByRole("dialog", {
    name: "Xóa bài viết này?",
    exact: true,
  });
  await confirm.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(edited).toBeVisible();
  await edited.getByRole("button", { name: "Xóa bài viết", exact: true })
    .click();
  await confirm.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(edited).toHaveCount(0);
  await logout(page);
  await login(page, "partner");
  await expect(edited).toHaveCount(0);
  const diary = page.getByRole("article", {
    name: "Ngày bình yên",
    exact: true,
  });
  await diary.getByRole("button", { name: "Xóa bài viết", exact: true })
    .click();
  await confirm.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(0);
});
