import { spawnSync } from "node:child_process";
const result = spawnSync(process.execPath, [
  "node_modules/@playwright/test/cli.js",
  "test",
  "tests/e2e/performance.spec.ts",
], { stdio: "inherit", env: { ...process.env, LOVER_E2E_PRODUCTION: "1" } });
process.exit(result.status ?? 1);
