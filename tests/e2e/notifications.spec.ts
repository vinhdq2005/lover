import { expect, type Page, test } from "@playwright/test";
import { provisionCoupleLocal } from "../helpers/localStack";
import { randomUUID } from "node:crypto";
import { cleanGalleryFixture } from "../helpers/galleryFixture";
test.beforeEach(async () => {
  await cleanGalleryFixture();
  await provisionCoupleLocal();
});
test("mocked delivery failures, quota and uncertain acceptance preserve the authorized inbox",async({page})=>{
  const stack=await provisionCoupleLocal();
  const committed=await stack.admin.rpc("commit_mutation",{actor:stack.users.first,command:"album.create",payload:{title:"Synthetic status fixture"},op:randomUUID(),request_hash:"fixture",token_expiry:new Date(Date.now()+86400000).toISOString()});expect(committed.error).toBeNull();
  const notice=await stack.admin.from("notifications").select("id").eq("recipient_id",stack.users.partner).single();expect(notice.error).toBeNull();
  await login(page,"partner");
  for(const [state,label] of [["failed","Email chưa gửi được"],["deferred_quota","Email chờ hạn mức miễn phí"],["unknown","Chưa xác định kết quả email; không tự gửi lại ngoài thời hạn an toàn"],["accepted","Nhà cung cấp đã nhận; chưa xác nhận giao thư"]]){
    expect((await stack.admin.from("deliveries").update({state,attempts:1}).eq("notification_id",notice.data!.id)).error).toBeNull();
    await page.reload();await expect(page.getByText(label,{exact:true})).toBeVisible();await expect(page.getByRole("article")).toHaveCount(1);
  }
});
test.afterEach(async ({ page }) => {
  await page.close();
  await cleanGalleryFixture();
});
async function login(page: Page, role: string) {
  await page.goto("/notifications");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(
    role + "@example.test",
  );
  await page.getByLabel("Mật khẩu", { exact: true }).fill(
    "Local-Only-Test-Password-2026!",
  );
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Thông báo từ người thương",
      exact: true,
    }),
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
test("only partner receives generic notifications, read state and opt-in persist with email disabled", async ({ page }) => {
  await login(page, "first");
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.getByRole("link", { name: "Nhật ký và thư", exact: true }).click();
  await page.getByLabel("Tiêu đề bài viết", { exact: true }).fill(
    "PRIVATE-NOT-IN-INBOX",
  );
  await page.getByLabel("Ngày viết", { exact: true }).fill("2024-01-01");
  await page.getByLabel("Nội dung bài viết", { exact: true }).fill(
    "PRIVATE-NOT-IN-EMAIL",
  );
  await page.getByRole("button", { name: "Lưu bài viết", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "PRIVATE-NOT-IN-INBOX", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Thông báo", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(0);
  await logout(page);
  await login(page, "partner");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByText("Chưa đọc", { exact: true })).toBeVisible();
  await expect(page.getByText("Email đã tắt", { exact: true })).toBeVisible();
  await expect(page.getByText("PRIVATE-NOT-IN-INBOX", { exact: true }))
    .toHaveCount(0);
  await page.getByRole("button", { name: "Đánh dấu đã đọc", exact: true })
    .click();
  await expect(page.getByText("Đã đọc", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", {
    name: "Nhận email tùy chọn từ người thương",
    exact: true,
  }).check();
  await expect(
    page.getByRole("checkbox", {
      name: "Nhận email tùy chọn từ người thương",
      exact: true,
    }),
  ).toBeEnabled();
  await page.reload();
  await expect(page.getByText("Đã đọc", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("checkbox", {
      name: "Nhận email tùy chọn từ người thương",
      exact: true,
    }),
  ).toBeChecked();
  await expect(page.getByText("Email đã tắt", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Mở mục liên quan", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "PRIVATE-NOT-IN-INBOX", exact: true }),
  ).toBeVisible();
});
