import { type FormEvent, useId, useState } from "react";
import { type Album, type Photo, useGallery } from "./useGallery";
import { UploadPanel } from "./UploadPanel";
import { PhotoViewer } from "./PhotoViewer";
import { PhotoDetailsForm } from "./PhotoDetailsForm";
import { useSession } from "../../app/SessionProvider";
import { executeCommand, prepareCommand } from "../../lib/commands";
import { StatePanel } from "../../components/StatePanel";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PrivateImage } from "../../components/PrivateImage";
export function GalleryPage({ coupleId }: { coupleId: string }) {
  const albumFilterId = useId();
  const { session } = useSession();
  const [filter, setFilter] = useState(""),
    [title, setTitle] = useState(""),
    [rename, setRename] = useState(""),
    [edit, setEdit] = useState<Photo>(),
    [viewer, setViewer] = useState<string>(),
    [remove, setRemove] = useState<
      { kind: "photo" | "album"; item: Photo | Album }
    >(),
    [error, setError] = useState(false),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false);
  const gallery = useGallery(coupleId, filter),
    selected = gallery.albums.find((album) => album.id === filter),
    ownSelected = selected?.creator_id === session?.user.id;
  async function mutate(command: string, payload: Record<string, unknown>) {
    setBusy(true);
    setError(false);
    setSuccess("");
    try {
      await executeCommand(prepareCommand(command, payload));
      setSuccess("Đã lưu thay đổi.");
      await gallery.reload();
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    if (await mutate("album.create", { title })) setTitle("");
  }
  async function destroy() {
    if (!remove) return;
    const target = remove;
    if (
      await mutate(target.kind + ".delete", {
        id: target.item.id,
        expected_version: target.item.version,
      })
    ) {
      setRemove(undefined);
      setEdit(undefined);
      if (target.kind === "album") setFilter("");
    } else setRemove(undefined);
  }
  const viewerIndex = gallery.photos.findIndex((photo) => photo.id === viewer);
  return (
    <div className="grid gap-6">
      <h1>Thư viện ảnh</h1>
      <UploadPanel onSaved={() => void gallery.reload()} />
      <section className="card grid gap-4" aria-label="Quản lý album">
        <h2>Những bộ ảnh của chúng mình</h2>
        <form onSubmit={create} className="flex flex-wrap items-end gap-3">
          <label>
            Tên album<input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <button className="primary" disabled={busy}>Tạo album</button>
        </form>
        <div>
          <label htmlFor={albumFilterId}>Lọc album</label>
          <select
            id={albumFilterId}
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setRename(
                gallery.albums.find((album) => album.id === event.target.value)
                  ?.title ?? "",
              );
            }}
          >
            <option value="">Tất cả ảnh</option>
            <option value="none">Chưa có album</option>
            {gallery.albums.map((album) => (
              <option key={album.id} value={album.id}>{album.title}</option>
            ))}
          </select>
        </div>
        {selected && ownSelected && (
          <div className="flex flex-wrap items-end gap-3">
            <label>
              Tên album mới<input
                value={rename}
                onChange={(event) => setRename(event.target.value)}
              />
            </label>
            <button
              disabled={busy}
              onClick={() =>
                void mutate("album.update", {
                  id: selected.id,
                  expected_version: selected.version,
                  title: rename,
                })}
            >
              Đổi tên album
            </button>
            <button
              disabled={busy}
              onClick={() => setRemove({ kind: "album", item: selected })}
            >
              Xóa album
            </button>
          </div>
        )}
      </section>
      {(gallery.error || error) && (
        <StatePanel
          kind="error"
          message="Không thể hoàn tất. Tải lại danh sách để kiểm tra thay đổi hoặc thử lại."
          onRetry={() => {
            setError(false);
            void gallery.reload();
          }}
        />
      )}
      {success && <StatePanel kind="success" message={success} />}
      {edit && (
        <PhotoDetailsForm
          key={edit.id}
          photo={edit}
          albums={gallery.albums}
          onSaved={() => {
            setEdit(undefined);
            setSuccess("Đã lưu thông tin ảnh.");
            void gallery.reload();
          }}
          onCancel={() => setEdit(undefined)}
        />
      )}
      {gallery.loading && (
        <StatePanel kind="loading" message="Đang mở bộ ảnh..." />
      )}
      {!gallery.loading && !gallery.error && !gallery.photos.length && (
        <StatePanel
          kind="empty"
          message="Chưa có ảnh ở đây. Hãy lưu khoảnh khắc đầu tiên của hai bạn."
        />
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {gallery.photos.map((photo) => (
          <article
            key={photo.id}
            className="card grid content-start gap-3"
            aria-label={photo.description || `Ảnh ngày ${photo.event_date}`}
          >
            <PrivateImage
              className="aspect-square"
              path={photo.storage_path}
              alt={photo.description || "Ảnh kỷ niệm"}
            />
            <p className="whitespace-pre-wrap break-words">
              {photo.description || "Khoảnh khắc của chúng mình"}
            </p>
            <time className="text-sm">{photo.event_date}</time>
            {photo.storage_missing && (
              <p role="status">
                Ảnh đang cần khôi phục. Thông tin ảnh vẫn được giữ.
              </p>
            )}
            <button
              type="button"
              onClick={() => setViewer(photo.id)}
            >
              Mở ảnh
            </button>
            {photo.uploader_id === session?.user.id && (
              <div className="flex flex-wrap gap-3">
                <button onClick={() => setEdit(photo)}>Sửa ảnh</button>
                <button
                  onClick={() => setRemove({ kind: "photo", item: photo })}
                >
                  Xóa ảnh
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {gallery.more && (
        <button
          disabled={gallery.loading}
          onClick={() => void gallery.loadMore()}
        >
          Xem thêm ảnh
        </button>
      )}
      {viewerIndex >= 0 && (
        <PhotoViewer
          photos={gallery.photos}
          index={viewerIndex}
          onIndex={(index) => setViewer(gallery.photos[index].id)}
          onClose={() => setViewer(undefined)}
        />
      )}
      <ConfirmDialog
        open={!!remove}
        title={remove?.kind === "album" ? "Xóa album này?" : "Xóa ảnh này?"}
        onConfirm={() => void destroy()}
        onCancel={() => setRemove(undefined)}
      >
        {remove?.kind === "album"
          ? "Ảnh vẫn được giữ và trở thành ảnh chưa có album."
          : "Ảnh sẽ được gỡ khỏi thư viện, hồ sơ và các kỷ niệm đang dùng ảnh này."}
      </ConfirmDialog>
    </div>
  );
}
