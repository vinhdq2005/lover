import { expect, test } from "@playwright/test";
import { provisionCoupleLocal } from "../helpers/localStack";
test.beforeAll(async () => {
  await provisionCoupleLocal();
});
test("shows separate counters and saves shared relationship date", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("first@example.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(
    "Local-Only-Test-Password-2026!",
  );
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByLabel("Số ngày yêu nhau")).toBeVisible();
  await page.getByRole("link", { name: "Cài đặt", exact: true }).click();
  await page.getByLabel("Ngày gặp đầu tiên").fill("2023-12-01");
  await page.getByRole("button", { name: "Lưu ngày kỷ niệm" }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu.");
  await page.getByRole("link", { name: "Câu chuyện", exact: true }).click();
  await expect(page.getByText(/Gặp lần đầu:/)).toBeVisible();
});
