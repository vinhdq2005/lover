import { type FormEvent, useId, useState } from "react";
import { executeCommand, prepareCommand } from "../../lib/commands";
import { StatePanel } from "../../components/StatePanel";
import type { Entry } from "./useEntries";
export function EntryForm({ entry, onSaved, onCancel }: {
  entry?: Entry;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const kindId = useId();
  const [kind, setKind] = useState<Entry["kind"]>(entry?.kind ?? "diary");
  const [title, setTitle] = useState(entry?.title ?? ""),
    [content, setContent] = useState(entry?.content ?? "");
  const [date, setDate] = useState(entry?.event_date ?? ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    const length = (value: string) => Array.from(value.trim()).length;
    if (
      length(title) < 1 || length(title) > 200 || length(content) < 1 ||
      length(content) > 50000 || !date
    ) {
      setError(
        "Nhập tiêu đề 1–200 ký tự, nội dung 1–50.000 ký tự và ngày hợp lệ. Không để trống nội dung.",
      );
      return;
    }
    setBusy(true);
    try {
      await executeCommand(
        prepareCommand(entry ? "entry.update" : "entry.create", {
          kind,
          title,
          content,
          event_date: date,
          ...(entry ? { id: entry.id, expected_version: entry.version } : {}),
        }),
      );
      if (!entry) {
        setTitle("");
        setContent("");
        setDate("");
      }
      onSaved();
    } catch {
      setError(
        "Chưa thể lưu. Nội dung của bạn vẫn được giữ. Kiểm tra ngày không sau hôm nay theo múi giờ của hai bạn. Nếu bản ghi đã thay đổi, hãy sao chép nội dung, hủy sửa rồi mở lại bản mới nhất.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={save}
      className="card grid gap-4"
      aria-label="Soạn nhật ký hoặc thư"
    >
      <h2>{entry ? "Sửa bài viết" : "Viết cho chúng mình"}</h2>
      <div>
        <label htmlFor={kindId}>Loại bài viết</label>
        <select
          id={kindId}
          disabled={busy}
          value={kind}
          onChange={(e) => setKind(e.target.value as Entry["kind"])}
        >
          <option value="diary">Nhật ký</option>
          <option value="letter">Thư tình</option>
        </select>
      </div>
      <label>
        Tiêu đề bài viết<input
          disabled={busy}
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        Ngày viết<input
          disabled={busy}
          required
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <label>
        Nội dung bài viết<textarea
          disabled={busy}
          required
          rows={8}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </label>
      <p className="text-sm">
        Cả hai bạn đều đọc được bài viết này. Chỉ tác giả được sửa hoặc xóa.
      </p>
      <div className="flex flex-wrap gap-3">
        <button className="primary" disabled={busy}>
          {busy ? "Đang lưu..." : "Lưu bài viết"}
        </button>
        {onCancel && (
          <button type="button" disabled={busy} onClick={onCancel}>
            Hủy sửa bài viết
          </button>
        )}
      </div>
      {error && <StatePanel kind="error" message={error} />}
    </form>
  );
}
