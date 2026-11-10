import { beforeEach } from "vitest";
import { disposableRoot, disposableSql } from "../helpers/disposableStack";
beforeEach(() => {
  if (process.env.LOVER_TEST_WORKDIR !== disposableRoot) {
    throw new Error("DISPOSABLE_RATE_FIXTURE_REQUIRED");
  }
  // Cases reuse synthetic identities but must not inherit each other's rate window.
  // The real 30/minute function and its 31st-request denial test remain unchanged.
  disposableSql("delete from private.operation_rate_limits;");
});
