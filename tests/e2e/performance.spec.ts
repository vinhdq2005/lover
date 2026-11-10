import { expect, test } from "@playwright/test";
import { seedPerformance } from "../../scripts/seed-performance";
import { cleanGalleryFixture } from "../helpers/galleryFixture";
import { writeFileSync } from "node:fs";
test.beforeEach(async () => {
  await cleanGalleryFixture();
});
test.afterEach(async ({ page }) => {
  await page.close();
  await cleanGalleryFixture();
});
test(
  "bounded production fixture meets 3-second initial usable p95 on stated network",
  async ({ page }, info) => {
    test.setTimeout(180000);
    if (process.env.LOVER_E2E_PRODUCTION !== "1") {
      throw new Error("RUN_NPM_TEST_PERFORMANCE_FOR_PRODUCTION_BUNDLE");
    }
    const fixture = await seedPerformance();
    await page.goto("/gallery");
    await page.getByLabel("Email", { exact: true }).fill("first@example.test");
    await page.getByLabel("Mật khẩu", { exact: true }).fill(
      "Local-Only-Test-Password-2026!",
    );
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Thư viện ảnh", exact: true }),
    ).toBeVisible();
    const session = await page.context().newCDPSession(page);
    await session.send("Network.enable");
    await session.send("Network.setCacheDisabled", { cacheDisabled: true });
    await session.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 100,
      downloadThroughput: 1250000,
      uploadThroughput: 1250000,
    });
    const samples: number[] = [];
    for (let repeat = 0; repeat < 5; repeat++) {
      for (
        const [route, heading] of [["/timeline", "Dòng kỷ niệm"], [
          "/gallery",
          "Thư viện ảnh",
        ], ["/", "Our Story"]]
      ) {
        const start = performance.now();
        await page.goto(route);
        await expect(page.getByRole("heading", { name: heading, exact: true }))
          .toBeVisible();
        if (route !== "/") {
          await expect(page.getByRole("article").first()).toBeVisible();
        }
        if (route === "/gallery") {
          // The upload/album controls precede the grid. Trigger the real lazy viewport
          // transition, retaining the photo-readiness assertion and the same 3s budget.
          await page.getByRole("article").first().scrollIntoViewIfNeeded();
          await expect(page.getByRole("img").first()).toBeVisible();
          await expect(page.getByRole("article")).toHaveCount(30);
        }
        samples.push(performance.now() - start);
      }
    }
    const sorted = [...samples].sort((a, b) => a - b),
      p95 = sorted[Math.ceil(sorted.length * .95) - 1];
    writeFileSync(
      "artifacts/performance-" + info.project.name + ".json",
      JSON.stringify(
        { fixture, network: { mbps: 10, latencyMs: 100 }, samples, p95 },
        null,
        2,
      ),
    );
    expect(p95).toBeLessThanOrEqual(3000);
  },
);
