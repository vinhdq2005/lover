import { type FormEvent, useId, useState } from "react";
import { executeCommand, prepareCommand } from "../../lib/commands";
import { StatePanel } from "../../components/StatePanel";
import type { Album, Photo } from "./useGallery";
export function PhotoDetailsForm(
  { photo, albums, onSaved, onCancel }: {
    photo: Photo;
    albums: Album[];
    onSaved: () => void;
    onCancel: () => void;
  },
) {
  const albumSelectId = useId();
  const [description, setDescription] = useState(photo.description),
    [date, setDate] = useState(photo.event_date),
    [album, setAlbum] = useState(photo.album_id ?? ""),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    try {
      await executeCommand(
        prepareCommand("photo.update", {
          id: photo.id,
          expected_version: photo.version,
          description,
          event_date: date,
          album_id: album || null,
        }),
      );
      onSaved();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={save}
      className="card grid gap-4"
      aria-label="Sửa thông tin ảnh"
    >
      <h2>Sửa ảnh</h2>
      <label>
        Mô tả ảnh<textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
        />
      </label>
      <label>
        Ngày chụp<input
          required
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      <div>
        <label htmlFor={albumSelectId}>Album của ảnh</label>
        <select
          id={albumSelectId}
          value={album}
          onChange={(event) => setAlbum(event.target.value)}
        >
          <option value="">Không có album</option>
          {albums.map((item) => (
            <option key={item.id} value={item.id}>{item.title}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-3">
        <button className="primary" disabled={busy}>Lưu thông tin ảnh</button>
        <button type="button" onClick={onCancel}>Hủy sửa ảnh</button>
      </div>
      {failed && (
        <StatePanel
          kind="error"
          message="Chưa thể lưu ảnh. Nội dung vẫn được giữ; kiểm tra ngày hoặc tải lại danh sách nếu ảnh đã thay đổi."
        />
      )}
    </form>
  );
}
