import { expect, test } from "@playwright/test";
import { provisionLocal } from "../helpers/localStack";
test.beforeAll(async () => {
  await provisionLocal();
});
test("no public registration and private access requires login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true }))
    .toBeVisible();
  await expect(page.getByRole("button", { name: /Sign up|Đăng ký/ }))
    .toHaveCount(0);
  await page.getByLabel("Email", { exact: true }).fill("outsider@example.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(
    "Local-Only-Test-Password-2026!",
  );
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bắt đầu câu chuyện" }))
    .toBeVisible();
  await page.getByLabel("Tên của chúng mình").fill("Unauthorized");
  await page.getByLabel("Ngày bắt đầu").fill("2024-01-01");
  await page.getByRole("button", { name: "Tạo không gian riêng" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.goto("/settings");
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true }))
    .toBeVisible();
  await page.goBack();
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true }))
    .toBeVisible();
});
