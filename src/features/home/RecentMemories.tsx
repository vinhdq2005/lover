import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { registerPrivateCleanup } from "../../lib/privateSession";
import type { Memory } from "../timeline/useMemories";
export function RecentMemories({ coupleId }: { coupleId: string }) {
  const [items, setItems] = useState<
      Pick<Memory, "id" | "title" | "event_date">[]
    >([]),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase().from("memories").select("id,title,event_date").eq(
      "couple_id",
      coupleId,
    ).order("event_date", { ascending: false }).order("created_at", {
      ascending: false,
    }).order("id", { ascending: false }).limit(5).then(({ data, error }) => {
      if (active) {
        setItems(data ?? []);
        setFailed(!!error);
      }
    });
    const off = registerPrivateCleanup(() => setItems([]));
    return () => {
      active = false;
      off();
    };
  }, [coupleId]);
  return (
    <section className="card">
      <h2>Kỷ niệm gần đây</h2>
      {failed
        ? <p role="alert">Không thể tải kỷ niệm. Mở dòng kỷ niệm để thử lại.</p>
        : items.length
        ? (
          <ul className="grid gap-4">
            {items.map((item) => (
              <li key={item.id}>
                <time className="text-sm">{item.event_date}</time>
                <p>{item.title}</p>
              </li>
            ))}
          </ul>
        )
        : <p>Hãy lưu kỷ niệm đầu tiên của hai người.</p>}
      <Link to="/timeline" className="mt-4 inline-block text-rose-800">
        Xem dòng kỷ niệm
      </Link>
    </section>
  );
}
