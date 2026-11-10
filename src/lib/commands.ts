import { supabase } from "./supabase";
import { registerPrivateCleanup } from "./privateSession";
import { notifySettingsChanged } from "./settingsEvents";
export type PendingCommand = {
  command: string;
  payload: Record<string, unknown>;
  operation_id?: string;
  operation_token?: string;
  expires_at?: string;
};
const pending = new Set<PendingCommand>();
registerPrivateCleanup(() => {
  for (const op of pending) {
    op.payload = {};
    op.operation_token = undefined;
  }
  pending.clear();
});
export function prepareCommand(
  command: string,
  payload: Record<string, unknown>,
): PendingCommand {
  for (const old of pending) {
    if (
      old.command === command &&
      JSON.stringify(old.payload) === JSON.stringify(payload)
    ) return old;
  }
  const value = { command, payload: structuredClone(payload) };
  pending.add(value);
  return value;
}
const running = new WeakMap<PendingCommand, ReturnType<typeof executeOnce>>();
export function executeCommand(op: PendingCommand) {
  const existing = running.get(op);
  if (existing) return existing;
  const result = executeOnce(op);
  running.set(op, result);
  void result.then(() => running.delete(op), () => running.delete(op));
  return result;
}
async function executeOnce(op: PendingCommand) {
  if (!pending.has(op)) throw new Error("SESSION_EXPIRED");
  const client = supabase();
  if (!op.operation_id) {
    const { data, error } = await client.functions.invoke("api", {
      body: {
        command: "operation.issue",
        payload: { command: op.command, payload: op.payload },
      },
    });
    if (error || !data?.operation_id || !data?.token) {
      throw new Error("COMMAND_ISSUANCE_FAILED");
    }
    Object.assign(op, {
      operation_id: data.operation_id,
      operation_token: data.token,
      expires_at: data.expires_at,
    });
  }
  if (!pending.has(op)) {
    op.operation_token = undefined;
    throw new Error("SESSION_EXPIRED");
  }
  if (Date.parse(op.expires_at ?? "") <= Date.now()) {
    throw new Error("OPERATION_EXPIRED");
  }
  const { data, error } = await client.functions.invoke("api", {
    body: {
      command: op.command,
      payload: op.payload,
      operation_id: op.operation_id,
      operation_token: op.operation_token,
    },
  });
  if (error) throw new Error("COMMAND_FAILED");
  pending.delete(op);
  op.operation_token = undefined;
  if (/^(profile\.|couple\.|milestone\.)/.test(op.command) || op.command === "photo.delete") notifySettingsChanged();
  return data;
}
