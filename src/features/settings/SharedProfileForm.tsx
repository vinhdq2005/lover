import { type FormEvent, useEffect, useState } from "react";
import type { Couple } from "../home/useCouple";
import { SettingsPhotoPicker } from "./SettingsPhotoPicker";
import { executeCommand, prepareCommand } from "../../lib/commands";
import { StatePanel } from "../../components/StatePanel";
export function SharedProfileForm(
  { couple, onSaved, onReload, onSaving }: {
    couple: Couple;
    onSaved: () => void | Promise<void>;
    onReload?: () => Promise<void>;
    onSaving?: () => void;
  },
) {
  const [name, setName] = useState(couple.name),
    [photo, setPhoto] = useState(couple.featured_photo_id),
    [version, setVersion] = useState(couple.version);
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!dirty) {
      setName(couple.name);
      setPhoto(couple.featured_photo_id);
      setVersion(couple.version);
    }
  }, [couple, dirty]);
  async function save(event: FormEvent) {
    event.preventDefault();
    onSaving?.();
    if (!name.trim() || Array.from(name.trim()).length > 100) {
      setError("Tên không gian cần 1–100 ký tự.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await executeCommand(
        prepareCommand("couple.update", {
          name,
          featured_photo_id: photo,
          expected_version: version,
        }),
      );
      await onSaved();
      setDirty(false);
    } catch {
      setError(
        "Chưa thể lưu hồ sơ chung. Nội dung vẫn được giữ. Người thương có thể đã sửa hoặc ảnh không còn dùng được; sao chép nội dung trước khi tải bản mới nhất.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="card grid gap-4" onSubmit={save} aria-label="Hồ sơ chung">
      <h2>Hồ sơ chung</h2>
      <label>
        Tên không gian chung<input
          required
          disabled={busy}
          value={name}
          onChange={(e) => {
            setDirty(true);
            setName(e.target.value);
          }}
        />
      </label>
      <SettingsPhotoPicker
        coupleId={couple.id}
        label="Ảnh nổi bật"
        value={photo}
        disabled={busy}
        onChange={(id) => {
          setDirty(true);
          setPhoto(id);
        }}
      />
      <div className="flex flex-wrap gap-3">
        <button className="primary" disabled={busy}>Lưu hồ sơ chung</button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            await onReload?.();
            setDirty(false);
            setError("");
          }}
        >
          Tải hồ sơ chung mới nhất
        </button>
      </div>
      {error && <StatePanel kind="error" message={error} />}
    </form>
  );
}
