import { useEffect, useRef } from "react";
import { PrivateImage } from "../../components/PrivateImage";
import type { Photo } from "./useGallery";
export function PhotoViewer(
  { photos, index, onIndex, onClose }: {
    photos: Photo[];
    index: number;
    onIndex: (index: number) => void;
    onClose: () => void;
  },
) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  const photo = photos[index];
  if (!photo) return null;
  return (
    <dialog
      ref={ref}
      aria-labelledby="viewer-title"
      className="max-h-[95vh] w-[95vw] max-w-5xl rounded-3xl bg-stone-50 p-4 backdrop:bg-stone-950/80"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" && index > 0) {
          event.preventDefault();
          onIndex(index - 1);
        }
        if (event.key === "ArrowRight" && index < photos.length - 1) {
          event.preventDefault();
          onIndex(index + 1);
        }
      }}
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 id="viewer-title">Ảnh kỷ niệm</h2>
        <button type="button" autoFocus onClick={onClose}>Đóng ảnh</button>
      </header>
      <PrivateImage
        key={photo.id}
        path={photo.storage_path}
        alt={photo.description || "Ảnh kỷ niệm"}
        eager
      />
      <p className="mt-3 whitespace-pre-wrap">{photo.description}</p>
      <time>{photo.event_date}</time>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onIndex(index - 1)}
        >
          Ảnh trước
        </button>
        <span>{index + 1} / {photos.length}</span>
        <button
          type="button"
          disabled={index === photos.length - 1}
          onClick={() => onIndex(index + 1)}
        >
          Ảnh sau
        </button>
      </div>
    </dialog>
  );
}
