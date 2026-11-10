import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { registerPrivateCleanup } from "../../lib/privateSession";
export type Entry = {
  id: string;
  author_id: string;
  kind: "diary" | "letter";
  title: string;
  content: string;
  event_date: string;
  created_at: string;
  version: number;
};
export function useEntries(coupleId: string) {
  const [items, setItems] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [more, setMore] = useState(false);
  const sequence = useRef(0);
  async function load(last?: Entry) {
    const request = ++sequence.current;
    setLoading(true);
    setError(false);
    let query = supabase().from("entries").select(
      "id,author_id,kind,title,content,event_date,created_at,version",
    )
      .eq("couple_id", coupleId).order("event_date", { ascending: false })
      .order("created_at", { ascending: false }).order("id", {
        ascending: false,
      }).limit(30);
    if (last) {
      query = query.or(
        `event_date.lt.${last.event_date},and(event_date.eq.${last.event_date},created_at.lt.${last.created_at}),and(event_date.eq.${last.event_date},created_at.eq.${last.created_at},id.lt.${last.id})`,
      );
    }
    try {
      const response = await query;
      if (request !== sequence.current) return;
      if (response.error) setError(true);
      else {
        const records = response.data ?? [];
        setItems((old) => last ? [...old, ...records] : records);
        setMore(records.length === 30);
      }
    } catch {
      if (request === sequence.current) setError(true);
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    const off = registerPrivateCleanup(() => {
      sequence.current++;
      setItems([]);
      setMore(false);
      setError(false);
      setLoading(false);
    });
    return () => {
      sequence.current++;
      off();
    };
  }, [coupleId]);
  return {
    items,
    loading,
    error,
    more,
    reload: () => load(),
    next: () => load(items.at(-1)),
  };
}
