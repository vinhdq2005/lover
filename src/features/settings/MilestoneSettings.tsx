import { type FormEvent, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { executeCommand, prepareCommand } from "../../lib/commands";
import { StatePanel } from "../../components/StatePanel";
import { ConfirmDialog } from "../../components/ConfirmDialog";
type Milestone = {
  id: string;
  label: string;
  original_date: string;
  version: number;
};
export function MilestoneSettings({ coupleId }: { coupleId: string }) {
  const [items, setItems] = useState<Milestone[]>([]),
    [label, setLabel] = useState(""),
    [date, setDate] = useState("");
  const [edit, setEdit] = useState<Milestone>(),
    [remove, setRemove] = useState<Milestone | null>(null),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  async function load() {
    const { data, error } = await supabase().from("milestones").select(
      "id,label,original_date,version",
    ).eq("couple_id", coupleId).order("original_date");
    setFailed(!!error);
    setItems(data ?? []);
  }
  useEffect(() => {
    void load();
  }, [coupleId]);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await executeCommand(
        prepareCommand(edit ? "milestone.update" : "milestone.create", {
          label,
          original_date: date,
          ...(edit ? { id: edit.id, expected_version: edit.version } : {}),
        }),
      );
      setLabel("");
      setDate("");
      setEdit(undefined);
      await load();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  async function destroy() {
    if (!remove) return;
    try {
      await executeCommand(
        prepareCommand("milestone.delete", {
          id: remove.id,
          expected_version: remove.version,
        }),
      );
      setRemove(null);
      await load();
    } catch {
      setFailed(true);
      setRemove(null);
    }
  }
  return (
    <section className="card">
      <h2>Những ngày đặc biệt</h2>
      <form onSubmit={save} className="grid gap-3">
        <label>
          Tên ngày kỷ niệm<input
            required
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>
        <label>
          Ngày kỷ niệm gốc<input
            type="date"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <button className="primary" disabled={busy}>
          {edit ? "Lưu thay đổi ngày đặc biệt" : "Thêm ngày đặc biệt"}
        </button>
      </form>
      {failed && (
        <StatePanel
          kind="error"
          message="Không thể tải hoặc lưu ngày đặc biệt. Kiểm tra ngày và thử lại."
          onRetry={() => void load()}
        />
      )}
      <ul className="mt-5 grid gap-4">
        {items.map((item) => (
          <li key={item.id}>
            <p>{item.label} — {item.original_date}</p>
            <button
              onClick={() => {
                setEdit(item);
                setLabel(item.label);
                setDate(item.original_date);
              }}
            >
              Sửa ngày đặc biệt
            </button>
            <button onClick={() => setRemove(item)}>Xóa ngày đặc biệt</button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!remove}
        title="Xóa ngày đặc biệt?"
        onCancel={() => setRemove(null)}
        onConfirm={() => void destroy()}
      />
    </section>
  );
}
