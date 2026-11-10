import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { registerPrivateCleanup } from "../../lib/privateSession";
export type Memory = {
  id: string;
  title: string;
  description: string;
  event_date: string;
  creator_id: string;
  created_at: string;
  version: number;
  memory_photos?: { photo_id: string; position: number }[];
};
export function useMemories(coupleId: string, from = "", to = "") {
  const [items, setItems] = useState<Memory[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [more, setMore] = useState(false);
  const load = useCallback(async (last?: Memory) => {
    setLoading(true);
    setError(false);
    let query = supabase().from("memories").select(
      "id,title,description,event_date,creator_id,created_at,version,memory_photos(photo_id,position)",
    ).eq("couple_id", coupleId).order("event_date", { ascending: false }).order(
      "created_at",
      { ascending: false },
    ).order("id", { ascending: false }).limit(30);
    if (from) query = query.gte("event_date", from);
    if (to) query = query.lte("event_date", to);
    if (last) {
      query = query.or(
        `event_date.lt.${last.event_date},and(event_date.eq.${last.event_date},created_at.lt.${last.created_at}),and(event_date.eq.${last.event_date},created_at.eq.${last.created_at},id.lt.${last.id})`,
      );
    }
    const { data, error } = await query;
    setError(!!error);
    if (!error) {
      setItems((old) => last ? [...old, ...(data ?? [])] : data ?? []);
      setMore(data?.length === 30);
    }
    setLoading(false);
  }, [coupleId, from, to]);
  useEffect(() => {
    void load();
    return registerPrivateCleanup(() => setItems([]));
  }, [load]);
  return {
    items,
    loading,
    error,
    more,
    reload: () => load(),
    next: () => load(items.at(-1)),
  };
}
