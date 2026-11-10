import { useUploads } from "./useUploads";
import { StatePanel } from "../../components/StatePanel";
const labels = {
  preparing: "Đang chuẩn bị",
  waiting: "Đang chờ",
  uploading: "Đang tải",
  finalizing: "Đang kiểm tra",
  saved: "Đã lưu",
  failed: "Chưa lưu",
};
export function UploadPanel({ onSaved }: { onSaved: () => void }) {
  const uploads = useUploads(onSaved);
  return (
    <section className="card grid gap-4" aria-label="Tải ảnh riêng tư">
      <h2>Thêm những khoảnh khắc</h2>
      <p className="text-sm">
        Chọn tối đa 20 ảnh JPEG, PNG hoặc WebP, mỗi ảnh tối đa 10 MiB và 24 MP.
        Ảnh được nén còn tối đa 1600 px; chỉ bản nén được lưu, không giữ ảnh
        gốc.
      </p>
      <label>
        Chọn ảnh<input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={uploads.busy || uploads.hasBatch && !uploads.closed}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            void uploads.start(files);
          }}
        />
      </label>
      <ul className="grid gap-3" aria-live="polite">
        {uploads.rows.map((row) => (
          <li key={row.id}>
            <span>{row.name}: {labels[row.state]}</span>
            <progress
              className="block w-full"
              max={100}
              value={row.progress}
              aria-label={`Tiến độ ${row.name}`}
            />
            {row.message && <p role="status">{row.message}</p>}
          </li>
        ))}
      </ul>
      {uploads.error && <StatePanel kind="error" message={uploads.error} />}
      {uploads.closed && (
        <StatePanel
          kind="success"
          message="Đã hoàn tất đợt tải. Bạn có thể chọn thêm ảnh."
        />
      )}
      <div className="flex flex-wrap gap-3">
        {uploads.retryable && !uploads.closed && (
          <button
            disabled={uploads.busy}
            onClick={() => void uploads.retry()}
          >
            Thử lại ảnh chưa lưu
          </button>
        )}
        {uploads.hasBatch && !uploads.closed && (
          <button
            disabled={uploads.busy}
            onClick={() => void uploads.finish()}
          >
            Hoàn tất đợt tải
          </button>
        )}
      </div>
    </section>
  );
}
