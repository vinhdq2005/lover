import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 120000,
    fileParallelism: false,
    maxWorkers: 1,
    globalSetup: ["tests/integration/global-setup.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    env: {
      LOVER_TEST_WORKDIR: resolve(".test-stack"),
      LOVER_TEST_EDGE_ENVFILE: resolve(".test-stack/edge.env"),
    },
    reporters: ["verbose", "json"],
    outputFile: { json: "artifacts/integration-results.json" },
  },
});
