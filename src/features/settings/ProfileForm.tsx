import { type FormEvent, useEffect, useState } from "react";
import type { Profile } from "./useSettings";
import { SettingsPhotoPicker } from "./SettingsPhotoPicker";
import { executeCommand, prepareCommand } from "../../lib/commands";
import { StatePanel } from "../../components/StatePanel";
export function ProfileForm(
  { profile, actorId, coupleId, onSaved, onReload, onSaving }: {
    profile: Profile;
    actorId: string;
    coupleId: string;
    onSaved: () => void | Promise<void>;
    onReload?: () => Promise<void>;
    onSaving?: () => void;
  },
) {
  const [name, setName] = useState(profile.display_name),
    [avatar, setAvatar] = useState(profile.avatar_photo_id),
    [version, setVersion] = useState(profile.version);
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!dirty) {
      setName(profile.display_name);
      setAvatar(profile.avatar_photo_id);
      setVersion(profile.version);
    }
  }, [profile, dirty]);
  async function save(event: FormEvent) {
    event.preventDefault();
    onSaving?.();
    if (profile.user_id !== actorId) return;
    if (!name.trim() || Array.from(name.trim()).length > 100) {
      setError("Tên hiển thị cần 1–100 ký tự.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await executeCommand(
        prepareCommand("profile.update", {
          display_name: name,
          avatar_photo_id: avatar,
          expected_version: version,
        }),
      );
      await onSaved();
      setDirty(false);
    } catch {
      setError(
        "Chưa thể lưu hồ sơ. Nội dung vẫn được giữ. Nếu dữ liệu hoặc ảnh đã thay đổi, hãy sao chép nội dung rồi chọn tải bản mới nhất.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (profile.user_id !== actorId) {
    return <p>Bạn chỉ được sửa hồ sơ của mình.</p>;
  }
  return (
    <form
      className="card grid gap-4"
      onSubmit={save}
      aria-label="Hồ sơ của tôi"
    >
      <h2>Hồ sơ của tôi</h2>
      <label>
        Tên hiển thị<input
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
        coupleId={coupleId}
        ownerId={actorId}
        label="Ảnh đại diện"
        value={avatar}
        disabled={busy}
        onChange={(id) => {
          setDirty(true);
          setAvatar(id);
        }}
      />
      <div className="flex flex-wrap gap-3">
        <button className="primary" disabled={busy}>Lưu hồ sơ của tôi</button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            await onReload?.();
            setDirty(false);
            setError("");
          }}
        >
          Tải hồ sơ mới nhất
        </button>
      </div>
      {error && <StatePanel kind="error" message={error} />}
    </form>
  );
}
