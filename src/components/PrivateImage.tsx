import { useEffect, useRef, useState } from "react";
import { loadPrivateImage } from "../lib/privateImages";
import { registerPrivateCleanup } from "../lib/privateSession";
export function PrivateImage(
  { path, alt, eager = false, className = "" }: {
    path: string;
    alt: string;
    eager?: boolean;
    className?: string;
  },
) {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(eager),
    [url, setUrl] = useState<string>(),
    [failed, setFailed] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (eager || !box.current) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: "200px" },
    );
    observer.observe(box.current);
    return () => observer.disconnect();
  }, [eager]);
  useEffect(() => {
    if (!visible) return;
    let active = true, release: (() => void) | undefined;
    setUrl(undefined);
    setFailed(false);
    const off = registerPrivateCleanup(() => {
      active = false;
      release?.();
      setUrl(undefined);
    });
    void loadPrivateImage(path).then((image) => {
      if (!active) {
        image.release();
        return;
      }
      release = image.release;
      setUrl(image.url);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => {
      active = false;
      off();
      release?.();
      setUrl(undefined);
    };
  }, [path, visible, revision]);
  return (
    <div ref={box} className={`grid min-h-24 place-items-center ${className}`}>
      {url
        ? (
          <img
            src={url}
            alt={alt}
            className="max-h-[75vh] w-full object-contain"
          />
        )
        : failed
        ? (
          <div role="status">
            Không thể mở ảnh.{" "}
            <button
              type="button"
              onClick={() =>
                setRevision((value) => value + 1)}
            >
              Thử lại ảnh
            </button>
          </div>
        )
        : <span role="status">Đang mở ảnh...</span>}
    </div>
  );
}
