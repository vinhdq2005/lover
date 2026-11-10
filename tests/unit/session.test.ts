import { expect, it } from "vitest";
import { publicConfiguration } from "../../src/lib/supabase";
import {
  clearPrivateSession,
  registerPrivateCleanup,
} from "../../src/lib/privateSession";
it("rejects a service key and remote insecure configuration", () => {
  expect(() =>
    publicConfiguration({
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_never-public",
    })
  ).toThrow();
  expect(() =>
    publicConfiguration({
      VITE_SUPABASE_URL: "http://example.com",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    })
  ).toThrow();
  expect(
    publicConfiguration({
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    }).url,
  ).toBe("http://127.0.0.1:54321");
});
it("clears every resource even when one cleanup fails", () => {
  let cleared = 0;
  const offA = registerPrivateCleanup(() => {
    throw new Error("test");
  });
  const offB = registerPrivateCleanup(() => {
    cleared++;
  });
  clearPrivateSession();
  expect(cleared).toBe(1);
  offA();
  offB();
});
