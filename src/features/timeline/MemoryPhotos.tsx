import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { registerPrivateCleanup } from "../../lib/privateSession";
import { PrivateImage } from "../../components/PrivateImage";
import { PhotoViewer } from "../gallery/PhotoViewer";
import type { Photo } from "../gallery/useGallery";
export function MemoryPhotos(
  { memoryId, version }: { memoryId: string; version: number },
) {
  const [photos, setPhotos] = useState<Photo[]>([]),
    [more, setMore] = useState(false),
    [failed, setFailed] = useState(false),
    [viewer, setViewer] = useState<number>(),
    [page, setPage] = useState(0);
  const sequence = useRef(0);
  useEffect(() => {
    setPhotos([]);
    setPage(0);
  }, [memoryId, version]);
  useEffect(() => {
    const request = ++sequence.current;
    void (async () => {
      const links = await supabase().from("memory_photos").select(
        "photo_id,position",
      ).eq("memory_id", memoryId).order("position").range(
        page * 30,
        page * 30 + 29,
      );
      if (request !== sequence.current) return;
      if (links.error) {
        setFailed(true);
        return;
      }
      if (!links.data.length) {
        setMore(false);
        return;
      }
      const found = await supabase().from("photos").select(
        "id,uploader_id,album_id,description,event_date,created_at,storage_path,version,width,height,storage_missing",
      ).in("id", links.data.map((link) => link.photo_id));
      if (request !== sequence.current) return;
      setFailed(!!found.error);
      if (!found.error) {
        const records = found.data ?? [];
        const ordered = links.data.flatMap((link) =>
          records.filter((photo) => photo.id === link.photo_id)
        );
        setPhotos((old) => page ? [...old, ...ordered] : ordered);
        setMore(links.data.length === 30);
      }
    })();
    return () => {
      sequence.current++;
    };
  }, [memoryId, version, page]);
  useEffect(() =>
    registerPrivateCleanup(() => {
      sequence.current++;
      setPhotos([]);
      setViewer(undefined);
    }), []);
  if (!photos.length && !failed) return null;
  return (
    <section className="mt-4 grid gap-3" aria-label="Ảnh của kỷ niệm">
      {failed && <p role="status">Chưa tải được ảnh. Hãy tải lại kỷ niệm.</p>}
      <div className="grid grid-cols-2 gap-3">
        {photos.map((photo, index) => (
          <div key={photo.id}>
            <PrivateImage
              className="aspect-square"
              path={photo.storage_path}
              alt={photo.description || "Ảnh của kỷ niệm"}
            />
            <button onClick={() => setViewer(index)}>Mở ảnh kỷ niệm</button>
          </div>
        ))}
      </div>
      {more && (
        <button onClick={() => setPage((value) => value + 1)}>
          Xem thêm ảnh kỷ niệm
        </button>
      )}
      {viewer !== undefined && photos[viewer] && (
        <PhotoViewer
          photos={photos}
          index={viewer}
          onIndex={setViewer}
          onClose={() => setViewer(undefined)}
        />
      )}
    </section>
  );
}
