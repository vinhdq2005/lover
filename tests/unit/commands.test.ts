import { afterEach, expect, it, vi } from "vitest";
import { executeCommand, prepareCommand } from "../../src/lib/commands";
import { clearPrivateSession } from "../../src/lib/privateSession";
const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock(
  "../../src/lib/supabase",
  () => ({ supabase: () => ({ functions: { invoke: mocks.invoke } }) }),
);
afterEach(() => {
  clearPrivateSession();
  mocks.invoke.mockReset();
});
it("coalesces concurrent submissions before an operation has been issued", async () => {
  mocks.invoke.mockImplementation(
    async (_name: string, options: { body: { command: string } }) => {
      if (options.body.command === "operation.issue") {
        return {
          data: {
            operation_id: "test",
            token: "signed",
            expires_at: new Date(Date.now() + 60000).toISOString(),
          },
          error: null,
        };
      }
      return { data: { id: "saved" }, error: null };
    },
  );
  const op = prepareCommand("memory.create", { title: "Test" });
  const first = executeCommand(op), second = executeCommand(op);
  expect(first).toBe(second);
  await Promise.all([first, second]);
  expect(mocks.invoke).toHaveBeenCalledTimes(2); // One issuance and one commit.
});
it("does not commit a response that arrives after logout cleanup", async () => {
  let resolve!: (value: unknown) => void;
  mocks.invoke.mockReturnValue(
    new Promise((result) => {
      resolve = result;
    }),
  );
  const op = prepareCommand("memory.create", { title: "Private draft" });
  const result = executeCommand(op);
  clearPrivateSession();
  resolve({
    data: {
      operation_id: "test",
      token: "signed",
      expires_at: new Date(Date.now() + 60000).toISOString(),
    },
    error: null,
  });
  await expect(result).rejects.toThrow("SESSION_EXPIRED");
  expect(mocks.invoke).toHaveBeenCalledTimes(1);
  expect(op.payload).toEqual({});
  expect(op.operation_token).toBeUndefined();
});
