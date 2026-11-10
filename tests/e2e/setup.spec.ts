import { expect, test } from "@playwright/test";
import { provisionLocal, resetLocalTestDatabase } from "../helpers/localStack";
test.beforeAll(async () => {
  test.setTimeout(120000);
  resetLocalTestDatabase();
  await provisionLocal();
});
test.skip(
  ({ isMobile }) => isMobile,
  "Enrollment mutates the singleton once; mobile login is covered separately.",
);
test("approved first user creates couple and privately invites matching partner", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("first@example.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(
    "Local-Only-Test-Password-2026!",
  );
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  const setup = page.getByRole("heading", { name: "Bắt đầu câu chuyện" });
  await expect(setup.or(page.getByRole("heading", { name: "Our Story", exact: true })))
    .toBeVisible();
  if (await setup.isVisible()) {
    await page.getByLabel("Tên của chúng mình").fill("Our Story");
    await page.getByLabel("Ngày bắt đầu").fill("2024-01-01");
    await page.getByRole("button", { name: "Tạo không gian riêng" }).click();
  }
  await expect(page.getByRole("heading", { name: "Our Story", exact: true })).toBeVisible();
  await page.getByLabel("Email người nhận").fill("partner@example.test");
  await page.getByRole("button", { name: "Tạo lời mời", exact: true }).click();
  const token = page.getByLabel("Mã chỉ hiện một lần");
  await expect(token).toBeVisible();
  await page.getByRole("button", { name: "Sao ch\u00e9p m\u00e3", exact: true })
    .click();
  const discarded = await token.inputValue();
  expect(discarded.length).toBe(64);
  await page.reload();
  await page.getByRole("button", { name: "Thu hồi", exact: true }).click();
  await page.getByLabel("Email người nhận").fill("partner@example.test");
  await page.getByRole("button", { name: "Tạo lời mời", exact: true }).click();
  const value = await page.getByLabel("Mã chỉ hiện một lần").inputValue();
  expect(value).not.toBe(discarded);
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await page.getByLabel("Email", { exact: true }).fill("partner@example.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(
    "Local-Only-Test-Password-2026!",
  );
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.getByLabel("Mã mời riêng").fill(value);
  await page.getByRole("button", { name: "Tham gia cùng người thương" })
    .click();
  await expect(page.getByRole("heading", { name: "Our Story", exact: true })).toBeVisible();
});
