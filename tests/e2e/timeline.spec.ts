import { expect, test } from "@playwright/test";
import { provisionCoupleLocal } from "../helpers/localStack";
test.beforeAll(async () => {
  await provisionCoupleLocal();
});
test("creates, filters, edits and deletes author memory", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("first@example.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(
    "Local-Only-Test-Password-2026!",
  );
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.getByRole("link", { name: "Kỷ niệm", exact: true }).click();
  await page.getByLabel("Tiêu đề", { exact: true }).fill(
    "A private test memory",
  );
  await page.getByLabel("Ngày diễn ra").fill("2024-02-14");
  await page.getByLabel("Câu chuyện", { exact: true }).fill(
    "Only our two accounts can read this.",
  );
  await page.getByRole("button", { name: "Lưu kỷ niệm" }).click();
  await expect(page.getByRole("heading", { name: "A private test memory" }))
    .toBeVisible();
  await page.getByLabel("Từ ngày").fill("2024-02-14");
  await page.getByLabel("Đến ngày").fill("2024-02-14");
  await page.getByRole("button", { name: "Lọc kỷ niệm" }).click();
  await expect(page.getByRole("heading", { name: "A private test memory" }))
    .toBeVisible();
  await page.getByRole("button", { name: "Sửa", exact: true }).click();
  await page.getByLabel("Tiêu đề", { exact: true }).fill(
    "Updated private memory",
  );
  await page.getByRole("button", { name: "Lưu kỷ niệm" }).click();
  await expect(page.getByRole("heading", { name: "Updated private memory" }))
    .toBeVisible();
  await page.getByRole("button", { name: "Xóa", exact: true }).click();
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Updated private memory" }))
    .toHaveCount(0);
});
