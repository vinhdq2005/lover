import { PhotoPicker } from "../gallery/PhotoPicker";
import { type FormEvent, useState } from "react";
import type { Memory } from "./useMemories";
import { executeCommand, prepareCommand } from "../../lib/commands";
import { StatePanel } from "../../components/StatePanel";
export function MemoryForm(
  { memory, onSaved, onCancel, coupleId }: {
    coupleId: string;
    memory?: Memory;
    onSaved: () => void;
    onCancel?: () => void;
  },
) {
  const [title, setTitle] = useState(memory?.title ?? ""),
    [description, setDescription] = useState(memory?.description ?? ""),
    [date, setDate] = useState(memory?.event_date ?? "");
  const [photoIds, setPhotoIds] = useState<string[]>(
    [...(memory?.memory_photos ?? [])].sort((a, b) => a.position - b.position)
      .map((link) => link.photo_id),
  );
  const [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    try {
      await executeCommand(
        prepareCommand(memory ? "memory.update" : "memory.create", {
          title,
          description,
          event_date: date,
          photo_ids: photoIds,
          ...(memory
            ? { id: memory.id, expected_version: memory.version }
            : {}),
        }),
      );
      if (!memory) {
        setTitle("");
        setDescription("");
        setDate("");
        setPhotoIds([]);
      }
      onSaved();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="card grid gap-4">
      <h2>{memory ? "Sửa kỷ niệm" : "Lưu một kỷ niệm"}</h2>
      <label>
        Tiêu đề<input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        Ngày diễn ra<input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <label>
        Câu chuyện<textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <PhotoPicker
        coupleId={coupleId}
        value={photoIds}
        onChange={setPhotoIds}
      />
      <div className="flex gap-3">
        <button className="primary" disabled={busy}>Lưu kỷ niệm</button>
        {onCancel && <button type="button" onClick={onCancel}>Hủy</button>}
      </div>
      {failed && (
        <StatePanel
          kind="error"
          message="Không thể lưu. Nội dung vẫn ở đây; kiểm tra ngày hoặc tải lại nếu bản ghi đã thay đổi."
        />
      )}
    </form>
  );
}
