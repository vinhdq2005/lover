import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { PrivateImage } from "../../components/PrivateImage";
import { StatePanel } from "../../components/StatePanel";
import { registerPrivateCleanup } from "../../lib/privateSession";
export function FeaturedPhoto({ photoId }: { photoId: string | null }) {
  const [photo, setPhoto] = useState<
      { storage_path: string; description: string } | null
    >(null),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setPhoto(null);
    setFailed(false);
    const off = registerPrivateCleanup(() => {
      active = false;
      setPhoto(null);
    });
    if (photoId) {
      void supabase().from("photos").select("storage_path,description").eq(
        "id",
        photoId,
      ).maybeSingle().then(({ data, error }) => {
        if (active) {
          setPhoto(data);
          setFailed(!!error || !data);
        }
      });
    }
    return () => {
      active = false;
      off();
    };
  }, [photoId]);
  if (failed) {
    return <StatePanel kind="error" message="Chưa mở được ảnh nổi bật." />;
  }
  if (!photoId) {
    return (
      <StatePanel
        kind="empty"
        message="Chưa có ảnh nổi bật. Hai bạn có thể chọn một khoảnh khắc từ thư viện khi cập nhật hồ sơ chung."
      />
    );
  }
  return (
    <section className="card">
      <h2>Khoảnh khắc của chúng mình</h2>
      {photo
        ? (
          <PrivateImage
            eager
            path={photo.storage_path}
            alt={photo.description || "Ảnh nổi bật của hai bạn"}
          />
        )
        : <p role="status">Đang mở ảnh nổi bật...</p>}
    </section>
  );
}
