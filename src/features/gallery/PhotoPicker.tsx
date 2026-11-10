import { useGallery } from "./useGallery";
import { StatePanel } from "../../components/StatePanel";
export function PhotoPicker(
  { coupleId, value, onChange }: {
    coupleId: string;
    value: string[];
    onChange: (value: string[]) => void;
  },
) {
  const gallery = useGallery(coupleId, "");
  return (
    <fieldset className="grid gap-3">
      <legend>Ảnh từ thư viện</legend>
      <p>{value.length} ảnh được chọn</p>
      {gallery.error && (
        <StatePanel
          kind="error"
          message="Chưa tải được ảnh để chọn."
          onRetry={() => void gallery.reload()}
        />
      )}
      {!gallery.loading && !gallery.photos.length && (
        <p>Chưa có ảnh. Bạn có thể lưu ảnh trong Thư viện trước.</p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {gallery.photos.map((photo) => (
          <label key={photo.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.includes(photo.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...value, photo.id]
                    : value.filter((id) =>
                      id !== photo.id
                    ),
                )}
            />
            {photo.description || `Ảnh ngày ${photo.event_date}`}
          </label>
        ))}
      </div>
      {value.length > 0 && (
        <button type="button" onClick={() => onChange([])}>
          Bỏ chọn tất cả ảnh
        </button>
      )}
      {gallery.more && (
        <button
          type="button"
          disabled={gallery.loading}
          onClick={() => void gallery.loadMore()}
        >
          Xem thêm ảnh để chọn
        </button>
      )}
    </fieldset>
  );
}
