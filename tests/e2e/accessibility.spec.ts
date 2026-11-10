import { expect, test } from "@playwright/test";
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
test("all private routes remain usable at 320px with semantic labels, focus and reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("first@example.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(
    "Local-Only-Test-Password-2026!",
  );
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
  for (
    const route of [
      "/",
      "/timeline",
      "/gallery",
      "/diary",
      "/settings",
      "/notifications",
    ]
  ) {
    await page.goto(route);
    await expect(page.locator("h1")).toHaveCount(1);
    expect(
      await page.evaluate(() =>
        document.documentElement.scrollWidth <= window.innerWidth
      ),
    ).toBe(true);
    const names = await page.locator("input,textarea,select").evaluateAll(
      (elements) =>
        elements.every((element) =>
          !!element.getAttribute("aria-label") ||
          !!element.getAttribute("aria-labelledby") ||
          !!(element as HTMLInputElement).labels?.length
        ),
    );
    expect(names).toBe(true);
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement !== document.body))
      .toBe(true);
    expect(await page.evaluate(()=>parseFloat(getComputedStyle(document.activeElement!).outlineWidth)>=2)).toBe(true);
    expect(
      await page.evaluate(() =>
        matchMedia("(prefers-reduced-motion: reduce)").matches
      ),
    ).toBe(true);
  }
  await page.goto("/settings");
  await expect(page.getByRole("button",{name:"Lưu hồ sơ của tôi",exact:true})).toBeVisible();
  const contrast=await page.evaluate(()=>{
    const luminance=(color:string)=>{const rgb=(color.match(/[\d.]+/g)??[]).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
    return [...document.querySelectorAll("body,button.primary")].map(element=>{const style=getComputedStyle(element),a=luminance(style.color),b=luminance(style.backgroundColor);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);});
  });
  expect(contrast.every(value=>value>=4.5)).toBe(true);
  // Use a terminal HTTP error for a deterministic error-state audit. Aborted network
  // reads are intentionally retried by the SDK and remain in loading during backoff.
  await page.route("**/rest/v1/entries*",route=>route.fulfill({status:403,contentType:"application/json",body:JSON.stringify({code:"42501",message:"Synthetic test denial"})}));
  await page.goto("/diary");await expect(page.getByRole("alert")).toBeVisible();
  await page.unroute("**/rest/v1/entries*");await page.getByRole("button",{name:"Thử lại",exact:true}).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
