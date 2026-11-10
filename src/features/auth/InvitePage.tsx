import { type FormEvent, useState } from "react";
import { executeCommand, prepareCommand } from "../../lib/commands";
import { StatePanel } from "../../components/StatePanel";
export function InvitePage({ onComplete }: { onComplete: () => void }) {
  const [token, setToken] = useState(""),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await executeCommand(prepareCommand("invitation.accept", { token }));
      setToken("");
      onComplete();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card mt-6">
      <h2>Nhận lời mời</h2>
      <form onSubmit={submit} className="grid gap-4">
        <label>
          Mã mời riêng<input
            value={token}
            required
            minLength={32}
            autoComplete="off"
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
        <button disabled={busy} className="primary">
          Tham gia cùng người thương
        </button>
      </form>
      {error && (
        <StatePanel
          kind="error"
          message="Lời mời không khả dụng. Kiểm tra mã, tài khoản hoặc xin lời mời mới."
        />
      )}
    </section>
  );
}
