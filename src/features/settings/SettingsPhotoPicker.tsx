import { useId } from "react";
import { useGallery } from "../gallery/useGallery";
import { StatePanel } from "../../components/StatePanel";
export function SettingsPhotoPicker(
  { coupleId, ownerId, label, value, onChange, disabled = false }: {
    coupleId: string;
    ownerId?: string;
    label: string;
    value: string | null;
    onChange: (id: string | null) => void;
    disabled?: boolean;
  },
) {
  const id = useId(), gallery = useGallery(coupleId, "");
  const options = gallery.photos.filter((photo) =>
    !ownerId || photo.uploader_id === ownerId
  );
  return (
    <div className="grid gap-2">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value ?? ""}
        disabled={disabled || gallery.loading || gallery.error}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">Không chọn ảnh</option>
        {value && !options.some((photo) => photo.id === value) && (
          <option value={value}>Ảnh đã chọn chưa có trong trang này</option>
        )}
        {options.map((photo) => (
          <option key={photo.id} value={photo.id}>
            {photo.description || `Ảnh ngày ${photo.event_date}`}
          </option>
        ))}
      </select>
      {!gallery.loading && !options.length && (
        <p>
          Chưa có ảnh phù hợp. Hãy tải ảnh lên Thư viện trước; ảnh đại diện phải
          do chính bạn tải.
        </p>
      )}
      {gallery.error && (
        <StatePanel
          kind="error"
          message="Chưa tải được ảnh để chọn."
          onRetry={() => void gallery.reload()}
        />
      )}
      {gallery.more && (
        <button
          type="button"
          disabled={disabled || gallery.loading}
          onClick={() => void gallery.loadMore()}
        >
          Xem thêm ảnh để chọn
        </button>
      )}
    </div>
  );
}
