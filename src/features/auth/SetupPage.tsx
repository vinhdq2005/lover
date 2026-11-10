import { type FormEvent, useState } from "react";
import { executeCommand, prepareCommand } from "../../lib/commands";
import { StatePanel } from "../../components/StatePanel";
export function SetupPage({ onComplete }: { onComplete: () => void }) {
  const [name, setName] = useState(""),
    [date, setDate] = useState(""),
    [zone, setZone] = useState("Asia/Ho_Chi_Minh"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    try {
      await executeCommand(
        prepareCommand("couple.create", {
          name,
          start_date: date,
          timezone: zone,
        }),
      );
      onComplete();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <h1>Bắt đầu câu chuyện</h1>
      <p className="my-4">
        Chỉ tài khoản đầu tiên được phê duyệt mới có thể tạo không gian.
      </p>
      <form onSubmit={submit} className="grid gap-4">
        <label>
          Tên của chúng mình<input
            value={name}
            maxLength={100}
            required
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Ngày bắt đầu<input
            type="date"
            value={date}
            required
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Múi giờ<input
            value={zone}
            required
            onChange={(e) => setZone(e.target.value)}
          />
        </label>
        <button disabled={busy} className="primary">
          Tạo không gian riêng
        </button>
      </form>
      {error && (
        <StatePanel
          kind="error"
          message="Không thể thiết lập. Kiểm tra ngày, múi giờ và quyền tài khoản."
        />
      )}
    </section>
  );
}
